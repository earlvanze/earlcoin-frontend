import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';
import algosdk from 'https://esm.sh/algosdk@3.5.2';

const PROJECT_URL = Deno.env.get('PROJECT_URL') ?? '';
const PROJECT_SECRET_KEY = Deno.env.get('PROJECT_SECRET_KEY') ?? '';
const STRIKE_API_KEY = Deno.env.get('STRIKE_API_KEY') ?? '';
const STRIKE_API_URL = 'https://api.strike.me';
const TREASURY_EARL_USDC_PRICE = Number(Deno.env.get('TREASURY_EARL_USDC_PRICE') ?? '100');
const EARL_DECIMALS = Number(Deno.env.get('EARL_ASA_DECIMALS') ?? '6');
const MIN_EARL_BASE_UNITS = 10_000;

const supabaseAdmin = createClient(PROJECT_URL, PROJECT_SECRET_KEY);

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function strikePost(path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${STRIKE_API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIKE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strike ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!STRIKE_API_KEY) {
      return jsonResponse(500, { error: 'STRIKE_API_KEY not configured' });
    }

    // Authenticate the user via Supabase JWT.
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

    if (walletAddress && !algosdk.isValidAddress(walletAddress)) {
      return jsonResponse(400, { error: 'Invalid Algorand wallet address' });
    }

    const quantityBaseUnits = Math.round(Number(body?.quantity_base_units ?? 0));

    if (!Number.isFinite(quantityBaseUnits) || quantityBaseUnits < MIN_EARL_BASE_UNITS) {
      return jsonResponse(400, { error: 'quantity_base_units is required and must meet minimum order size' });
    }

    // Compute USD amount server-side — never trust client-supplied prices.
    const usdAmount = Number(((quantityBaseUnits / 10 ** EARL_DECIMALS) * TREASURY_EARL_USDC_PRICE).toFixed(2));
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      return jsonResponse(400, { error: 'Computed USD amount is invalid' });
    }
    const quantity = quantityBaseUnits / 10 ** EARL_DECIMALS;

    // 1. Create a Strike invoice denominated in USD.
    const correlationId = crypto.randomUUID();
    const invoice = await strikePost('/v1/invoices', {
      correlationId,
      description: `EARLcoin purchase — ${quantity} EARL`,
      amount: {
        currency: 'USD',
        amount: String(usdAmount),
      },
    });

    const invoiceId: string = invoice.invoiceId;

    // 2. Generate a quote to get the BOLT11 Lightning invoice.
    const quote = await strikePost(`/v1/invoices/${invoiceId}/quote`);

    // 3. Create the treasury order.
    const { data: order, error: orderError } = await supabaseAdmin
      .from('treasury_orders')
      .insert({
        user_id: userId,
        wallet_address: walletAddress,
        purchase_type: 'lightning_buy_earl',
        quantity,
        quantity_base_units: quantityBaseUnits,
        status: 'awaiting_lightning_payment',
        payment_amount: usdAmount,
        fulfillment_mode: 'lightning',
        strike_invoice_id: invoiceId,
        strike_correlation_id: correlationId,
      })
      .select('id')
      .single();

    if (orderError) {
      return jsonResponse(500, { error: orderError.message });
    }

    return jsonResponse(200, {
      ok: true,
      order_id: order.id,
      strike_invoice_id: invoiceId,
      ln_invoice: quote.lnInvoice,
      expires_at: quote.expiration,
      source_amount: quote.sourceAmount,
      target_amount: quote.targetAmount,
      conversion_rate: quote.conversionRate,
      earl_usd_rate: TREASURY_EARL_USDC_PRICE,
    });
  } catch (error) {
    console.error('create-lightning-invoice error:', error?.message || error);
    return jsonResponse(500, { error: error?.message ?? 'Unknown error' });
  }
});
