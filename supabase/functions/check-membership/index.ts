/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PROJECT_URL = Deno.env.get("PROJECT_URL") ?? "";
const PROJECT_SECRET_KEY = Deno.env.get("PROJECT_SECRET_KEY") ?? "";
const ALGOD_URL = Deno.env.get("ALGOD_URL") ?? "https://mainnet-api.4160.nodely.dev";
const EARL_ASA_ID = 3497993904;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const body = await req.json().catch(() => ({}));
    const walletAddress = body?.wallet_address;

    if (!walletAddress) {
      return jsonResponse(400, { error: "wallet_address required" });
    }

    // Check EARL balance via Algorand indexer
    const indexerUrl = `${ALGOD_URL.replace("mainnet-api", "mainnet-idx")}/v2/accounts/${walletAddress}/assets/${EARL_ASA_ID}`;
    const indexerRes = await fetch(indexerUrl);
    let earlBalance = 0;

    if (indexerRes.ok) {
      const assetData = await indexerRes.json();
      earlBalance = assetData?.asset?.["asset-holding"]?.amount ?? assetData?.amount ?? 0;
    }
    // If 404, the wallet doesn't hold this asset — balance stays 0

    const hasEarlTokens = earlBalance > 0;

    // Update membership flag
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ has_membership: hasEarlTokens, updated_at: new Date().toISOString() })
      .eq("id", authData.user.id);

    if (updateErr) {
      console.error("check-membership:update-error", updateErr);
      return jsonResponse(500, { error: "Failed to update membership status" });
    }

    return jsonResponse(200, {
      has_membership: hasEarlTokens,
      earl_balance: earlBalance,
      wallet_address: walletAddress,
    });
  } catch (e) {
    console.error("check-membership:error", e);
    return jsonResponse(500, { error: "Internal error" });
  }
});