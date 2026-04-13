/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.12.0";
import { corsHeaders } from "./cors.ts";

const PROJECT_URL = Deno.env.get("PROJECT_URL") ?? "";
const PROJECT_SECRET_KEY = Deno.env.get("PROJECT_SECRET_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_EARL_PRICE_ID = Deno.env.get("STRIPE_EARL_PRICE_ID") ?? "";
const STRIPE_MEMBERSHIP_PRICE_ID = Deno.env.get("STRIPE_MEMBERSHIP_PRICE_ID") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "";
const TREASURY_EARL_USDC_PRICE = Number(Deno.env.get("TREASURY_EARL_USDC_PRICE") ?? "100");
const EARL_DECIMALS = 6;
const MIN_EARL_BASE_UNITS = 10_000;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

const wholeTokenQuantity = (baseUnits) => (baseUnits % 10 ** EARL_DECIMALS === 0 ? baseUnits / 10 ** EARL_DECIMALS : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!PROJECT_URL || !PROJECT_SECRET_KEY) {
      return jsonResponse(500, { error: "Project secret key not configured" });
    }
    if (!STRIPE_SECRET_KEY) {
      return jsonResponse(500, { error: "STRIPE_SECRET_KEY not configured" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing Authorization header" });
    }

    const supabase = createClient(PROJECT_URL, PROJECT_SECRET_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return jsonResponse(401, { error: authErr?.message ?? "Unauthorized" });
    }

    const body = await req.json();
    const userId = body?.user_id;
    const rawPurchaseType = body?.purchase_type ?? "earl";
    const purchaseType = rawPurchaseType === "earl_token" ? "earl" : rawPurchaseType;
    const walletAddress = body?.wallet_address ?? null;

    if (!userId || userId !== authData.user.id) {
      return jsonResponse(403, { error: "User mismatch" });
    }

    const origin = SITE_URL || req.headers.get("Origin") || "";
    const path = purchaseType === "membership" ? "/membership" : "/trade";
    const successUrl = `${origin}${path}?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}${path}?status=cancelled`;

    if (purchaseType === "membership") {
      const priceId = STRIPE_MEMBERSHIP_PRICE_ID;
      if (!priceId) {
        return jsonResponse(400, { error: "Price ID not configured" });
      }
      const quantity = Math.max(1, Number(body?.quantity ?? 1));
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: priceId, quantity }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: userId,
          purchase_type: purchaseType,
          price_id: priceId,
          quantity: String(quantity),
        },
      });
      return jsonResponse(200, { sessionId: session.id });
    }

    const quantityBaseUnits = Math.round(Number(body?.quantity_base_units ?? 0));
    if (!Number.isFinite(quantityBaseUnits) || quantityBaseUnits < MIN_EARL_BASE_UNITS) {
      return jsonResponse(400, { error: "Minimum order size is 0.01 EARL" });
    }

    const totalUsdc = Number(((quantityBaseUnits / 10 ** EARL_DECIMALS) * TREASURY_EARL_USDC_PRICE).toFixed(2));
    const unitAmountCents = Math.round(totalUsdc * 100);
    if (!Number.isFinite(totalUsdc) || totalUsdc <= 0 || unitAmountCents < 50) {
      return jsonResponse(400, { error: "Invalid treasury checkout total" });
    }

    const displayQuantity = (quantityBaseUnits / 10 ** EARL_DECIMALS).toFixed(4).replace(/\.?(0+)$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "EARL Treasury Purchase",
              description: `${displayQuantity} EARL @ $${TREASURY_EARL_USDC_PRICE.toFixed(2)} treasury reference price`,
            },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        purchase_type: purchaseType,
        wallet_address: walletAddress ?? "",
        price_id: body?.price_id ?? STRIPE_EARL_PRICE_ID ?? "",
        quantity: String(wholeTokenQuantity(quantityBaseUnits) ?? ""),
        quantity_base_units: String(quantityBaseUnits),
        total_usdc: totalUsdc.toFixed(2),
      },
    });

    await supabase.from("treasury_orders").insert({
      user_id: userId,
      wallet_address: walletAddress,
      purchase_type: purchaseType,
      price_id: body?.price_id ?? STRIPE_EARL_PRICE_ID ?? null,
      quantity: wholeTokenQuantity(quantityBaseUnits),
      quantity_base_units: quantityBaseUnits,
      stripe_session_id: session.id,
      status: "created",
    });

    return jsonResponse(200, { sessionId: session.id });
  } catch (e) {
    return jsonResponse(500, { error: e?.message ?? "Unknown error" });
  }
});
