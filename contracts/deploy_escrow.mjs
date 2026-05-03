/**
 * Deploy Treasury Escrow Contract to Algorand
 *
 * Usage:
 *   node contracts/deploy_escrow.mjs [--testnet|--mainnet]
 *
 * Env vars required:
 *   GOV_ADMIN_MNEMONIC — deployer account
 *   EARL_ASA_ID, USDC_ASA_ID (or VITE_ prefixed)
 *   VNFT_ASA_ID (or VITE_VNFT_ASA_ID)
 *   TREASURY_EARL_USDC_PRICE — price in whole USD (e.g. 100 = $100 per EARL)
 */

import algosdk from 'algosdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isTestnet = process.argv.includes('--testnet');
const algodUrl = isTestnet
  ? 'https://testnet-api.algonode.cloud'
  : (process.env.ALGOD_URL || 'https://mainnet-api.4160.nodely.dev');

const algod = new algosdk.Algodv2('', algodUrl, '');
const mnemonic = (process.env.GOV_ADMIN_MNEMONIC || '').trim().replace(/\s+/g, ' ');
if (!mnemonic) { console.error('GOV_ADMIN_MNEMONIC required'); process.exit(1); }
const deployer = algosdk.mnemonicToSecretKey(mnemonic);
const deployerAddr = typeof deployer.addr === 'string'
  ? deployer.addr
  : algosdk.encodeAddress(deployer.addr.publicKey);

const earlAsaId = Number(process.env.EARL_ASA_ID || process.env.VITE_EARL_ASA_ID || '0');
const usdcAsaId = Number(process.env.USDC_ASA_ID || process.env.VITE_USDC_ASA_ID || '31566704');
const vnftAsaId = Number(process.env.VNFT_ASA_ID || process.env.VITE_VNFT_ASA_ID || '0');
const priceUsd = Number(process.env.TREASURY_EARL_USDC_PRICE || '100');
const priceMicroUsdc = priceUsd * 1_000_000; // micro-USDC per 1 EARL

console.log(`Network:  ${isTestnet ? 'testnet' : 'mainnet'}`);
console.log(`Deployer: ${deployerAddr}`);
console.log(`EARL ASA: ${earlAsaId}`);
console.log(`USDC ASA: ${usdcAsaId}`);
console.log(`VNFT ASA: ${vnftAsaId}`);
console.log(`Price:    $${priceUsd} (${priceMicroUsdc} micro-USDC)`);

const approvalTeal = fs.readFileSync(path.join(__dirname, 'build/treasury_escrow_approval.teal'), 'utf8');
const clearTeal = fs.readFileSync(path.join(__dirname, 'build/treasury_escrow_clear.teal'), 'utf8');

async function main() {
  // Compile TEAL
  const approvalCompiled = await algod.compile(Buffer.from(approvalTeal)).do();
  const clearCompiled = await algod.compile(Buffer.from(clearTeal)).do();

  const approvalProgram = new Uint8Array(Buffer.from(approvalCompiled.result, 'base64'));
  const clearProgram = new Uint8Array(Buffer.from(clearCompiled.result, 'base64'));

  // Create application
  const params = await algod.getTransactionParams().do();
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: deployerAddr,
    approvalProgram,
    clearProgram,
    numGlobalByteSlices: 1,  // admin address
    numGlobalInts: 5,        // earl_asa, usdc_asa, vnft_asa, price, paused
    numLocalByteSlices: 0,
    numLocalInts: 0,
    suggestedParams: params,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
  });

  const signed = txn.signTxn(deployer.sk);
  const { txId } = await algod.sendRawTransaction(signed).do();
  console.log(`\nCreate tx: ${txId}`);

  const result = await algosdk.waitForConfirmation(algod, txId, 10);
  const appId = result['application-index'];
  const appAddr = algosdk.getApplicationAddress(appId);
  console.log(`App ID:   ${appId}`);
  console.log(`App Addr: ${appAddr}`);

  // Fund the escrow with minimum balance
  const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: deployerAddr,
    to: appAddr,
    amount: 500_000, // 0.5 ALGO for MBR
    suggestedParams: await algod.getTransactionParams().do(),
  });
  const signedFund = fundTxn.signTxn(deployer.sk);
  await algod.sendRawTransaction(signedFund).do();
  await algosdk.waitForConfirmation(algod, fundTxn.txID(), 4);
  console.log('Funded escrow with 0.5 ALGO');

  // Setup: initialize ASA IDs and price
  const setupTxn = algosdk.makeApplicationCallTxnFromObject({
    from: deployerAddr,
    appIndex: appId,
    appArgs: [
      new TextEncoder().encode('setup'),
      algosdk.encodeUint64(earlAsaId),
      algosdk.encodeUint64(usdcAsaId),
      algosdk.encodeUint64(vnftAsaId),
      algosdk.encodeUint64(priceMicroUsdc),
    ],
    suggestedParams: await algod.getTransactionParams().do(),
  });
  const signedSetup = setupTxn.signTxn(deployer.sk);
  await algod.sendRawTransaction(signedSetup).do();
  await algosdk.waitForConfirmation(algod, setupTxn.txID(), 4);
  console.log('Setup complete');

  // Opt escrow into EARL and USDC
  for (const [name, asaId] of [['EARL', earlAsaId], ['USDC', usdcAsaId]]) {
    if (!asaId) continue;
    const optinTxn = algosdk.makeApplicationCallTxnFromObject({
      from: deployerAddr,
      appIndex: appId,
      appArgs: [
        new TextEncoder().encode('admin_optin'),
        algosdk.encodeUint64(asaId),
      ],
      suggestedParams: await algod.getTransactionParams().do(),
    });
    const signedOptin = optinTxn.signTxn(deployer.sk);
    await algod.sendRawTransaction(signedOptin).do();
    await algosdk.waitForConfirmation(algod, optinTxn.txID(), 4);
    console.log(`Escrow opted into ${name} (${asaId})`);
  }

  console.log('\n=== Deployment Complete ===');
  console.log(`TREASURY_ESCROW_APP_ID=${appId}`);
  console.log(`TREASURY_ESCROW_ADDRESS=${appAddr}`);
  console.log('\nNext steps:');
  console.log('1. Send EARL tokens to the escrow address to fund it');
  console.log('2. Update frontend to use atomic swap buy flow');
  console.log('3. Set TREASURY_ESCROW_APP_ID in .env and Supabase secrets');
}

main().catch(err => { console.error('Deploy failed:', err.message); process.exit(1); });
