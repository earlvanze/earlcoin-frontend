/**
 * Swap USDC -> ALGO via Tinyman, then send to GOV_ADMIN
 * Uses ALPHA wallet (has USDC) to fund GOV_ADMIN for contract deployment
 */

import algosdk from 'algosdk';
import {
  Swap,
  getValidatorAppID,
  getSwapQuote,
  poolUtils,
  tinymanJSSDKConfig,
} from '@tinymanorg/tinyman-js-sdk';

const ALGOD_URL = 'https://mainnet-api.4160.nodely.dev';
const ALGOD_IDX = 'https://mainnet-idx.4160.nodely.dev';
const USDC_ASA_ID = 31566704;
const ALGO_ASA_ID = 0;

const GOV_ADMIN = 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU';

async function main() {
  const mnemonic = process.env.ALPHA_MNEMONIC.trim();
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const address = typeof account.addr === 'string'
    ? account.addr
    : algosdk.encodeAddress(account.addr.publicKey);

  const algod = new algosdk.Algodv2('', ALGOD_URL, '');
  const indexer = new algosdk.Indexer('', ALGOD_IDX, '');

  console.log('ALPHA address:', address);

  // Check balances
  const info = await algod.accountInformation(address).do();
  const usdcAsset = (info.assets || []).find(a => a['asset-id'] === USDC_ASA_ID);
  console.log('ALGO balance:', (info.amount / 1e6).toFixed(6));
  console.log('USDC balance:', usdcAsset ? (usdcAsset.amount / 1e6).toFixed(6) : '0');

  // We need ~0.5 ALGO for GOV_ADMIN
  // At ~$0.30/ALGO, that's ~$0.15 USDC
  // Swap 0.2 USDC → ALGO (with slippage buffer)
  const usdcAmount = 200000; // 0.2 USDC (micro-units)

  // Get pool info
  const validatorAppId = getValidatorAppID('mainnet');
  console.log('Tinyman validator app ID:', validatorAppId);

  // Fetch pool
  const poolInfo = await poolUtils.fetchPoolByAssets({
    client: algod,
    validatorAppId,
    assetA: { creator: '', decimals: 6, unitName: 'USDC', name: 'USDC', id: USDC_ASA_ID },
    assetB: { creator: '', decimals: 6, unitName: 'ALGO', name: 'ALGO', id: ALGO_ASA_ID },
  });

  console.log('Pool:', poolInfo);

  // Get swap quote
  const quote = await getSwapQuote({
    client: algod,
    pool: poolInfo,
    assetIn: { id: USDC_ASA_ID, decimals: 6, unitName: 'USDC' },
    assetOut: { id: ALGO_ASA_ID, decimals: 6, unitName: 'ALGO' },
    amountIn: usdcAmount,
    slippage: 0.05,
  });

  console.log('Swap quote:', quote);

  // Build and sign swap txns
  const swapTxns = await Swap.generateTxns({
    client: algod,
    pool: poolInfo,
    swapType: 'fixed-input',
    assetIn: { id: USDC_ASA_ID, decimals: 6 },
    assetOut: { id: ALGO_ASA_ID, decimals: 6 },
    amountIn: usdcAmount,
    quote,
    sender: address,
  });

  const signedTxns = Swap.signTxns({
    txns: swapTxns,
    signer: account,
  });

  // Submit
  const { txId } = await algod.sendRawTransaction(signedTxns).do();
  console.log('Swap tx submitted:', txId);
  await algosdk.waitForConfirmation(algod, txId, 10);
  console.log('Swap confirmed');

  // Check new ALGO balance
  const newInfo = await algod.accountInformation(address).do();
  console.log('New ALGO balance:', (newInfo.amount / 1e6).toFixed(6));

  // Send ALGO to GOV_ADMIN
  const sendAmount = 500000; // 0.5 ALGO
  const sendParams = await algod.getTransactionParams().do();
  const sendTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: address,
    to: GOV_ADMIN,
    amount: sendAmount,
    suggestedParams: sendParams,
  });
  const signedSend = sendTxn.signTxn(account.sk);
  const { txId: sendTxId } = await algod.sendRawTransaction(signedSend).do();
  console.log('Send tx submitted:', sendTxId);
  await algosdk.waitForConfirmation(algod, sendTxId, 10);
  console.log('Sent 0.5 ALGO to GOV_ADMIN');

  // Verify
  const govInfo = await algod.accountInformation(GOV_ADMIN).do();
  console.log('GOV_ADMIN ALGO balance:', (govInfo.amount / 1e6).toFixed(6));
}

main().catch(err => { console.error('Failed:', err.message || err); process.exit(1); });