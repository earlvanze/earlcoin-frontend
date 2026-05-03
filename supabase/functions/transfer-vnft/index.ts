/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import algosdk from "https://esm.sh/algosdk@3.5.2";
import { corsHeaders } from "./cors.ts";

const PROJECT_URL = Deno.env.get("PROJECT_URL") ?? "";
const PROJECT_SECRET_KEY = Deno.env.get("PROJECT_SECRET_KEY") ?? "";
const VNFT_ADMIN_MNEMONIC = Deno.env.get("VNFT_ADMIN_MNEMONIC") ?? "";
const ALGOD_URL = Deno.env.get("ALGOD_URL") ?? "https://mainnet-api.4160.nodely.dev";
const INDEXER_URL = Deno.env.get("INDEXER_URL") ?? "https://mainnet-idx.4160.nodely.dev";
const indexerClient = new algosdk.Indexer("", INDEXER_URL, "");

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hasOptedIn(wallet: string, assetId: number) {
  const acct = await indexerClient.lookupAccountByID(wallet).do();
  const assets = acct?.account?.assets || [];
  return assets.some((a: any) => a["asset-id"] === assetId);
}

async function isValidVnft(assetId: number, adminAddr: string) {
  const assetInfo = await indexerClient.lookupAssetByID(assetId).do();
  const params = assetInfo?.asset?.params || {};
  const unitName = params["unit-name"] || params.unitName;
  const creators = [params.creator, params.manager, params.reserve, params.clawback].filter(Boolean);
  if (unitName !== "VNFT") return false;
  return creators.includes(adminAddr);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    if (!PROJECT_URL || !PROJECT_SECRET_KEY) {
      return jsonResponse(500, { error: "Project secret key not configured" });
    }
    const normalizedMnemonic = VNFT_ADMIN_MNEMONIC.trim().replace(/\s+/g, " ");
    if (!normalizedMnemonic) {
      return jsonResponse(500, { error: "VNFT admin mnemonic not configured" });
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("kyc_verified")
      .eq("id", authData.user.id)
      .single();

    if (!profile?.kyc_verified) {
      return jsonResponse(403, { error: "KYC not verified" });
    }

    const body = await req.json();
    const walletAddress = body?.wallet_address;
    const assetId = Number(body?.asset_id);
    if (!walletAddress || !assetId) {
      return jsonResponse(400, { error: "wallet_address and asset_id required" });
    }
    if (!algosdk.isValidAddress(walletAddress)) {
      return jsonResponse(400, { error: "wallet_address invalid" });
    }

    let admin;
    try {
      admin = algosdk.mnemonicToSecretKey(normalizedMnemonic);
    } catch (e) {
      return jsonResponse(500, { error: "Invalid VNFT_ADMIN_MNEMONIC" });
    }
    const adminAddress = typeof admin.addr === "string"
      ? admin.addr
      : admin.addr?.publicKey
        ? algosdk.encodeAddress(admin.addr.publicKey)
        : (admin.addr?.toString?.() ?? "");

    if (!adminAddress || !algosdk.isValidAddress(adminAddress)) {
      return jsonResponse(500, { error: "VNFT_ADMIN_MNEMONIC did not resolve to a valid Algorand address" });
    }
    const validVnft = await isValidVnft(assetId, adminAddress);
    if (!validVnft) {
      return jsonResponse(400, { error: "Invalid VNFT asset" });
    }

    const optedIn = await hasOptedIn(walletAddress, assetId);
    if (!optedIn) {
      return jsonResponse(400, { error: "Recipient has not opted in to the asset" });
    }

    const algodClient = new algosdk.Algodv2("", ALGOD_URL, "");
    const params = await algodClient.getTransactionParams().do();

    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: adminAddress,
      receiver: walletAddress,
      assetIndex: assetId,
      amount: 1,
      suggestedParams: params,
    });

    const signed = txn.signTxn(admin.sk);
    const { txId } = await algodClient.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(algodClient, txId, 4);

    await supabase
      .from("profiles")
      .update({ vnft_asset_id: assetId, vnft_wallet: walletAddress })
      .eq("id", authData.user.id);

    return jsonResponse(200, { txId, assetId });
  } catch (e) {
    return jsonResponse(500, { error: e?.message ?? "Unknown error" });
  }
});
