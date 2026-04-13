import algosdk from 'algosdk';
import fs from 'fs';

const ALGOD_URL = 'https://mainnet-api.4160.nodely.dev';
const GOV_ADMIN_ADDR = 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU';
const TREASURY_ADDR = 'EARLNMGRC6FCNRHRZGKRMU3ILJJE5ONNPBGIFQ5GLIZIL3BTAGNIQ5ZBEE';
const TOTAL_SUPPLY = 10_000_000;
const DECIMALS = 6;
const TOTAL_BASE_UNITS = TOTAL_SUPPLY * 10 ** DECIMALS;

const ASA_CONFIG = {
  total: TOTAL_BASE_UNITS,
  decimals: DECIMALS,
  unitName: 'EARL',
  assetName: 'EarlCoin',
  url: 'https://app.earlco.in/trade',
  note: 'EarlCoin main treasury asset. Minted by GOV_ADMIN and moved to Treasury custody.',
};

async function main() {
  const mnemonic = process.env.GOV_ADMIN_MNEMONIC?.trim();
  if (!mnemonic) throw new Error('GOV_ADMIN_MNEMONIC not set');

  const govAdmin = algosdk.mnemonicToSecretKey(mnemonic);
  if (govAdmin.addr !== GOV_ADMIN_ADDR) throw new Error('GOV_ADMIN mnemonic mismatch');

  const client = new algosdk.Algodv2('', ALGOD_URL, '');
  const govInfo = await client.accountInformation(GOV_ADMIN_ADDR).do();
  const treasuryInfo = await client.accountInformation(TREASURY_ADDR).do();

  if (treasuryInfo['auth-addr'] !== GOV_ADMIN_ADDR) {
    throw new Error('Treasury is not rekeyed to GOV_ADMIN');
  }
  if ((govInfo.amount || 0) < 300000) throw new Error('Gov Admin balance too low for creation');
  if ((treasuryInfo.amount || 0) < 300000) throw new Error('Treasury balance too low for opt-in');

  const createParams = await client.getTransactionParams().do();
  const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    from: GOV_ADMIN_ADDR,
    total: ASA_CONFIG.total,
    decimals: ASA_CONFIG.decimals,
    defaultFrozen: false,
    unitName: ASA_CONFIG.unitName,
    assetName: ASA_CONFIG.assetName,
    assetURL: ASA_CONFIG.url,
    assetManager: GOV_ADMIN_ADDR,
    assetReserve: GOV_ADMIN_ADDR,
    assetFreeze: GOV_ADMIN_ADDR,
    assetClawback: GOV_ADMIN_ADDR,
    note: new TextEncoder().encode(ASA_CONFIG.note),
    suggestedParams: createParams,
  });

  const signedCreate = createTxn.signTxn(govAdmin.sk);
  const { txId: createTxId } = await client.sendRawTransaction(signedCreate).do();
  const createResult = await algosdk.waitForConfirmation(client, createTxId, 8);
  const assetId = createResult['asset-index'];
  if (!assetId) throw new Error('Missing asset ID after creation');

  const optInParams = await client.getTransactionParams().do();
  const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: TREASURY_ADDR,
    to: TREASURY_ADDR,
    amount: 0,
    assetIndex: assetId,
    note: new TextEncoder().encode('Treasury opt-in for EarlCoin ASA'),
    suggestedParams: optInParams,
  });
  const signedOptIn = optInTxn.signTxn(govAdmin.sk);
  const { txId: optInTxId } = await client.sendRawTransaction(signedOptIn).do();
  await algosdk.waitForConfirmation(client, optInTxId, 8);

  const transferParams = await client.getTransactionParams().do();
  const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: GOV_ADMIN_ADDR,
    to: TREASURY_ADDR,
    amount: ASA_CONFIG.total,
    assetIndex: assetId,
    note: new TextEncoder().encode('Initial EARL treasury supply transfer'),
    suggestedParams: transferParams,
  });
  const signedTransfer = transferTxn.signTxn(govAdmin.sk);
  const { txId: transferTxId } = await client.sendRawTransaction(signedTransfer).do();
  await algosdk.waitForConfirmation(client, transferTxId, 8);

  fs.writeFileSync('/tmp/earl-asa-result.json', JSON.stringify({ assetId, createTxId, optInTxId, transferTxId }, null, 2));
  console.log(JSON.stringify({ assetId, createTxId, optInTxId, transferTxId }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
