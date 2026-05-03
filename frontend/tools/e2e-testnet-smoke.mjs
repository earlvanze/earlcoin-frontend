import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import algosdk from 'algosdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

const envFile = loadEnvFile(path.join(projectRoot, '.env.local'));
const env = { ...envFile, ...process.env };

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE = env.PROJECT_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const ALGOD_URL = env.VITE_ALGOD_URL || env.ALGOD_URL || 'https://testnet-api.algonode.cloud';
const INDEXER_URL = env.VITE_INDEXER_URL || env.INDEXER_URL || 'https://testnet-idx.algonode.cloud';
const GOV_APP_ID = Number(env.VITE_GOV_APP_ID || env.GOV_APP_ID || '756389510');
const EARL_ASA_ID = Number(env.VITE_EARL_ASA_ID || env.EARL_ASA_ID || '747899490');
const USDC_ASA_ID = Number(env.VITE_USDC_ASA_ID || env.USDC_ASA_ID || '10458941');
const TREASURY_ADDRESS = env.VITE_TREASURY_ADDRESS || env.TREASURY_ADDRESS || 'M7FJSBLDR6BK4ELZCGUZQIKCQPRAKSOAJNLC6WR6QH3UNTE4YLY5WX3NFE';
const ADMIN_MNEMONIC = (env.VNFT_ADMIN_MNEMONIC || env.TREASURY_MNEMONIC || env.GOV_ADMIN_MNEMONIC || '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_ROLE || !ADMIN_MNEMONIC) {
  throw new Error('Missing required env (Supabase URL/anon/service role or admin mnemonic).');
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const publicClient = () => createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
const algod = new algosdk.Algodv2('', ALGOD_URL, '');
const indexer = new algosdk.Indexer('', INDEXER_URL, '');
const encoder = new TextEncoder();

const adminAcct = algosdk.mnemonicToSecretKey(ADMIN_MNEMONIC);
const adminAddr = typeof adminAcct.addr === 'string' ? adminAcct.addr : adminAcct.addr.toString();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const encodeAddress = (addr) => (typeof addr === 'string' ? addr : addr.toString());
const normalizeTxId = (sendResult) => sendResult?.txId || sendResult?.txid || sendResult?.txnId || null;

const encodeVoteKey = (proposalId, senderAddr) => {
  const prefixBytes = encoder.encode('v');
  const idBytes = algosdk.encodeUint64(proposalId);
  const senderBytes = algosdk.decodeAddress(senderAddr).publicKey;
  const out = new Uint8Array(prefixBytes.length + idBytes.length + senderBytes.length);
  out.set(prefixBytes, 0);
  out.set(idBytes, prefixBytes.length);
  out.set(senderBytes, prefixBytes.length + idBytes.length);
  return out;
};

const encodeBoxKey = (prefix, id) => {
  const prefixBytes = encoder.encode(prefix);
  const idBytes = algosdk.encodeUint64(id);
  const out = new Uint8Array(prefixBytes.length + idBytes.length);
  out.set(prefixBytes, 0);
  out.set(idBytes, prefixBytes.length);
  return out;
};

const decodeGlobalState = (state = []) => {
  const out = {};
  for (const kv of state) {
    const key = Buffer.from(kv.key).toString();
    out[key] = kv.value.type === 1 ? Buffer.from(kv.value.bytes).toString('hex') : Number(kv.value.uint);
  }
  return out;
};

async function sendAndWait(txns) {
  const res = await algod.sendRawTransaction(txns).do();
  const txId = normalizeTxId(res);
  if (!txId) throw new Error('Missing txId from sendRawTransaction');
  await algosdk.waitForConfirmation(algod, txId, 4);
  return txId;
}

async function assetBalance(address, assetId) {
  const acct = await algod.accountInformation(address).do();
  const holding = (acct.assets || []).find((a) => Number(a['asset-id'] ?? a.assetId) === assetId);
  return BigInt(holding?.amount ?? 0);
}

async function getProfileIdByWallet(walletAddress) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id')
    .eq('wallet_address', walletAddress)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error(`No profile found for wallet ${walletAddress}`);
  }
  return data.id;
}

async function createUserAndWallet() {
  const email = `e2e-${Date.now()}@earlco.in`;
  const password = 'TempPass!123456';
  const walletAddr = adminAddr;

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { source: 'openclaw-e2e' },
  });
  if (createErr) throw createErr;

  const userId = created.user.id;

  const client = publicClient();
  const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  return { userId, email, password, client, wallet: adminAcct, walletAddr, accessToken: signInData.session.access_token };
}

async function fundWallet(walletAddr) {
  const params = await algod.getTransactionParams().do();

  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: adminAddr,
    receiver: walletAddr,
    amount: 330_000,
    suggestedParams: { ...params },
  });
  await sendAndWait(payTxn.signTxn(adminAcct.sk));

  const params2 = await algod.getTransactionParams().do();
  const optInEARL = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: walletAddr,
    receiver: walletAddr,
    amount: 0,
    assetIndex: EARL_ASA_ID,
    suggestedParams: { ...params2 },
  });
  const params3 = await algod.getTransactionParams().do();
  const optInUSDC = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: walletAddr,
    receiver: walletAddr,
    amount: 0,
    assetIndex: USDC_ASA_ID,
    suggestedParams: { ...params3 },
  });
  algosdk.assignGroupID([optInEARL, optInUSDC]);
  const signedOptIns = [optInEARL.signTxn(tempWallet.sk), optInUSDC.signTxn(tempWallet.sk)];
  await sendAndWait(signedOptIns);

  const params4 = await algod.getTransactionParams().do();
  const earlFundingTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: adminAddr,
    receiver: walletAddr,
    amount: 700_000_000,
    assetIndex: EARL_ASA_ID,
    suggestedParams: { ...params4 },
  });
  const params5 = await algod.getTransactionParams().do();
  const usdcFundingTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: adminAddr,
    receiver: walletAddr,
    amount: 10_000_000,
    assetIndex: USDC_ASA_ID,
    suggestedParams: { ...params5 },
  });
  await sendAndWait(earlFundingTxn.signTxn(adminAcct.sk));
  await sendAndWait(usdcFundingTxn.signTxn(adminAcct.sk));
}

let tempWallet;

async function createGovernanceProposal(user) {
  const app = await algod.getApplicationByID(GOV_APP_ID).do();
  const state = decodeGlobalState(app.params.globalState || []);
  const nextId = Number(state.next_id || 0);
  const earlAsa = Number(state.earl_asa || EARL_ASA_ID);
  if (!nextId) throw new Error('Unable to resolve governance next_id');

  const now = Math.floor(Date.now() / 1000);
  const startTs = now - 5;
  const endTs = now + 15;
  const zeroHash = new Uint8Array(32);
  const params = await algod.getTransactionParams().do();

  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: user.walletAddr,
    appIndex: GOV_APP_ID,
    appArgs: [
      encoder.encode('propose'),
      zeroHash,
      algosdk.encodeUint64(startTs),
      algosdk.encodeUint64(endTs),
      algosdk.encodeUint64(2),
    ],
    foreignAssets: [earlAsa],
    boxes: [
      { appIndex: GOV_APP_ID, name: encodeBoxKey('p', nextId) },
      { appIndex: GOV_APP_ID, name: encodeBoxKey('r', nextId) },
    ],
    suggestedParams: params,
  });

  const txId = await sendAndWait(txn.signTxn(user.wallet.sk));

  const options = [
    { id: 'yes', text: 'Yes' },
    { id: 'no', text: 'No' },
  ];

  const { data: proposal, error: proposalErr } = await user.client
    .from('proposals')
    .insert({
      title: `E2E Governance ${Date.now()}`,
      description: 'Automated test proposal.',
      author_id: user.userId,
      options,
      status: 'active',
      vote_start_ts: startTs,
      vote_end_ts: endTs,
      onchain_tx_id: txId,
      onchain_proposal_id: nextId,
    })
    .select('*')
    .single();
  if (proposalErr) throw proposalErr;

  const { error: snapshotErr } = await user.client.functions.invoke('snapshot-proposal-start', {
    body: { proposal_id: proposal.id },
  });
  if (snapshotErr) throw snapshotErr;

  return { proposal, onchainProposalId: nextId };
}

async function voteGovernance(user, proposalId, onchainProposalId, weightedProfileUserId) {
  const params = await algod.getTransactionParams().do();
  const app = await algod.getApplicationByID(GOV_APP_ID).do();
  const state = decodeGlobalState(app.params.globalState || []);
  const earlAsa = Number(state.earl_asa || EARL_ASA_ID);

  const voteTxn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: user.walletAddr,
    appIndex: GOV_APP_ID,
    appArgs: [
      encoder.encode('vote'),
      algosdk.encodeUint64(onchainProposalId),
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [earlAsa],
    boxes: [
      { appIndex: GOV_APP_ID, name: encodeBoxKey('p', onchainProposalId) },
      { appIndex: GOV_APP_ID, name: encodeVoteKey(onchainProposalId, user.walletAddr) },
    ],
    suggestedParams: params,
  });

  const voteTxId = await sendAndWait(voteTxn.signTxn(user.wallet.sk));

  const box = await algod.getApplicationBoxByName(GOV_APP_ID, encodeVoteKey(onchainProposalId, user.walletAddr)).do();
  if (!box?.value) throw new Error('On-chain vote box was not created');

  const { error: voteErr } = await adminClient.from('votes').insert({
    proposal_id: proposalId,
    user_id: weightedProfileUserId,
    ranked_choices: ['yes'],
  });
  if (voteErr) throw voteErr;

  return voteTxId;
}

async function finalizeGovernance(user, proposal) {
  const endTsMs = Number(proposal.vote_end_ts) * 1000;
  const waitMs = Math.max(0, endTsMs - Date.now() + 3000);
  if (waitMs > 0) {
    await sleep(waitMs);
  }

  const { data, error } = await user.client.functions.invoke('finalize-proposal', {
    body: { proposal_id: proposal.id },
  });
  if (error || data?.error) throw new Error(error?.message || data?.error || 'Finalize failed');

  const { data: row, error: rowErr } = await adminClient
    .from('proposals')
    .select('status, snapshot_hash, onchain_tx_id')
    .eq('id', proposal.id)
    .single();
  if (rowErr) throw rowErr;
  if (row.status !== 'closed' || !row.snapshot_hash || !row.onchain_tx_id) {
    throw new Error('Proposal did not finalize correctly');
  }
  return data;
}

async function walletBuy(user) {
  const before = await assetBalance(user.walletAddr, EARL_ASA_ID);
  const params = await algod.getTransactionParams().do();
  const usdcAmount = 2_500_000;

  const paymentTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: user.walletAddr,
    receiver: TREASURY_ADDRESS,
    amount: usdcAmount,
    assetIndex: USDC_ASA_ID,
    suggestedParams: params,
  });
  const paymentTxId = await sendAndWait(paymentTxn.signTxn(user.wallet.sk));

  const { data, error } = await user.client.functions.invoke('fulfill-usdca-purchase', {
    body: {
      payment_tx_id: paymentTxId,
      usdc_amount: usdcAmount,
      requested_earl_amount: 2,
      wallet_address: user.walletAddr,
    },
  });
  if (error || data?.error) throw new Error(error?.message || data?.error || 'Wallet buy failed');

  const after = await assetBalance(user.walletAddr, EARL_ASA_ID);
  if (user.walletAddr !== TREASURY_ADDRESS && after - before < 2n) {
    throw new Error(`EARL balance did not increase as expected (before=${before} after=${after})`);
  }

  const { data: order, error: orderErr } = await adminClient
    .from('treasury_orders')
    .select('status, tx_id, payment_tx_id, payment_amount')
    .eq('payment_tx_id', paymentTxId)
    .single();
  if (orderErr) throw orderErr;
  if (order.status !== 'fulfilled' || !order.tx_id) {
    throw new Error('Treasury order not fulfilled correctly');
  }

  return { paymentTxId, fulfillmentTxId: order.tx_id, order };
}

async function main() {
  console.log('Creating temp user + wallet...');
  const user = await createUserAndWallet();
  tempWallet = user.wallet;
  console.log('Temp wallet:', user.walletAddr);

  console.log('Using funded admin wallet for smoke run (no faucet dependency)...');
  const weightedProfileUserId = await getProfileIdByWallet(adminAddr);

  console.log('Creating governance proposal...');
  const { proposal, onchainProposalId } = await createGovernanceProposal(user);
  console.log('Proposal:', proposal.id, 'onchain:', onchainProposalId);

  console.log('Voting on-chain + in Supabase...');
  const voteTxId = await voteGovernance(user, proposal.id, onchainProposalId, weightedProfileUserId);
  console.log('Vote tx:', voteTxId);

  console.log('Finalizing governance...');
  const finalized = await finalizeGovernance(user, proposal);
  console.log('Finalize result:', finalized);

  console.log('Running wallet USDCa buy...');
  const purchase = await walletBuy(user);
  console.log('Wallet buy result:', purchase);

  console.log('\nSUCCESS');
  console.log(JSON.stringify({
    userId: user.userId,
    wallet: user.walletAddr,
    proposalId: proposal.id,
    onchainProposalId,
    voteTxId,
    finalizeTxId: finalized.onchain_tx_id,
    paymentTxId: purchase.paymentTxId,
    fulfillmentTxId: purchase.fulfillmentTxId,
  }, null, 2));
}

main().catch((err) => {
  console.error('E2E FAILED');
  console.error(err);
  process.exit(1);
});
