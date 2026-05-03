/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import algosdk from "https://esm.sh/algosdk@3.5.2";
import { corsHeaders } from "./cors.ts";

const PROJECT_URL = Deno.env.get("PROJECT_URL") ?? "";
const PROJECT_SECRET_KEY = Deno.env.get("PROJECT_SECRET_KEY") ?? "";
const VNFT_ADMIN_MNEMONIC = Deno.env.get("VNFT_ADMIN_MNEMONIC") ?? "";
const ALGOD_URL = Deno.env.get("ALGOD_URL") ?? "https://mainnet-api.4160.nodely.dev";
const INDEXER_URL = Deno.env.get("INDEXER_URL") ?? "https://mainnet-idx.4160.nodely.dev";
const EARL_ASA_ID = Number(Deno.env.get("EARL_ASA_ID") ?? "3497993904");

const indexerClient = new algosdk.Indexer("", INDEXER_URL, "");

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serializeError(e: unknown) {
  if (!e || typeof e !== "object") return { message: String(e) };
  const err = e as Record<string, unknown>;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    cause: err.cause,
  };
}

async function findExistingVnftAsset(adminAddress: string, assetName: string) {
  try {
    const res = await indexerClient.searchForAssets().creator(adminAddress).name(assetName).limit(5).do();
    const assets = res?.assets || [];
    if (!assets.length) return null;
    let latest = assets[0];
    for (const asset of assets) {
      if ((asset["created-at-round"] ?? 0) > (latest["created-at-round"] ?? 0)) {
        latest = asset;
      }
    }
    return latest?.index ?? null;
  } catch {
    return null;
  }
}

async function checkEarlOwnership(walletAddress: string): Promise<boolean> {
  try {
    const indexerBase = ALGOD_URL.replace("mainnet-api", "mainnet-idx");
    const url = `${indexerBase}/v2/accounts/${walletAddress}/assets/${EARL_ASA_ID}`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    const amount = data?.asset?.["asset-holding"]?.amount ?? data?.amount ?? 0;
    return amount > 0;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const requestId = crypto.randomUUID();
  try {
    console.log("mint-vnft:request", { requestId });
    const normalizedMnemonic = VNFT_ADMIN_MNEMONIC.trim().replace(/\s+/g, " ");
    const mnemonicWords = normalizedMnemonic ? normalizedMnemonic.split(" ") : [];
    console.log("mint-vnft:env", {
      requestId,
      hasProjectUrl: !!PROJECT_URL,
      hasProjectSecret: !!PROJECT_SECRET_KEY,
      hasMnemonic: !!normalizedMnemonic,
      algodUrl: ALGOD_URL,
      mnemonicWordCount: mnemonicWords.length,
    });

    if (!PROJECT_URL || !PROJECT_SECRET_KEY) {
      return jsonResponse(500, { error: "Project secret key not configured", requestId });
    }
    if (!normalizedMnemonic) {
      return jsonResponse(500, { error: "VNFT admin mnemonic not configured", requestId });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing Authorization header", requestId });
    }

    const body = await req.json();
    const walletAddress = body?.wallet_address;
    const isInternal = !!body?._internal;
    const internalUserId = body?.user_id;

    if (!walletAddress) {
      return jsonResponse(400, { error: "wallet_address required", requestId });
    }
    if (!algosdk.isValidAddress(walletAddress)) {
      return jsonResponse(400, { error: "wallet_address invalid", requestId });
    }

    const supabase = createClient(PROJECT_URL, PROJECT_SECRET_KEY, {
      global: isInternal ? {} : { headers: { Authorization: authHeader } },
    });

    let userId: string;

    if (isInternal && internalUserId) {
      // Internal call from stripe-webhook — service role, no user JWT
      userId = internalUserId;
    } else {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        console.error("mint-vnft:auth-error", { requestId, authErr: serializeError(authErr) });
        return jsonResponse(401, { error: authErr?.message ?? "Unauthorized", requestId });
      }
      userId = authData.user.id;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("kyc_verified, vnft_asset_id, vnft_wallet")
      .eq("id", userId)
      .single();

    if (profileErr) {
      console.error("mint-vnft:profile-error", { requestId, profileErr: serializeError(profileErr) });
      return jsonResponse(500, { error: profileErr.message ?? "Profile lookup failed", requestId });
    }

    // Verification: either Stripe KYC verified OR holds EARL tokens OR internal call from webhook
    const hasEarlTokens = await checkEarlOwnership(walletAddress);
    const isVerified = isInternal || !!profile?.kyc_verified || hasEarlTokens;

    if (!isVerified) {
      return jsonResponse(403, { error: "Verification required — purchase an EARL token or complete KYC", requestId });
    }

    // Auto-set kyc_verified if holding EARL tokens but not yet flagged
    if (hasEarlTokens && !profile?.kyc_verified) {
      await supabase
        .from("profiles")
        .update({ kyc_verified: true, updated_at: new Date().toISOString() })
        .eq("id", userId);
      console.log("mint-vnft:auto-verified", { requestId, walletAddress });
    }

    if (profile?.vnft_asset_id) {
      if (!profile?.vnft_wallet || profile.vnft_wallet !== walletAddress) {
        await supabase
          .from("profiles")
          .update({ vnft_wallet: walletAddress })
          .eq("id", userId);
      }
      return jsonResponse(200, {
        assetId: profile.vnft_asset_id,
        txId: null,
        adminAddress: null,
        requestId,
        status: "already_assigned",
      });
    }

    let admin;
    try {
      admin = algosdk.mnemonicToSecretKey(normalizedMnemonic);
    } catch (e) {
      const wordlist = (algosdk as any).wordlist || (algosdk as any).mnemonic?.wordlist;
      console.error("mint-vnft:mnemonic-invalid", {
        requestId,
        wordlistAvailable: Array.isArray(wordlist),
      });
      return jsonResponse(500, {
        error: "Invalid VNFT_ADMIN_MNEMONIC configuration",
        requestId,
      });
    }

    const adminAddress = typeof admin.addr === "string"
      ? admin.addr
      : admin.addr?.publicKey
        ? algosdk.encodeAddress(admin.addr.publicKey)
        : (admin.addr?.toString?.() ?? "");

    if (!adminAddress || !algosdk.isValidAddress(adminAddress)) {
      return jsonResponse(500, {
        error: "VNFT admin address resolution failed",
        requestId,
      });
    }

    const algodClient = new algosdk.Algodv2("", ALGOD_URL, "");
    const params = await algodClient.getTransactionParams().do();

    const assetName = `EarlCoin Verification #${userId.slice(0, 6)}`;
    const existingAssetId = await findExistingVnftAsset(adminAddress, assetName);
    if (existingAssetId) {
      await supabase
        .from("profiles")
        .update({ vnft_asset_id: existingAssetId, vnft_wallet: walletAddress })
        .eq("id", userId);
      return jsonResponse(200, {
        assetId: existingAssetId,
        txId: null,
        adminAddress,
        requestId,
        status: "already_minted",
      });
    }

    const assetCreateTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
      sender: adminAddress,
      total: 1,
      decimals: 0,
      unitName: "VNFT",
      assetName,
      assetURL: "https://earlco.in/nft/verified",
      defaultFrozen: false,
      manager: adminAddress,
      reserve: adminAddress,
      freeze: adminAddress,
      clawback: adminAddress,
      suggestedParams: params,
    });

    const signed = assetCreateTxn.signTxn(admin.sk);
    const sendResult = await algodClient.sendRawTransaction(signed).do();
    const txId = sendResult?.txId;

    if (!txId) {
      return jsonResponse(200, { txId: null, adminAddress, requestId, status: "pending" });
    }

    let result;
    try {
      result = await algosdk.waitForConfirmation(algodClient, txId, 12);
    } catch (e) {
      let pending;
      try {
        pending = await algodClient.pendingTransactionInformation(txId).do();
      } catch (pendingErr) {
        return jsonResponse(200, {
          txId,
          adminAddress,
          requestId,
          status: "pending",
          pendingError: pendingErr?.message ?? String(pendingErr),
        });
      }
      const pendingAssetId = pending?.["asset-index"] ?? pending?.["created-asset-index"];
      const confirmedRound = pending?.["confirmed-round"] ?? 0;
      if (pendingAssetId || confirmedRound > 0) {
        return jsonResponse(200, { assetId: pendingAssetId ?? null, txId, adminAddress, requestId, status: "confirmed" });
      }
      return jsonResponse(200, { txId, adminAddress, requestId, status: "pending" });
    }

    const assetId = result["asset-index"];

    if (assetId) {
      await supabase
        .from("profiles")
        .update({ vnft_asset_id: assetId, vnft_wallet: walletAddress })
        .eq("id", userId);
    }

    return jsonResponse(200, { assetId, txId, adminAddress, requestId });
  } catch (e) {
    console.error("mint-vnft:error", { requestId, error: serializeError(e) });
    return jsonResponse(500, { error: "Internal error", requestId });
  }
});