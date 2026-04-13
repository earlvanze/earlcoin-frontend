import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';
import algosdk from 'https://esm.sh/algosdk@3.5.2';

// --- Configuration --------------------------------------------------------

const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const TREASURY_ADDRESS = Deno.env.get('TREASURY_ADDRESS') ?? '';
const BTC_TREASURY_ADDRESS = Deno.env.get('BTC_TREASURY_ADDRESS') ?? '';
const MEMPOOL_API = Deno.env.get('MEMPOOL_API_URL') ?? 'https://mempool.space/api';
const ALGOD_URL = Deno.env.get('ALGOD_URL') ?? 'https://mainnet-api.4160.nodely.dev';
const EARL_ASA_ID = Number(Deno.env.get('EARL_ASA_ID') ?? '0');
const GOV_ADMIN_MNEMONIC = Deno.env.get('GOV_ADMIN_MNEMONIC') ?? '';
const TREASURY_MNEMONIC = Deno.env.get('TREASURY_MNEMONIC') ?? '';
const VNFT_ADMIN_MNEMONIC = Deno.env.get('VNFT_ADMIN_MNEMONIC') ?? '';
const EARL_DECIMALS = Number(Deno.env.get('EARL_ASA_DECIMALS') ?? '6');

// Minimum BTC confirmations required before settling EARL.
const MIN_CONFIRMATIONS = Number(Deno.env.get('BTC_MIN_CONFIRMATIONS') ?? '1');

// Orders older than this are marked expired (2 hours).
const DEPOSIT_TTL_MS = 2 * 60 * 60 * 1000;

// Cron secret protects the endpoint from public invocation.
const GOV_CRON_SECRET = Deno.env.get('GOV_CRON_SECRET') ?? '';

// --- Helpers --------------------------------------------------------------

const supabaseAdmin = createClient(PROJECT_URL, PROJECT_SECRET_KEY);
const algodClient = new algosdk.Algodv2('', ALGOD_URL, '');

const normalizeMnemonic = (v: string) => (v || '').trim().replace(/\s+/g, ' ');

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Resolve the signing key that controls the treasury Algorand wallet.
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
    } catch {}
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

// --- Mempool.space interaction --------------------------------------------

interface MempoolTx {
  txid: string;
  status: { confirmed: boolean; block_height?: number };
  vout: { scriptpubkey_address?: string; value: number }[];
}

async function fetchConfirmedDeposits(
  address: string,
): Promise<MempoolTx[]> {
  // Confirmed transactions for the address.
  const res = await fetch(`${MEMPOOL_API}/address/${address}/txs`);
  if (!res.ok) throw new Error(`mempool.space ${res.status}`);
  const txs: MempoolTx[] = await res.json();
  return txs.filter((tx) => tx.status?.confirmed);
}

async function getChainTip(): Promise<number> {
  const res = await fetch(`${MEMPOOL_API}/blocks/tip/height`);
  if (!res.ok) throw new Error(`mempool.space tip ${res.status}`);
  return Number(await res.text());
}

// Find a confirmed output to `address` with exactly `sats` value.
function matchDeposit(
  txs: MempoolTx[],
  address: string,
  sats: number,
  tipHeight: number,
): { txid: string; confirmations: number } | null {
  for (const tx of txs) {
    const match = tx.vout.find(
      (o) => o.scriptpubkey_address === address && o.value === sats,
    );
    if (match && tx.status.confirmed) {
      const confs = tx.status.block_height
        ? tipHeight - tx.status.block_height + 1
        : 0;
      return { txid: tx.txid, confirmations: confs };
    }
  }
  return null;
}

// --- Main handler ---------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth: only accept the cron secret. Fail closed if not configured.
    if (!GOV_CRON_SECRET) {
      return jsonResponse(500, { error: 'GOV_CRON_SECRET not configured' });
    }
    const cronToken = req.headers.get('x-cron-secret') ?? '';
    if (cronToken !== GOV_CRON_SECRET) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    if (!BTC_TREASURY_ADDRESS) {
      return jsonResponse(500, { error: 'BTC_TREASURY_ADDRESS not configured' });
    }

    // 1. Load all pending BTC deposit orders.
    const { data: orders, error: ordersErr } = await supabaseAdmin
      .from('treasury_orders')
      .select('id, user_id, wallet_address, quantity_base_units, payment_amount, reserve_wallet_address, created_at, status')
      .eq('fulfillment_mode', 'btc_bridge')
      .in('status', ['awaiting_btc_deposit', 'btc_deposit_confirmed'])
      .order('created_at', { ascending: true })
      .limit(50);

    if (ordersErr) {
      return jsonResponse(500, { error: ordersErr.message });
    }

    if (!orders || orders.length === 0) {
      return jsonResponse(200, { ok: true, processed: 0, message: 'No pending BTC deposits' });
    }

    // 2. Fetch confirmed transactions for the treasury BTC address.
    const tipHeight = await getChainTip();
    const confirmedTxs = await fetchConfirmedDeposits(BTC_TREASURY_ADDRESS);

    const results: Record<string, string> = {};

    for (const order of orders) {
      const orderId = order.id;
      const expectedSats = Number(order.payment_amount);

      // Check for expiry.
      const createdAt = new Date(order.created_at).getTime();
      if (Date.now() - createdAt > DEPOSIT_TTL_MS && order.status === 'awaiting_btc_deposit') {
        await supabaseAdmin.from('treasury_orders').update({
          status: 'btc_deposit_expired',
          updated_at: new Date().toISOString(),
        }).eq('id', orderId);
        results[orderId] = 'expired';
        continue;
      }

      // Try to match a confirmed on-chain deposit.
      const deposit = matchDeposit(confirmedTxs, BTC_TREASURY_ADDRESS, expectedSats, tipHeight);

      if (!deposit) {
        results[orderId] = 'waiting';
        continue;
      }

      if (deposit.confirmations < MIN_CONFIRMATIONS) {
        results[orderId] = `${deposit.confirmations}/${MIN_CONFIRMATIONS} confs`;
        continue;
      }

      // BTC deposit confirmed — conditional update to prevent double-settlement.
      const { data: claimed } = await supabaseAdmin.from('treasury_orders').update({
        status: 'btc_deposit_confirmed',
        payment_tx_id: deposit.txid,
        updated_at: new Date().toISOString(),
      }).eq('id', orderId).eq('status', 'awaiting_btc_deposit').select('id').maybeSingle();

      if (!claimed) {
        results[orderId] = 'already_claimed';
        continue;
      }

      // Settle EARL to the user's Algorand wallet if provided and opted in.
      const earlAmount = BigInt(order.quantity_base_units);
      const targetWallet = order.wallet_address;

      if (!targetWallet || !EARL_ASA_ID) {
        // No Algorand wallet — credit to custody instead.
        await supabaseAdmin.from('treasury_orders').update({
          status: 'pending_custody_credit',
          updated_at: new Date().toISOString(),
        }).eq('id', orderId);
        results[orderId] = 'pending_custody';
        continue;
      }

      const optedIn = await isOptedIn(targetWallet, EARL_ASA_ID);
      if (!optedIn) {
        await supabaseAdmin.from('treasury_orders').update({
          status: 'pending_optin',
          updated_at: new Date().toISOString(),
        }).eq('id', orderId);
        results[orderId] = 'pending_optin';
        continue;
      }

      try {
        const txId = await sendEarl(targetWallet, earlAmount);
        await supabaseAdmin.from('treasury_orders').update({
          status: 'fulfilled',
          tx_id: txId,
          updated_at: new Date().toISOString(),
        }).eq('id', orderId);
        results[orderId] = `fulfilled:${txId}`;
      } catch (err) {
        console.error(`EARL settlement failed for ${orderId}:`, err?.message || err);
        await supabaseAdmin.from('treasury_orders').update({
          status: 'pending_fulfillment',
          updated_at: new Date().toISOString(),
        }).eq('id', orderId);
        results[orderId] = 'pending_fulfillment';
      }
    }

    return jsonResponse(200, { ok: true, processed: orders.length, results });
  } catch (error) {
    console.error('monitor-btc-deposits error:', error?.message || error);
    return jsonResponse(500, { error: error?.message ?? 'Unknown monitor error' });
  }
});
