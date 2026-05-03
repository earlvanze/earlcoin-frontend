import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';
import algosdk from 'https://esm.sh/algosdk@3.5.2';

// --- Configuration --------------------------------------------------------

const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const STRIKE_API_KEY = Deno.env.get('STRIKE_API_KEY') ?? '';
const STRIKE_WEBHOOK_SECRET = Deno.env.get('STRIKE_WEBHOOK_SECRET') ?? '';
const STRIKE_API_URL = 'https://api.strike.me';

const TREASURY_ADDRESS = Deno.env.get('TREASURY_ADDRESS') ?? '';
const ALGOD_URL = Deno.env.get('ALGOD_URL') ?? 'https://mainnet-api.4160.nodely.dev';
const EARL_ASA_ID = Number(Deno.env.get('EARL_ASA_ID') ?? '0');
const GOV_ADMIN_MNEMONIC = Deno.env.get('GOV_ADMIN_MNEMONIC') ?? '';
const TREASURY_MNEMONIC = Deno.env.get('TREASURY_MNEMONIC') ?? '';
const VNFT_ADMIN_MNEMONIC = Deno.env.get('VNFT_ADMIN_MNEMONIC') ?? '';

// --- Helpers --------------------------------------------------------------

const supabaseAdmin = createClient(PROJECT_URL, PROJECT_SECRET_KEY);
const algodClient = new algosdk.Algodv2('', ALGOD_URL, '');

const normalizeMnemonic = (v: string) => (v || '').trim().replace(/\s+/g, ' ');

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// --- Strike helpers -------------------------------------------------------

async function strikeGet(path: string) {
  const res = await fetch(`${STRIKE_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${STRIKE_API_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strike GET ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

// --- Algorand helpers (shared with monitor-btc-deposits) ------------------

async function resolveTreasurySigner(assetId: number, minAmount: bigint) {
  if (!TREASURY_ADDRESS) return null;

  const signerPhrases = [GOV_ADMIN_MNEMONIC, TREASURY_MNEMONIC, VNFT_ADMIN_MNEMONIC]
    .map(normalizeMnemonic)
    .filter(Boolean);

  const info = await algodClient.accountInformation(TREASURY_ADDRESS).do();
  const authAddr = info?.['auth-addr'] || null;
  const holding = (info?.assets || []).find(
    (a: any) => Number(a['asset-id'] ?? a.assetId) === assetId,
  );
  const balance = BigInt(holding?.amount ?? 0);
  if (balance < minAmount) return null;

  for (const phrase of signerPhrases) {
    try {
      const acct = algosdk.mnemonicToSecretKey(phrase);
      const addr = typeof acct.addr === 'string'
        ? acct.addr
        : algosdk.encodeAddress(acct.addr.publicKey);
      if (!authAddr ? addr === TREASURY_ADDRESS : addr === authAddr) {
        return { acct, sender: TREASURY_ADDRESS };
      }
    } catch { /* skip invalid mnemonic */ }
  }
  return null;
}

async function sendEarl(to: string, amount: bigint): Promise<string> {
  const signer = await resolveTreasurySigner(EARL_ASA_ID, amount);
  if (!signer) throw new Error('No treasury signer/EARL liquidity for settlement');
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount exceeds safe range');

  const params = await algodClient.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: signer.sender,
    to,
    assetIndex: EARL_ASA_ID,
    amount: Number(amount),
    suggestedParams: params,
  });
  const signed = txn.signTxn(signer.acct.sk);
  const { txId } = await algodClient.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  return txId;
}

async function isOptedIn(wallet: string, assetId: number): Promise<boolean> {
  try {
    const acct = await algodClient.accountInformation(wallet).do();
    return (acct?.assets || []).some(
      (a: any) => Number(a['asset-id'] ?? a.assetId) === assetId,
    );
  } catch {
    return false;
  }
}

// --- Main handler ---------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Fail closed: reject all requests if webhook secret is not configured.
    if (!STRIKE_WEBHOOK_SECRET) {
      return jsonResponse(500, { error: 'Webhook secret not configured' });
    }
    const sig = req.headers.get('x-webhook-secret') ?? '';
    if (sig !== STRIKE_WEBHOOK_SECRET) {
      return jsonResponse(401, { error: 'Invalid webhook secret' });
    }

    const event = await req.json();
    const eventType: string = event?.eventType ?? '';
    const invoiceId: string = event?.data?.entityId ?? '';

    // We only care about invoice state changes.
    if (eventType !== 'invoice.updated' || !invoiceId) {
      return jsonResponse(200, { ok: true, skipped: true });
    }

    // Fetch the invoice from Strike to confirm it's actually PAID.
    const invoice = await strikeGet(`/v1/invoices/${invoiceId}`);
    if (invoice.state !== 'PAID') {
      return jsonResponse(200, { ok: true, state: invoice.state });
    }

    // Find the matching treasury order.
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('treasury_orders')
      .select('id, user_id, wallet_address, quantity_base_units, status')
      .eq('strike_invoice_id', invoiceId)
      .eq('fulfillment_mode', 'lightning')
      .single();

    if (orderErr || !order) {
      console.error('No matching order for Strike invoice:', invoiceId, orderErr?.message);
      return jsonResponse(200, { ok: false, error: 'No matching order' });
    }

    // Idempotency: skip if already past awaiting state.
    if (['fulfilled', 'lightning_payment_confirmed', 'pending_custody_credit', 'pending_optin', 'pending_fulfillment'].includes(order.status)) {
      return jsonResponse(200, { ok: true, already: order.status });
    }

    // Conditional update: only claim this order if still awaiting payment.
    // Prevents double-settlement from concurrent webhook deliveries.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('treasury_orders')
      .update({
        status: 'lightning_payment_confirmed',
        payment_tx_id: invoiceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'awaiting_lightning_payment')
      .select('id')
      .maybeSingle();

    if (claimErr || !claimed) {
      return jsonResponse(200, { ok: true, already: 'claimed_by_another' });
    }

    // Settle EARL to the user's Algorand wallet.
    const earlAmount = BigInt(order.quantity_base_units);
    const targetWallet = order.wallet_address;

    if (!targetWallet || !EARL_ASA_ID) {
      await supabaseAdmin.from('treasury_orders').update({
        status: 'pending_custody_credit',
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      return jsonResponse(200, { ok: true, result: 'pending_custody' });
    }

    const optedIn = await isOptedIn(targetWallet, EARL_ASA_ID);
    if (!optedIn) {
      await supabaseAdmin.from('treasury_orders').update({
        status: 'pending_optin',
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      return jsonResponse(200, { ok: true, result: 'pending_optin' });
    }

    try {
      const txId = await sendEarl(targetWallet, earlAmount);
      await supabaseAdmin.from('treasury_orders').update({
        status: 'fulfilled',
        tx_id: txId,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      return jsonResponse(200, { ok: true, result: 'fulfilled', tx_id: txId });
    } catch (err) {
      console.error(`EARL settlement failed for order ${order.id}:`, err?.message || err);
      await supabaseAdmin.from('treasury_orders').update({
        status: 'pending_fulfillment',
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      return jsonResponse(200, { ok: true, result: 'pending_fulfillment' });
    }
  } catch (error) {
    console.error('lightning-webhook error:', error?.message || error);
    return jsonResponse(500, { error: error?.message ?? 'Unknown webhook error' });
  }
});
