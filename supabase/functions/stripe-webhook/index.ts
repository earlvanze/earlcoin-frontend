import { corsHeaders } from './cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';
import Stripe from 'https://esm.sh/stripe@14.12.0';
import algosdk from 'https://esm.sh/algosdk@3.5.2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const TREASURY_MNEMONIC = Deno.env.get('TREASURY_MNEMONIC') ?? '';
const VNFT_ADMIN_MNEMONIC = Deno.env.get('VNFT_ADMIN_MNEMONIC') ?? '';
const GOV_ADMIN_MNEMONIC = Deno.env.get('GOV_ADMIN_MNEMONIC') ?? '';
const TREASURY_ADDRESS = Deno.env.get('TREASURY_ADDRESS') ?? '';
const DEFAULT_GOV_ADMIN_ADDRESS = 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU';
const CUSTODY_HOT_ADDRESS = Deno.env.get('CUSTODY_HOT_ADDRESS') ?? Deno.env.get('GOV_ADMIN_ADDRESS') ?? DEFAULT_GOV_ADMIN_ADDRESS;
const CUSTODY_WALLET_ROLE = Deno.env.get('CUSTODY_HOT_ADDRESS') ? 'CUSTODY_HOT' : 'GOV_ADMIN';
const ALGOD_URL = Deno.env.get('ALGOD_URL') ?? 'https://mainnet-api.4160.nodely.dev';
const EARL_ASA_ID = Number(Deno.env.get('EARL_ASA_ID') ?? '0');
const EARL_DECIMALS = Number(Deno.env.get('EARL_ASA_DECIMALS') ?? '6');

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
const supabaseAdmin = createClient(PROJECT_URL, PROJECT_SECRET_KEY);
const algodClient = new algosdk.Algodv2('', ALGOD_URL, '');
const normalizeMnemonic = (value) => (value || '').trim().replace(/\s+/g, ' ');

async function getHolding(address, assetId) {
  const info = await algodClient.accountInformation(address).do();
  const holding = (info?.assets || []).find((a) => Number(a['asset-id'] ?? a.assetId) === assetId);
  return { info, holdingAmount: BigInt(holding?.amount ?? 0) };
}

async function resolveTreasurySigner(minAmount) {
  const signerPhrases = [GOV_ADMIN_MNEMONIC, TREASURY_MNEMONIC, VNFT_ADMIN_MNEMONIC]
    .map(normalizeMnemonic)
    .filter(Boolean);
  if (!TREASURY_ADDRESS) return null;
  for (const phrase of signerPhrases) {
    try {
      const acct = algosdk.mnemonicToSecretKey(phrase);
      const signerAddr = typeof acct.addr === 'string' ? acct.addr : algosdk.encodeAddress(acct.addr.publicKey);
      const treasuryInfo = await algodClient.accountInformation(TREASURY_ADDRESS).do();
      const authAddr = treasuryInfo?.['auth-addr'] || null;
      const treasuryHolding = (treasuryInfo?.assets || []).find((a) => Number(a['asset-id'] ?? a.assetId) === EARL_ASA_ID);
      const treasuryBalance = BigInt(treasuryHolding?.amount ?? 0);
      const treasuryAlgo = BigInt(treasuryInfo?.amount ?? 0);
      const signerMatches = !authAddr ? signerAddr === TREASURY_ADDRESS : signerAddr === authAddr;
      if (signerMatches && treasuryBalance >= minAmount && treasuryAlgo > 200000n) {
        return { acct, sender: TREASURY_ADDRESS };
      }
    } catch {}
  }
  return null;
}

async function isOptedIn(address) {
  if (!address || !algosdk.isValidAddress(address)) return false;
  const { info } = await getHolding(address, EARL_ASA_ID);
  const assets = info?.assets || [];
  return assets.some((a) => Number(a['asset-id'] ?? a.assetId) === EARL_ASA_ID);
}

async function sendEarl(walletAddress, quantityBaseUnits) {
  const amount = BigInt(quantityBaseUnits);
  const signer = await resolveTreasurySigner(amount);
  if (!signer) {
    throw new Error('No treasury signer available for EARL fulfillment');
  }
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Transfer amount exceeds safe integer range');
  }
  const params = await algodClient.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: signer.sender,
    to: walletAddress,
    assetIndex: EARL_ASA_ID,
    amount: Number(amount),
    suggestedParams: params,
  });
  const signed = txn.signTxn(signer.acct.sk);
  const { txId } = await algodClient.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  return txId;
}

async function ensureCustodyAccount(userId, defaultAlgorandAddress = null) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('custody_accounts')
    .select('id, default_algorand_address')
    .eq('user_id', userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) {
    if (!existing.default_algorand_address && defaultAlgorandAddress) {
      await supabaseAdmin
        .from('custody_accounts')
        .update({ default_algorand_address: defaultAlgorandAddress, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return existing.id;
  }
  const { data: created, error: createError } = await supabaseAdmin
    .from('custody_accounts')
    .insert({ user_id: userId, status: 'active', default_algorand_address: defaultAlgorandAddress })
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id;
}

async function creditCustodyBalance({ userId, custodyAccountId, amountBaseUnits, orderId, reserveWalletRole, reserveWalletAddress, reserveTxId }) {
  const assetId = EARL_ASA_ID;
  const amount = Number(amountBaseUnits);
  const { data: existingBalance, error: balanceError } = await supabaseAdmin
    .from('custody_balances')
    .select('id, available_base_units')
    .eq('custody_account_id', custodyAccountId)
    .eq('asset_id', assetId)
    .maybeSingle();
  if (balanceError) throw balanceError;

  if (existingBalance?.id) {
    // Atomic increment to prevent race conditions on concurrent credits.
    const { error } = await supabaseAdmin.rpc('credit_custody_balance', {
      p_balance_id: existingBalance.id,
      p_amount: amount,
    });
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from('custody_balances')
      .insert({
        custody_account_id: custodyAccountId,
        asset_id: assetId,
        available_base_units: amount,
        locked_base_units: 0,
      });
    if (error) throw error;
  }

  const { error: ledgerError } = await supabaseAdmin
    .from('custody_ledger_entries')
    .insert({
      custody_account_id: custodyAccountId,
      user_id: userId,
      asset_id: assetId,
      amount_base_units: amount,
      entry_type: 'purchase_credit',
      reference_type: 'treasury_order',
      reference_id: orderId,
      tx_id: reserveTxId ?? null,
      metadata: {
        reserve_wallet_role: reserveWalletRole,
        reserve_wallet_address: reserveWalletAddress,
      },
    });
  if (ledgerError) throw ledgerError;
}

async function reserveIntoCustody(quantityBaseUnits) {
  if (!EARL_ASA_ID || !CUSTODY_HOT_ADDRESS || !algosdk.isValidAddress(CUSTODY_HOT_ADDRESS)) {
    return {
      status: 'pending_custody_reserve',
      reserveTxId: null,
      reserveWalletRole: CUSTODY_WALLET_ROLE,
      reserveWalletAddress: CUSTODY_HOT_ADDRESS || null,
    };
  }
  const optedIn = await isOptedIn(CUSTODY_HOT_ADDRESS);
  if (!optedIn) {
    return {
      status: 'pending_custody_optin',
      reserveTxId: null,
      reserveWalletRole: CUSTODY_WALLET_ROLE,
      reserveWalletAddress: CUSTODY_HOT_ADDRESS,
    };
  }
  try {
    const reserveTxId = await sendEarl(CUSTODY_HOT_ADDRESS, quantityBaseUnits);
    return {
      status: 'custodied',
      reserveTxId,
      reserveWalletRole: CUSTODY_WALLET_ROLE,
      reserveWalletAddress: CUSTODY_HOT_ADDRESS,
    };
  } catch (error) {
    console.error('Custody reserve move failed:', error?.message || error);
    return {
      status: 'pending_custody_reserve',
      reserveTxId: null,
      reserveWalletRole: CUSTODY_WALLET_ROLE,
      reserveWalletAddress: CUSTODY_HOT_ADDRESS,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'identity.verification_session.verified': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        if (!userId) throw new Error('User ID not found in verification session metadata.');
        const { error } = await supabaseAdmin.from('profiles').update({ kyc_verified: true }).eq('id', userId);
        if (error) throw error;

        // Auto-mint VNFT after KYC verification
        try {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('vnft_asset_id, vnft_wallet')
            .eq('id', userId)
            .single();

          if (!profile?.vnft_asset_id) {
            // Trigger mint-vnft internally
            const walletAddress = profile?.vnft_wallet || session.metadata?.wallet_address;
            if (walletAddress) {
              const mintRes = await fetch(`${PROJECT_URL}/functions/v1/mint-vnft`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${PROJECT_SECRET_KEY}`,
                  'apikey': PROJECT_SECRET_KEY,
                },
                body: JSON.stringify({ wallet_address: walletAddress, user_id: userId, _internal: true }),
              });
              const mintData = await mintRes.json().catch(() => ({}));
              console.log('stripe-webhook:auto-mint-vnft', { userId, walletAddress, status: mintRes.status, mintStatus: mintData?.status, assetId: mintData?.assetId });
            }
          }
        } catch (mintErr) {
          // Non-fatal: user can still mint manually from verification-complete page
          console.error('stripe-webhook:auto-mint-vnft-failed', { userId, error: String(mintErr) });
        }
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        if (!userId) throw new Error('User ID not found in checkout session metadata.');

        const rawPurchaseType = session.metadata?.purchase_type ?? 'membership';
        const purchaseType = rawPurchaseType === 'earl_token' ? 'earl' : rawPurchaseType;
        const walletAddress = session.metadata?.wallet_address || null;
        const priceId = session.metadata?.price_id || null;
        const quantity = Number(session.metadata?.quantity ?? 1);
        const quantityBaseUnits = Number(session.metadata?.quantity_base_units ?? Math.round(quantity * 1_000_000));

        if (purchaseType === 'membership') {
          const { error } = await supabaseAdmin.from('profiles').update({ has_membership: true }).eq('id', userId);
          if (error) throw error;
          break;
        }

        if (purchaseType === 'earl') {
          const { data: existing } = await supabaseAdmin
            .from('treasury_orders')
            .select('id,status,custody_account_id')
            .eq('stripe_session_id', session.id)
            .maybeSingle();

          if (['fulfilled', 'custodied'].includes(existing?.status || '')) break;

          const directWalletFulfillment = !!walletAddress && algosdk.isValidAddress(walletAddress);
          const orderPayload = {
            user_id: userId,
            wallet_address: walletAddress,
            purchase_type: 'earl',
            price_id: priceId,
            quantity,
            quantity_base_units: quantityBaseUnits,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent ?? null,
            fulfillment_mode: directWalletFulfillment ? 'wallet' : 'custody',
            reserve_wallet_role: directWalletFulfillment ? null : CUSTODY_WALLET_ROLE,
            reserve_wallet_address: directWalletFulfillment ? null : CUSTODY_HOT_ADDRESS,
            status: 'paid',
            updated_at: new Date().toISOString(),
          };

          let orderId = existing?.id ?? null;
          if (orderId) {
            const { error } = await supabaseAdmin.from('treasury_orders').update(orderPayload).eq('id', orderId);
            if (error) throw error;
          } else {
            const { data: inserted, error } = await supabaseAdmin.from('treasury_orders').insert(orderPayload).select('id').single();
            if (error) throw error;
            orderId = inserted.id;
          }

          if (!directWalletFulfillment) {
            const custodyAccountId = existing?.custody_account_id ?? await ensureCustodyAccount(userId, walletAddress);
            const reserveResult = await reserveIntoCustody(quantityBaseUnits);
            await creditCustodyBalance({
              userId,
              custodyAccountId,
              amountBaseUnits: quantityBaseUnits,
              orderId,
              reserveWalletRole: reserveResult.reserveWalletRole,
              reserveWalletAddress: reserveResult.reserveWalletAddress,
              reserveTxId: reserveResult.reserveTxId,
            });
            await supabaseAdmin.from('treasury_orders').update({
              custody_account_id: custodyAccountId,
              reserve_wallet_role: reserveResult.reserveWalletRole,
              reserve_wallet_address: reserveResult.reserveWalletAddress,
              reserve_tx_id: reserveResult.reserveTxId,
              status: reserveResult.status,
              updated_at: new Date().toISOString(),
            }).eq('id', orderId);
            break;
          }

          if (!EARL_ASA_ID) {
            await supabaseAdmin.from('treasury_orders').update({ status: 'pending_fulfillment' }).eq('id', orderId);
            break;
          }

          const optedIn = await isOptedIn(walletAddress);
          if (!optedIn) {
            await supabaseAdmin.from('treasury_orders').update({ status: 'pending_optin' }).eq('id', orderId);
            break;
          }

          try {
            const txId = await sendEarl(walletAddress, quantityBaseUnits);
            await supabaseAdmin.from('treasury_orders').update({
              status: 'fulfilled',
              tx_id: txId,
              updated_at: new Date().toISOString(),
            }).eq('id', orderId);
          } catch (fulfillError) {
            console.error('Auto-fulfillment failed:', fulfillError?.message || fulfillError);
            await supabaseAdmin.from('treasury_orders').update({
              status: 'pending_fulfillment',
              updated_at: new Date().toISOString(),
            }).eq('id', orderId);
          }
        }
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    // Return 200 to prevent Stripe from retrying for up to 3 days on non-transient
    // errors (e.g. data integrity issues). Log for manual review.
    console.error('Error processing webhook (non-retryable):', error.message);
    return new Response(JSON.stringify({ error: error.message, retryable: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
