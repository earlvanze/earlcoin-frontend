import algosdk from 'algosdk';

const ALGOD_URL = 'https://mainnet-api.4160.nodely.dev';
const GOV_ADMIN_ADDR = 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU';
const TREASURY_ADDR = 'EARLNMGRC6FCNRHRZGKRMU3ILJJE5ONNPBGIFQ5GLIZIL3BTAGNIQ5ZBEE';

// Solar system: $100k total at $50/share = 2,000 shares
// Principal escrow: 1,920 shares ($96k) stays in gov admin
// Equity: 80 shares ($4k) will be sent to treasury after they opt-in

const ASA_CONFIG = {
  total: 2000,
  decimals: 0,
  unitName: 'SOLAR',
  assetName: 'EARLCoin Solar 110 Saddle',
  url: 'https://app.earlco.in/portfolio',
  note: 'Tokenized 24.15kW solar system at 110 N Saddle Dr, Idaho Springs CO 80452. $50/share. 1,920 shares escrowed for $96k principal.',
};

const ESCROW_SHARES = 1920;
const TREASURY_SHARES = 80;

async function main() {
  const mnemonic = process.env.GOV_ADMIN_MNEMONIC;
  if (!mnemonic) throw new Error('GOV_ADMIN_MNEMONIC not set');

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  console.log('Gov Admin address:', account.addr.toString());
  
  if (account.addr.toString() !== GOV_ADMIN_ADDR) {
    throw new Error('Mnemonic does not match expected GOV_ADMIN_ADDR');
  }

  const client = new algosdk.Algodv2('', ALGOD_URL, '');
  
  // Check balance
  try {
    const info = await client.accountInformation(account.addr).do();
    console.log('Current balance:', (info.amount / 1e6).toFixed(3), 'ALGO');
    if (info.amount < 200000) {
      console.log('\n⚠️  Gov admin needs at least 0.2 ALGO for ASA creation');
      console.log('Please fund this address first:');
      console.log(GOV_ADMIN_ADDR);
      console.log('\nSend ~0.5 ALGO from treasury or another wallet');
      process.exit(1);
    }
  } catch (e) {
    console.log('\n⚠️  Gov admin wallet does not exist on mainnet yet');
    console.log('Please fund this address first:');
    console.log(GOV_ADMIN_ADDR);
    console.log('\nSend ~0.5 ALGO from treasury or another wallet');
    process.exit(1);
  }

  console.log('\n=== SOLAR ASA CREATION ===');
  console.log('Total:', ASA_CONFIG.total, 'shares @ $50 = $100,000');
  console.log('Escrow (stays here):', ESCROW_SHARES, 'shares ($96k)');
  console.log('Treasury (after opt-in):', TREASURY_SHARES, 'shares ($4k)');
  console.log('');

  const params = await client.getTransactionParams().do();

  const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    total: ASA_CONFIG.total,
    decimals: ASA_CONFIG.decimals,
    defaultFrozen: false,
    unitName: ASA_CONFIG.unitName,
    assetName: ASA_CONFIG.assetName,
    assetURL: ASA_CONFIG.url,
    manager: account.addr,
    reserve: account.addr,
    freeze: account.addr,
    clawback: account.addr,
    note: new TextEncoder().encode(ASA_CONFIG.note),
    suggestedParams: params,
  });

  const signed = createTxn.signTxn(account.sk);
  console.log('Submitting to mainnet...');
  
  const { txId } = await client.sendRawTransaction(signed).do();
  console.log('TxID:', txId);

  const result = await algosdk.waitForConfirmation(client, txId, 10);
  const assetId = result['asset-index'];
  
  console.log('\n✅ ASA Created!');
  console.log('Asset ID:', assetId);
  console.log('View: https://allo.info/asset/' + assetId);
  console.log('View: https://explorer.perawallet.app/asset/' + assetId);
  
  console.log('\n=== NEXT STEPS ===');
  console.log('1. Treasury must opt-in to asset', assetId);
  console.log('2. Transfer', TREASURY_SHARES, 'shares to treasury:');
  console.log('   node transfer-solar-to-treasury.mjs', assetId);
  console.log('3. Update wallets.js:');
  console.log(`   export const SOLAR_ASA = ${assetId};`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
