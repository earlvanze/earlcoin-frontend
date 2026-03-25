import algosdk from 'algosdk';

const ALGOD_URL = 'https://mainnet-api.4160.nodely.dev';
const TREASURY_ADDR = 'EARLNMGRC6FCNRHRZGKRMU3ILJJE5ONNPBGIFQ5GLIZIL3BTAGNIQ5ZBEE';

const ASA_CONFIG = {
  total: 100000,
  decimals: 0,
  unitName: 'SOLAR',
  assetName: 'EARLCoin Solar 110 Saddle',
  url: 'https://app.earlco.in/portfolio',
  note: 'Tokenized 24.15kW solar system at 110 N Saddle Dr, Idaho Springs CO 80452. Cost basis $100k. 1 token = $1.',
};

async function main() {
  const mnemonic = process.env.TREASURY_MNEMONIC;
  if (!mnemonic) throw new Error('TREASURY_MNEMONIC not set');

  const creator = algosdk.mnemonicToSecretKey(mnemonic);
  console.log('Creator address:', creator.addr.toString());

  const client = new algosdk.Algodv2('', ALGOD_URL, '');
  
  // Check creator balance
  const info = await client.accountInformation(creator.addr).do();
  console.log('Creator ALGO balance:', (Number(info.amount) / 1e6).toFixed(4), 'ALGO');
  
  if (Number(info.amount) < 200000) {
    throw new Error('Insufficient ALGO for ASA creation (need ~0.2 ALGO for min balance + fees)');
  }

  const params = await client.getTransactionParams().do();

  // Step 1: Create the ASA
  console.log('\n--- Step 1: Creating ASA ---');
  console.log('Name:', ASA_CONFIG.assetName);
  console.log('Unit:', ASA_CONFIG.unitName);
  console.log('Total:', ASA_CONFIG.total.toLocaleString(), 'tokens');

  const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: creator.addr,
    total: ASA_CONFIG.total,
    decimals: ASA_CONFIG.decimals,
    defaultFrozen: false,
    unitName: ASA_CONFIG.unitName,
    assetName: ASA_CONFIG.assetName,
    assetURL: ASA_CONFIG.url,
    manager: creator.addr,
    reserve: creator.addr,
    freeze: undefined,
    clawback: undefined,
    note: new TextEncoder().encode(ASA_CONFIG.note),
    suggestedParams: params,
  });

  const signedCreate = createTxn.signTxn(creator.sk);
  const { txId: createTxId } = await client.sendRawTransaction(signedCreate).do();
  console.log('Create TxID:', createTxId);

  const createResult = await algosdk.waitForConfirmation(client, createTxId, 10);
  const assetId = createResult['asset-index'];
  console.log('✅ ASA Created! Asset ID:', assetId);
  console.log('   https://allo.info/asset/' + assetId);

  // Step 2: Transfer all tokens to Treasury
  // Treasury must opt-in first. Check if it already holds this asset.
  console.log('\n--- Step 2: Transfer to Treasury ---');
  console.log('Target:', TREASURY_ADDR);
  
  // Get fresh params
  const params2 = await client.getTransactionParams().do();
  
  const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: creator.addr,
    receiver: TREASURY_ADDR,
    amount: ASA_CONFIG.total,
    assetIndex: assetId,
    suggestedParams: params2,
    note: new TextEncoder().encode('Initial transfer of SOLAR tokens to EARLCoin Treasury'),
  });

  const signedTransfer = transferTxn.signTxn(creator.sk);
  
  try {
    const { txId: transferTxId } = await client.sendRawTransaction(signedTransfer).do();
    console.log('Transfer TxID:', transferTxId);
    await algosdk.waitForConfirmation(client, transferTxId, 10);
    console.log('✅ All', ASA_CONFIG.total.toLocaleString(), 'SOLAR tokens transferred to Treasury!');
  } catch (e) {
    if (e.message?.includes('asset') || e.message?.includes('optin')) {
      console.log('⚠️  Treasury needs to opt-in to asset', assetId, 'before transfer.');
      console.log('   Tokens remain with creator:', creator.addr.toString());
      console.log('   After opt-in, run transfer manually.');
    } else {
      throw e;
    }
  }

  console.log('\n=== Summary ===');
  console.log('Asset ID:', assetId);
  console.log('Name:', ASA_CONFIG.assetName, '(' + ASA_CONFIG.unitName + ')');
  console.log('Total Supply:', ASA_CONFIG.total.toLocaleString());
  console.log('Creator:', creator.addr.toString());
  console.log('Treasury:', TREASURY_ADDR);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
