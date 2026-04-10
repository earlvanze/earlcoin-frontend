import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const TREASURY_ADDRESS = Deno.env.get('TREASURY_ADDRESS') ?? '';
const GOBTC_ASA_ID = Number(Deno.env.get('GOBTC_ASA_ID') ?? '386192725');

// Bridge provider configuration.
// Set BTC_BRIDGE_API_URL and BTC_BRIDGE_API_KEY to the goBTC bridge
// endpoint that accepts { btc_amount, algorand_recipient } and returns
// { btc_address, expires_at }.  When the env vars are absent the function
// falls back to a static treasury BTC deposit address so that manual
// settlement can still proceed.
const BTC_BRIDGE_API_URL = Deno.env.get('BTC_BRIDGE_API_URL') ?? '';
const BTC_BRIDGE_API_KEY = Deno.env.get('BTC_BRIDGE_API_KEY') ?? '';
const BTC_FALLBACK_ADDRESS = Deno.env.get('BTC_FALLBACK_ADDRESS') ?? '';

const supabaseAdmin = createClient(PROJECT_URL, PROJECT_SECRET_KEY);

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function requestBridgeAddress(
  btcAmount: number,
  algorandRecipient: string,
): Promise<{ btc_address: string; expires_at: string | null }> {
  if (BTC_BRIDGE_API_URL) {
    const res = await fetch(BTC_BRIDGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BTC_BRIDGE_API_KEY ? { Authorization: `Bearer ${BTC_BRIDGE_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        btc_amount: btcAmount,
        algorand_recipient: algorandRecipient,
        algorand_asset_id: GOBTC_ASA_ID,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Bridge API returned ${res.status}: ${text}`);
    }

    const data = await res.json();
    return {
      btc_address: data.btc_address || data.address || data.deposit_address,
      expires_at: data.expires_at || data.expiry || null,
    };
  }

  // Fallback: return a static BTC address for manual bridging.
  if (!BTC_FALLBACK_ADDRESS) {
    throw new Error('No bridge API or fallback BTC address configured');
  }

  return {
    btc_address: BTC_FALLBACK_ADDRESS,
    expires_at: null,
  };
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

    // The goBTC bridge delivers to the treasury wallet directly so the
    // treasury can settle EARL from its own inventory.
    const algorandRecipient = TREASURY_ADDRESS;
    if (!algorandRecipient) {
      return jsonResponse(500, { error: 'Treasury address not configured' });
    }

    // Convert gobtcAmount (base units, 8 decimals) to BTC for the bridge API.
    const btcDecimal = Number(gobtcAmount) / 1e8;

    const bridge = await requestBridgeAddress(btcDecimal, algorandRecipient);

    if (!bridge.btc_address) {
      return jsonResponse(502, { error: 'Bridge did not return a deposit address' });
    }

    // Create treasury order to track this BTC deposit.
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

    // Persist bridge details for reconciliation.
    await supabaseAdmin.from('treasury_orders').update({
      reserve_wallet_address: bridge.btc_address,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);

    return jsonResponse(200, {
      ok: true,
      order_id: order.id,
      btc_address: bridge.btc_address,
      btc_amount: btcDecimal,
      expires_at: bridge.expires_at,
      btc_usd_rate: btcUsdRate,
      earl_usd_rate: earlUsdRate,
    });
  } catch (error) {
    console.error('create-btc-deposit error:', error?.message || error);
    return jsonResponse(500, { error: error?.message ?? 'Unknown error creating BTC deposit' });
  }
});
