/**
 * Opt out of zero-balance ASAs from EARL wallet, then transfer max ALGO to GOV_ADMIN.
 * Frees up min-balance locked by empty asset holdings.
 */

import algosdk from 'algosdk';

const ALGOD_URL = 'https://mainnet-api.4160.nodely.dev';
const GOV_ADMIN = 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU';
const EARL_ASA_ID = 3497993904;
const USDC_ASA_ID = 31566704;
const GOBTC_ASA_ID = 386192725;
const ALPHA_ASA_ID = 2726252423;

// ASAs to KEEP (non-zero balance or needed)
const KEEP_ASAS = new Set([
  USDC_ASA_ID,
  GOBTC_ASA_ID,
  ALPHA_ASA_ID,
  3133457446, // EARLDAO (146)
  3173144954, // LFTY0476 (235)
  227855942,  // EURS (keep to avoid losing access)
  1820185885, // VL029788 (verification NFT - keep!)
]);

async function main() {
  const mnemonic = process.env.EARL_MNEMONIC.trim();
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const address = typeof account.addr === 'string'
    ? account.addr
    : algosdk.encodeAddress(account.addr.publicKey);

  const algod = new algosdk.Algodv2('', ALGOD_URL, '');

  console.log('EARL address:', address);
  const info = await algod.accountInformation(address).do();
  console.log('ALGO balance:', (info.amount / 1e6).toFixed(6));
  console.log('Min balance:', (info['min-balance'] / 1e6).toFixed(6));
  console.log('Disposable:', ((info.amount - info['min-balance']) / 1e6).toFixed(6));

  // Find zero-balance ASAs to opt out of
  const zeroAssets = (info.assets || []).filter(a => a.amount === 0 && !KEEP_ASAS.has(a['asset-id']));
  console.log(`\nZero-balance ASAs to opt out: ${zeroAssets.length}`);

  if (zeroAssets.length === 0) {
    console.log('No zero-balance ASAs to opt out of.');
  } else {
    // Opt out in batches of 16 (max group size minus 1 for fee cover)
    const BATCH_SIZE = 16;
    for (let i = 0; i < zeroAssets.length; i += BATCH_SIZE) {
      const batch = zeroAssets.slice(i, i + BATCH_SIZE);
      console.log(`\nOpting out batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} assets)...`);

      const params = await algod.getTransactionParams().do();
      const txns = [];

      for (const asset of batch) {
        // Opt out: send 0 of the asset to the creator (closeRemainderTo)
        // This removes the asset from the account, freeing min-balance
        const assetInfo = await algod.getAssetByID(asset['asset-id']).do();
        const creator = assetInfo.params.creator;

        const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: address,
          to: creator,
          amount: 0,
          assetIndex: asset['asset-id'],
          suggestedParams: params,
          closeRemainderTo: creator, // close out to creator
        });

        txns.push(txn);
      }

      if (txns.length > 1) {
        algosdk.assignGroupID(txns);
      }

      const signed = txns.map(txn => txn.signTxn(account.sk));
      const { txId } = await algod.sendRawTransaction(signed).do();
      console.log(`  Batch tx: ${txId}`);
      await algosdk.waitForConfirmation(algod, txId, 10);
      console.log(`  Batch confirmed`);
    }
  }

  // Check new balance after opt-outs
  const newInfo = await algod.accountInformation(address).do();
  console.log('\nAfter opt-outs:');
  console.log('ALGO balance:', (newInfo.amount / 1e6).toFixed(6));
  console.log('Min balance:', (newInfo['min-balance'] / 1e6).toFixed(6));
  console.log('Disposable:', ((newInfo.amount - newInfo['min-balance']) / 1e6).toFixed(6));

  // Transfer max ALGO to GOV_ADMIN (keep 0.1 ALGO for future close-out fees)
  const reserve = 100_000; // 0.1 ALGO reserve
  const transferAmount = newInfo.amount - newInfo['min-balance'] - reserve;
  if (transferAmount <= 0) {
    console.log('\nNot enough disposable ALGO to transfer.');
    return;
  }

  console.log(`\nTransferring ${(transferAmount / 1e6).toFixed(6)} ALGO to GOV_ADMIN...`);
  const sendParams = await algod.getTransactionParams().do();
  const sendTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: address,
    to: GOV_ADMIN,
    amount: transferAmount,
    suggestedParams: sendParams,
  });
  const signedSend = sendTxn.signTxn(account.sk);
  const { txId: sendTxId } = await algod.sendRawTransaction(signedSend).do();
  console.log('Transfer tx:', sendTxId);
  await algosdk.waitForConfirmation(algod, sendTxId, 10);

  // Verify
  const govInfo = await algod.accountInformation(GOV_ADMIN).do();
  console.log('\nGOV_ADMIN ALGO balance:', (govInfo.amount / 1e6).toFixed(6));
  const earlInfo = await algod.accountInformation(address).do();
  console.log('EARL ALGO balance:', (earlInfo.amount / 1e6).toFixed(6));
}

main().catch(err => { console.error('Failed:', err.message || err); process.exit(1); });