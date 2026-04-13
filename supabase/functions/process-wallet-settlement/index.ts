import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';
import algosdk from 'https://esm.sh/algosdk@3.5.2';

const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const TREASURY_ADDRESS = Deno.env.get('TREASURY_ADDRESS') ?? '';
const ALGOD_URL = Deno.env.get('ALGOD_URL') ?? 'https://mainnet-api.4160.nodely.dev';
const INDEXER_URL = Deno.env.get('INDEXER_URL') ?? 'https://mainnet-idx.4160.nodely.dev';
const EARL_ASA_ID = Number(Deno.env.get('EARL_ASA_ID') ?? '0');
const USDC_ASA_ID = Number(Deno.env.get('USDC_ASA_ID') ?? '31566704');
const EARL_DECIMALS = Number(Deno.env.get('EARL_ASA_DECIMALS') ?? '6');
const USDC_DECIMALS = Number(Deno.env.get('USDC_ASA_DECIMALS') ?? '6');
const TREASURY_EARL_USDC_PRICE = Number(Deno.env.get('TREASURY_EARL_USDC_PRICE') ?? '100');
const TREASURY_MNEMONIC = Deno.env.get('TREASURY_MNEMONIC') ?? '';
const GOV_ADMIN_MNEMONIC = Deno.env.get('GOV_ADMIN_MNEMONIC') ?? '';
const VNFT_ADMIN_MNEMONIC = Deno.env.get('VNFT_ADMIN_MNEMONIC') ?? '';

const supabaseAdmin = createClient(PROJECT_URL, PROJECT_SECRET_KEY);
const algodClient = new algosdk.Algodv2('', ALGOD_URL, '');
const indexerClient = new algosdk.Indexer('', INDEXER_URL, '');

const normalizeMnemonic = (value: string) => (value || '').trim().replace(/\s+/g, ' ');
const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const toBaseUnits = (value: number, decimals = 6) => {
  const scaled = Math.round(Number(value || 0) * 10 ** decimals);
  return BigInt(Math.max(0, scaled));
};

const orderQuantityBaseUnits = (order: Record<string, any>) => {
  if (order?.quantity_base_units !== undefined && order?.quantity_base_units !== null) {
    return BigInt(order.quantity_base_units);
  }
  return toBaseUnits(Number(order?.quantity ?? 0), EARL_DECIMALS);
};

const quoteUsdcFromEarlBaseUnits = (earlBaseUnits: bigint, usdcDecimals = USDC_DECIMALS, earlDecimals = EARL_DECIMALS) => {
  const earlPrecision = 10n ** BigInt(earlDecimals);
  const usdcPrecision = 10n ** BigInt(usdcDecimals);
  return (earlBaseUnits * BigInt(Math.round(TREASURY_EARL_USDC_PRICE * 100)) * usdcPrecision) / (earlPrecision * 100n);
};

const decodeNote = (note?: string | null) => {
  if (!note) return '';
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(note), (c) => c.charCodeAt(0)));
  } catch {
    return '';
  }
};

async function resolveAssetDecimals(assetId: number, fallback: number) {
  try {
    const asset = await algodClient.getAssetByID(assetId).do();
    const params = asset?.params ?? asset?.asset?.params ?? {};
    if (params?.decimals !== undefined && params?.decimals !== null) {
      return Number(params.decimals);
    }
  } catch {}
  return fallback;
}

async function isOptedIn(walletAddress: string, assetId: number) {
  const acct = await algodClient.accountInformation(walletAddress).do();
  const assets = acct?.assets || [];
  return assets.some((a: any) => Number(a['asset-id'] ?? a.assetId) === assetId);
}

async function resolveTreasurySigner(assetId: number, minAmount: bigint) {
  if (!TREASURY_ADDRESS) return null;

  const signerPhrases = [GOV_ADMIN_MNEMONIC, TREASURY_MNEMONIC, VNFT_ADMIN_MNEMONIC]
    .map(normalizeMnemonic)
    .filter(Boolean);

  const treasuryInfo = await algodClient.accountInformation(TREASURY_ADDRESS).do();
  const authAddr = treasuryInfo?.['auth-addr'] || null;
  const treasuryHolding = (treasuryInfo?.assets || []).find(
    (a: any) => Number(a['asset-id'] ?? a.assetId) === assetId,
  );
  const treasuryBalance = BigInt(treasuryHolding?.amount ?? 0);
  const treasuryAlgo = BigInt(treasuryInfo?.amount ?? 0);

  if (treasuryBalance < minAmount || treasuryAlgo <= 200000n) {
    return null;
  }

  for (const phrase of signerPhrases) {
    try {
      const acct = algosdk.mnemonicToSecretKey(phrase);
      const signerAddr = typeof acct.addr === 'string'
        ? acct.addr
        : algosdk.encodeAddress(acct.addr.publicKey);
      const signerMatches = !authAddr ? signerAddr === TREASURY_ADDRESS : signerAddr === authAddr;
      if (signerMatches) {
        return { acct, sender: TREASURY_ADDRESS };
      }
    } catch {}
  }

  return null;
}

async function sendAsset(assetId: number, to: string, amount: bigint) {
  const signer = await resolveTreasurySigner(assetId, amount);
  if (!signer) {
    throw new Error('No treasury signer/liquidity available for settlement');
  }
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Settlement amount exceeds safe integer range');
  }

  const params = await algodClient.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: signer.sender,
    to,
    assetIndex: assetId,
    amount: Number(amount),
    suggestedParams: params,
  });
  const signed = txn.signTxn(signer.acct.sk);
  const { txId } = await algodClient.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  return txId;
}

async function lookupIndexedTransaction(txId: string) {
  try {
    const result = await indexerClient.lookupTransactionByID(txId).do();
    return result?.transaction ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!PROJECT_URL || !PROJECT_SECRET_KEY) {
      return jsonResponse(500, { error: 'Project secret key not configured' });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing Authorization header' });
    }

    const supabase = createClient(PROJECT_URL, PROJECT_SECRET_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return jsonResponse(401, { error: authErr?.message ?? 'Unauthorized' });
    }

    const body = await req.json();
    const orderId = body?.order_id;
    const paymentTxId = String(body?.payment_tx_id ?? '').trim();

    if (!orderId || !paymentTxId) {
      return jsonResponse(400, { error: 'order_id and payment_tx_id are required' });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('treasury_orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (orderError) {
      return jsonResponse(500, { error: orderError.message });
    }
    if (!order) {
      return jsonResponse(404, { error: 'Treasury order not found' });
    }

    if (!['wallet_buy_earl', 'wallet_sell_earl', 'wallet_buy_earl_gobtc'].includes(order.purchase_type || '')) {
      return jsonResponse(400, { error: 'Order is not a wallet settlement order' });
    }

    if (order.payment_tx_id && order.payment_tx_id !== paymentTxId) {
      return jsonResponse(409, { error: 'Order is already associated with a different payment transaction' });
    }

    if (order.status === 'fulfilled') {
      return jsonResponse(200, { ok: true, status: 'fulfilled', txId: order.tx_id ?? null });
    }

    const { data: duplicatePayment } = await supabaseAdmin
      .from('treasury_orders')
      .select('id')
      .eq('payment_tx_id', paymentTxId)
      .neq('id', order.id)
      .maybeSingle();

    if (duplicatePayment?.id) {
      return jsonResponse(409, { error: 'Payment transaction is already linked to another treasury order' });
    }

    const tx = await lookupIndexedTransaction(paymentTxId);
    if (!tx) {
      return jsonResponse(202, { ok: false, retryable: true, status: 'payment_not_indexed_yet' });
    }

    const assetTransfer = tx['asset-transfer-transaction'];
    if (tx['tx-type'] !== 'axfer' || !assetTransfer) {
      return jsonResponse(400, { error: 'Payment transaction is not an asset transfer' });
    }

    const expectedNote = `treasury_order:${order.id}:${order.purchase_type}`;
    const actualNote = decodeNote(tx.note);
    if (actualNote !== expectedNote) {
      return jsonResponse(400, { error: 'Payment transaction note does not match treasury order' });
    }

    const expectedPaymentAssetId = Number(order.payment_asset_id ?? (order.purchase_type === 'wallet_buy_earl' ? USDC_ASA_ID : EARL_ASA_ID));
    const quantityBaseUnits = orderQuantityBaseUnits(order);
    const expectedPaymentAmount = BigInt(
      order.payment_amount ?? (order.purchase_type === 'wallet_buy_earl'
        ? Number(quoteUsdcFromEarlBaseUnits(quantityBaseUnits, USDC_DECIMALS, EARL_DECIMALS))
        : Number(quantityBaseUnits))
    );

    if (tx.sender !== order.wallet_address) {
      return jsonResponse(400, { error: 'Payment transaction sender does not match order wallet' });
    }
    if (assetTransfer.receiver !== TREASURY_ADDRESS) {
      return jsonResponse(400, { error: 'Payment transaction receiver does not match treasury wallet' });
    }
    if (Number(assetTransfer['asset-id']) !== expectedPaymentAssetId) {
      return jsonResponse(400, { error: 'Payment asset does not match treasury order' });
    }
    if (BigInt(assetTransfer.amount ?? 0) !== expectedPaymentAmount) {
      return jsonResponse(400, { error: 'Payment amount does not match treasury order' });
    }

    // Conditional update to prevent double-settlement from concurrent requests.
    const { data: claimed } = await supabaseAdmin.from('treasury_orders').update({
      payment_tx_id: paymentTxId,
      status: 'wallet_payment_confirmed',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id).in('status', ['created', 'paid']).select('id').maybeSingle();

    if (!claimed) {
      return jsonResponse(200, { ok: true, status: order.status, message: 'Already being processed' });
    }

    if (order.purchase_type === 'wallet_buy_earl' || order.purchase_type === 'wallet_buy_earl_gobtc') {
      if (!EARL_ASA_ID) {
        await supabaseAdmin.from('treasury_orders').update({ status: 'pending_fulfillment', updated_at: new Date().toISOString() }).eq('id', order.id);
        return jsonResponse(200, { ok: true, status: 'pending_fulfillment' });
      }

      const walletOptedIn = await isOptedIn(order.wallet_address, EARL_ASA_ID);
      if (!walletOptedIn) {
        await supabaseAdmin.from('treasury_orders').update({ status: 'pending_optin', updated_at: new Date().toISOString() }).eq('id', order.id);
        return jsonResponse(200, { ok: true, status: 'pending_optin' });
      }

      const earlAmount = quantityBaseUnits;
      try {
        const settlementTxId = await sendAsset(EARL_ASA_ID, order.wallet_address, earlAmount);
        await supabaseAdmin.from('treasury_orders').update({
          status: 'fulfilled',
          tx_id: settlementTxId,
          updated_at: new Date().toISOString(),
        }).eq('id', order.id);
        return jsonResponse(200, { ok: true, status: 'fulfilled', txId: settlementTxId });
      } catch (error) {
        console.error('Wallet buy fulfillment failed:', error?.message || error);
        await supabaseAdmin.from('treasury_orders').update({
          status: 'pending_fulfillment',
          updated_at: new Date().toISOString(),
        }).eq('id', order.id);
        return jsonResponse(200, { ok: true, status: 'pending_fulfillment' });
      }
    }

    const usdcAmount = quoteUsdcFromEarlBaseUnits(quantityBaseUnits, await resolveAssetDecimals(USDC_ASA_ID, USDC_DECIMALS), EARL_DECIMALS);
    if (usdcAmount <= 0n) {
      return jsonResponse(400, { error: 'Computed USDC settlement amount is invalid' });
    }

    try {
      const settlementTxId = await sendAsset(USDC_ASA_ID, order.wallet_address, usdcAmount);
      await supabaseAdmin.from('treasury_orders').update({
        status: 'fulfilled',
        tx_id: settlementTxId,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      return jsonResponse(200, { ok: true, status: 'fulfilled', txId: settlementTxId });
    } catch (error) {
      console.error('Wallet sell fulfillment failed:', error?.message || error);
      await supabaseAdmin.from('treasury_orders').update({
        status: 'pending_fulfillment',
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      return jsonResponse(200, { ok: true, status: 'pending_fulfillment' });
    }
  } catch (error) {
    console.error('Wallet settlement error:', error?.message || error);
    return jsonResponse(500, { error: error?.message ?? 'Unknown wallet settlement error' });
  }
});
