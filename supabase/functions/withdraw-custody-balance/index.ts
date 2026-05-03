import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';
import algosdk from 'https://esm.sh/algosdk@3.5.2';

const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const ALGOD_URL = Deno.env.get('ALGOD_URL') ?? 'https://mainnet-api.4160.nodely.dev';
const EARL_ASA_ID = Number(Deno.env.get('EARL_ASA_ID') ?? '0');
const DEFAULT_GOV_ADMIN_ADDRESS = 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU';
const CUSTODY_HOT_ADDRESS = Deno.env.get('CUSTODY_HOT_ADDRESS') ?? Deno.env.get('GOV_ADMIN_ADDRESS') ?? DEFAULT_GOV_ADMIN_ADDRESS;
const CUSTODY_WALLET_ROLE = Deno.env.get('CUSTODY_HOT_ADDRESS') ? 'CUSTODY_HOT' : 'GOV_ADMIN';
const VNFT_ADMIN_MNEMONIC = Deno.env.get('VNFT_ADMIN_MNEMONIC') ?? '';
const GOV_ADMIN_MNEMONIC = Deno.env.get('GOV_ADMIN_MNEMONIC') ?? '';
const TREASURY_MNEMONIC = Deno.env.get('TREASURY_MNEMONIC') ?? '';

const supabaseAdmin = createClient(PROJECT_URL, PROJECT_SECRET_KEY);
const algodClient = new algosdk.Algodv2('', ALGOD_URL, '');

const normalizeMnemonic = (value: string) => (value || '').trim().replace(/\s+/g, ' ');
const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function isOptedIn(walletAddress: string, assetId: number) {
  const acct = await algodClient.accountInformation(walletAddress).do();
  const assets = acct?.assets || [];
  return assets.some((a: any) => Number(a['asset-id'] ?? a.assetId) === assetId);
}

async function resolveCustodySigner(minAmount: bigint) {
  if (!CUSTODY_HOT_ADDRESS || !algosdk.isValidAddress(CUSTODY_HOT_ADDRESS)) return null;

  const signerPhrases = [VNFT_ADMIN_MNEMONIC, GOV_ADMIN_MNEMONIC, TREASURY_MNEMONIC]
    .map(normalizeMnemonic)
    .filter(Boolean);

  const custodyInfo = await algodClient.accountInformation(CUSTODY_HOT_ADDRESS).do();
  const authAddr = custodyInfo?.['auth-addr'] || null;
  const custodyHolding = (custodyInfo?.assets || []).find((a: any) => Number(a['asset-id'] ?? a.assetId) === EARL_ASA_ID);
  const custodyBalance = BigInt(custodyHolding?.amount ?? 0);
  const custodyAlgo = BigInt(custodyInfo?.amount ?? 0);
  if (custodyBalance < minAmount || custodyAlgo <= 200000n) return null;

  for (const phrase of signerPhrases) {
    try {
      const acct = algosdk.mnemonicToSecretKey(phrase);
      const signerAddr = typeof acct.addr === 'string' ? acct.addr : algosdk.encodeAddress(acct.addr.publicKey);
      const signerMatches = !authAddr ? signerAddr === CUSTODY_HOT_ADDRESS : signerAddr === authAddr;
      if (signerMatches) {
        return { acct, sender: CUSTODY_HOT_ADDRESS };
      }
    } catch {}
  }
  return null;
}

async function sendEarl(to: string, amount: bigint) {
  const signer = await resolveCustodySigner(amount);
  if (!signer) throw new Error('Custody wallet signer/liquidity not available');
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Withdrawal amount exceeds safe integer range');

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return jsonResponse(401, { error: 'Missing Authorization header' });

    const supabase = createClient(PROJECT_URL, PROJECT_SECRET_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return jsonResponse(401, { error: authErr?.message ?? 'Unauthorized' });

    const body = await req.json();
    const destinationWallet = String(body?.destination_wallet ?? '').trim();
    const rawAmount = Number(body?.amount_base_units ?? 0);
    if (!Number.isFinite(rawAmount) || !Number.isInteger(rawAmount) || rawAmount <= 0) {
      return jsonResponse(400, { error: 'amount_base_units must be a positive integer' });
    }
    const amountBaseUnits = BigInt(rawAmount);
    if (!destinationWallet || !algosdk.isValidAddress(destinationWallet)) {
      return jsonResponse(400, { error: 'A valid Algorand destination wallet is required' });
    }
    if (!await isOptedIn(destinationWallet, EARL_ASA_ID)) {
      return jsonResponse(400, { error: 'Destination wallet must opt into EARL before withdrawal' });
    }

    const { data: custodyAccount, error: custodyError } = await supabaseAdmin
      .from('custody_accounts')
      .select('id')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (custodyError) return jsonResponse(500, { error: custodyError.message });
    if (!custodyAccount?.id) return jsonResponse(404, { error: 'No custody account found for this user' });

    // Atomic balance decrement to prevent TOCTOU double-spend.
    const { data: debitedRow, error: debitError } = await supabaseAdmin.rpc('debit_custody_balance', {
      p_custody_account_id: custodyAccount.id,
      p_asset_id: EARL_ASA_ID,
      p_amount: Number(amountBaseUnits),
    });

    if (debitError || !debitedRow) {
      return jsonResponse(400, { error: 'Insufficient custodial EARL balance' });
    }
    const balanceRow = debitedRow;

    const { data: withdrawal, error: requestError } = await supabaseAdmin
      .from('withdrawal_requests')
      .insert({
        custody_account_id: custodyAccount.id,
        user_id: authData.user.id,
        asset_id: EARL_ASA_ID,
        amount_base_units: Number(amountBaseUnits),
        destination_wallet: destinationWallet,
        status: 'processing',
        metadata: { reserve_wallet_role: CUSTODY_WALLET_ROLE, reserve_wallet_address: CUSTODY_HOT_ADDRESS },
      })
      .select('id')
      .single();
    if (requestError) return jsonResponse(500, { error: requestError.message });

    try {
      const txId = await sendEarl(destinationWallet, amountBaseUnits);
      const now = new Date().toISOString();

      const { error: ledgerError } = await supabaseAdmin
        .from('custody_ledger_entries')
        .insert({
          custody_account_id: custodyAccount.id,
          user_id: authData.user.id,
          asset_id: EARL_ASA_ID,
          amount_base_units: -Number(amountBaseUnits),
          entry_type: 'withdrawal',
          reference_type: 'withdrawal_request',
          reference_id: withdrawal.id,
          tx_id: txId,
          metadata: { destination_wallet: destinationWallet, reserve_wallet_role: CUSTODY_WALLET_ROLE },
        });
      if (ledgerError) throw ledgerError;

      const { error: finishError } = await supabaseAdmin
        .from('withdrawal_requests')
        .update({ status: 'fulfilled', tx_id: txId, updated_at: now })
        .eq('id', withdrawal.id);
      if (finishError) throw finishError;

      return jsonResponse(200, { ok: true, txId, withdrawalRequestId: withdrawal.id });
    } catch (error) {
      await supabaseAdmin
        .from('withdrawal_requests')
        .update({ status: 'failed', metadata: { reserve_wallet_role: CUSTODY_WALLET_ROLE, reserve_wallet_address: CUSTODY_HOT_ADDRESS, error: error?.message ?? 'Unknown failure' }, updated_at: new Date().toISOString() })
        .eq('id', withdrawal.id);
      return jsonResponse(500, { error: error?.message ?? 'Withdrawal failed' });
    }
  } catch (error) {
    return jsonResponse(500, { error: error?.message ?? 'Unknown withdrawal error' });
  }
});
