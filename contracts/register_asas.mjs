/**
 * Register Lofty property ASAs with the in-kind exchange contract.
 * For each ASA: accept_asa(box_map: asaId → adminAppId + lpInterfaceAppId)
 * Then: admin_optin (so the app can receive the token)
 *
 * Uses GOV_ADMIN_MNEMONIC (the contract admin).
 */

import algosdk from 'algosdk';
import fs from 'fs';

const ALGOD_URL = 'https://mainnet-api.4160.nodely.dev';
const APP_ID = 3518922796;
const APP_ADDR = 'KTUJPZFBZEU4FLEXORCUEUFQJ5XQDVKPUW3G75SWWZYHAGBA75JYUS4XNI';
const LOFTY_API = 'https://www.loftyassist.com/api/properties';
const INDEXER = 'https://mainnet-idx.4160.nodely.dev';

const DAO_WALLETS = [
  'YILY2YPFH2HODAZSMVJ6C2URUTBJSEPB3377SIKHFCFMGQEEFAJ3E5TYDM', // W1
  'EARLNMGRC6FCNRHRZGKRMU3ILJJE5ONNPBGIFQ5GLIZIL3BTAGNIQ5ZBEE', // TREASURY
  'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU', // GOV_ADMIN
];

async function main() {
  const mnemonic = process.env.GOV_ADMIN_MNEMONIC.trim();
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const deployerAddr = typeof account.addr === 'string'
    ? account.addr
    : algosdk.encodeAddress(account.addr.publicKey);

  const algod = new algosdk.Algodv2('', ALGOD_URL, '');
  console.log('Admin:', deployerAddr);
  console.log('App ID:', APP_ID);
  const appAddr = APP_ADDR;

  // Step 1: Build Lofty ASA → LP contract map from LoftyAssist API
  console.log('\nFetching LoftyAssist API...');
  const res = await fetch(LOFTY_API);
  const items = await res.json();

  const loftyMap = new Map();
  for (const item of items) {
    const p = item?.property;
    const lp = item?.liquidityPool;
    if (!p) continue;
    const contracts = lp?.apps?.contracts;
    const adminAppId = contracts?.admin;
    const lpInterfaceAppId = contracts?.lpInterface;
    if (!adminAppId || !lpInterfaceAppId) continue;

    for (const asaId of [p.assetId, p.newAssetId]) {
      if (asaId) {
        loftyMap.set(asaId, {
          address: p.address || 'Unknown',
          adminAppId,
          lpInterfaceAppId,
        });
      }
    }
  }
  console.log('Lofty ASAs with LP data:', loftyMap.size);

  // Step 2: Find ASAs held by DAO wallets
  const heldAsas = new Map();
  for (const addr of DAO_WALLETS) {
    const walletRes = await fetch(`${INDEXER}/v2/accounts/${addr}/assets?limit=200`);
    const walletData = await walletRes.json();
    for (const a of (walletData.assets || [])) {
      if (a.amount <= 0) continue;
      if (loftyMap.has(a['asset-id']) && !heldAsas.has(a['asset-id'])) {
        heldAsas.set(a['asset-id'], loftyMap.get(a['asset-id']));
      }
    }
  }
  console.log('Lofty ASAs held by DAO with LP data:', heldAsas.size);

  // Step 3: Check which ASAs are already accepted (have boxes)
  const appInfo = await algod.getApplicationByID(APP_ID).do();
  const numAccepted = appInfo.params['global-state']?.find(
    s => Buffer.from(s.key, 'base64').toString() === 'num_accepted'
  )?.value?.uint || 0;
  console.log('Currently accepted ASAs:', numAccepted);

  // Step 4: Register each ASA (stop when app balance is too low)
  const MIN_APP_BALANCE = 200_000; // Keep 0.2 ALGO reserve in app
  let registered = 0;
  let skipped = 0;
  let errors = 0;

  for (const [asaId, meta] of heldAsas) {
    // Check app balance before each registration
    const appInfo = await algod.accountInformation(appAddr).do();
    const appBalance = appInfo.amount;
    if (appBalance < MIN_APP_BALANCE + 150_000) { // Need ~0.15 ALGO per ASA (opt-in MBR + box)
      console.log(`\n⚠️ App balance too low (${(appBalance/1e6).toFixed(3)} ALGO). Stopping.`);
      console.log(`   Need more ALGO to continue registering ASAs.`);
      break;
    }
    console.log(`\nRegistering ASA ${asaId} (${meta.address.slice(0, 30)})...`);

    try {
      // accept_asa: box_map asaId → adminAppId + lpInterfaceAppId
      const params = await algod.getTransactionParams().do();
      const acceptTxn = algosdk.makeApplicationCallTxnFromObject({
        from: deployerAddr,
        appIndex: APP_ID,
        appArgs: [
          new TextEncoder().encode('accept_asa'),
          algosdk.encodeUint64(asaId),
          algosdk.encodeUint64(meta.adminAppId),
          algosdk.encodeUint64(meta.lpInterfaceAppId),
        ],
        foreignApps: [meta.adminAppId, meta.lpInterfaceAppId],
        foreignAssets: [asaId],
        boxes: [{ appIndex: APP_ID, name: algosdk.encodeUint64(asaId) }],
        suggestedParams: params,
      });

      const signedAccept = acceptTxn.signTxn(account.sk);
      const { txId: acceptTxId } = await algod.sendRawTransaction(signedAccept).do();
      await algosdk.waitForConfirmation(algod, acceptTxId, 10);
      console.log('  ✅ accept_asa confirmed');

      // admin_optin: opt the app into the ASA (inner tx, needs 2x fee)
      const optinParams = await algod.getTransactionParams().do();
      optinParams.fee = 2000; // 1 for outer + 1 for inner

      const optinTxn = algosdk.makeApplicationCallTxnFromObject({
        from: deployerAddr,
        appIndex: APP_ID,
        appArgs: [
          new TextEncoder().encode('admin_optin'),
          algosdk.encodeUint64(asaId),
        ],
        foreignAssets: [asaId],
        suggestedParams: optinParams,
      });

      const signedOptin = optinTxn.signTxn(account.sk);
      const { txId: optinTxId } = await algod.sendRawTransaction(signedOptin).do();
      await algosdk.waitForConfirmation(algod, optinTxId, 10);
      console.log('  ✅ admin_optin confirmed');

      registered++;
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('box already exists')) {
        console.log('  ⏭️ Already registered, skipping');
        skipped++;
      } else {
        console.log('  ❌ Error:', msg.slice(0, 200));
        errors++;
      }
    }
  }

  console.log('\n=== Registration Complete ===');
  console.log('Registered:', registered);
  console.log('Skipped (already done):', skipped);
  console.log('Errors:', errors);
}

main().catch(err => { console.error('Failed:', err.message || err); process.exit(1); });