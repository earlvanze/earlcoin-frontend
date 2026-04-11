import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const TREASURY_ADDRESS = Deno.env.get('TREASURY_ADDRESS') ?? '';
const GOBTC_ASA_ID = Number(Deno.env.get('GOBTC_ASA_ID') ?? '386192725');

// DAO treasury BTC address.  All BTC deposits land here.
// Each order is identified by a unique satoshi amount (base + order suffix).
const BTC_TREASURY_ADDRESS = Deno.env.get('BTC_TREASURY_ADDRESS') ?? '';

// mempool.space is the most reliable public Bitcoin API.
// Self-hosted instances can be pointed to via this env var.
const MEMPOOL_API = Deno.env.get('MEMPOOL_API_URL') ?? 'https://mempool.space/api';

// Order expiry window (2 hours).
const DEPOSIT_TTL_MS = 2 * 60 * 60 * 1000;

const supabaseAdmin = createClient(PROJECT_URL, PROJECT_SECRET_KEY);

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Add a deterministic satoshi suffix (1–9999 sats) to the base BTC amount
// so each deposit is uniquely identifiable on-chain at the treasury address.
function tagAmount(baseSats: number, orderId: string): number {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = ((hash << 5) - hash + orderId.charCodeAt(i)) | 0;
  }
  const suffix = (Math.abs(hash) % 9999) + 1; // 1–9999
  return baseSats + suffix;
}

// Verify the treasury BTC address is valid via mempool.space.
async function verifyBtcAddress(address: string): Promise<boolean> {
  try {
    const res = await fetch(`${MEMPOOL_API}/address/${address}`);
    return res.ok;
  } catch {
    return false;
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
    if (!BTC_TREASURY_ADDRESS) {
      return jsonResponse(500, { error: 'BTC_TREASURY_ADDRESS not configured' });
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
    const userId = authData.user.id;
    const walletAddress = body?.wallet_address || null;
    const quantity = body?.quantity;
    const quantityBaseUnits = body?.quantity_base_units;
    const gobtcAmount = body?.gobtc_amount;
    const btcUsdRate = body?.btc_usd_rate;
    const earlUsdRate = body?.earl_usd_rate;

    if (!quantityBaseUnits || !gobtcAmount) {
      return jsonResponse(400, { error: 'quantity_base_units and gobtc_amount are required' });
    }

    // Verify the BTC address is reachable on mempool.space.
    const addressValid = await verifyBtcAddress(BTC_TREASURY_ADDRESS);
    if (!addressValid) {
      return jsonResponse(502, { error: 'Treasury BTC address could not be verified on-chain' });
    }

    // Create treasury order first so we have an ID for amount tagging.
    const { data: order, error: orderError } = await supabaseAdmin
      .from('treasury_orders')
      .insert({
        user_id: userId,
        wallet_address: walletAddress,
        purchase_type: 'btc_bridge_buy_earl',
        quantity,
        quantity_base_units: quantityBaseUnits,
        status: 'awaiting_btc_deposit',
        payment_asset_id: GOBTC_ASA_ID,
        payment_amount: gobtcAmount,
        fulfillment_mode: 'btc_bridge',
      })
      .select('id')
      .single();

    if (orderError) {
      return jsonResponse(500, { error: orderError.message });
    }

    // Compute the tagged satoshi amount so the monitor can match this deposit.
    const baseSats = Number(gobtcAmount); // gobtcAmount is already in sats (8 decimals)
    const taggedSats = tagAmount(baseSats, order.id);
    const taggedBtc = taggedSats / 1e8;

    const expiresAt = new Date(Date.now() + DEPOSIT_TTL_MS).toISOString();

    // Persist the exact expected amount and BTC address for the monitor.
    await supabaseAdmin.from('treasury_orders').update({
      reserve_wallet_address: BTC_TREASURY_ADDRESS,
      payment_amount: taggedSats,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);

    return jsonResponse(200, {
      ok: true,
      order_id: order.id,
      btc_address: BTC_TREASURY_ADDRESS,
      btc_amount: taggedBtc,
      btc_amount_sats: taggedSats,
      expires_at: expiresAt,
      btc_usd_rate: btcUsdRate,
      earl_usd_rate: earlUsdRate,
    });
  } catch (error) {
    console.error('create-btc-deposit error:', error?.message || error);
    return jsonResponse(500, { error: error?.message ?? 'Unknown error creating BTC deposit' });
  }
});
