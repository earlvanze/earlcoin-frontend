#!/usr/bin/env node
/**
 * Register Lofty properties in the In-Kind Exchange contract.
 *
 * Modes:
 *   --portfolio    Register all W1 + Treasury properties that have LP pools
 *   --criteria     Register properties matching investment criteria (>30% alpha + cashflow, or >9% T-12 yield)
 *   --asa <id>     Register a single ASA
 *   --dry-run      Show what would be registered without executing
 *
 * Requires: GOV_ADMIN_MNEMONIC in environment
 * Cost: ~0.108 ALGO per property (MBR for box + ASA opt-in + fees)
 */

import algosdk from 'algosdk';

const ALGOD_URL = process.env.ALGOD_URL || 'https://mainnet-api.4160.nodely.dev';
const APP_ID = Number(process.env.INKIND_EXCHANGE_APP_ID || '3518922796');
const EARL_ASA_ID = 3497993904;
const LP_API = 'https://lp.lofty.ai/prod/liquidity/v1/marketplace';
const LOFTYASSIST_API = 'https://app.earlco.in/api/lofty.php';
const W1 = 'YILY2YPFH2HODAZSMVJ6C2URUTBJSEPB3377SIKHFCFMGQEEFAJ3E5TYDM';
const TREASURY = 'EARLNMGRC6FCNRHRZGKRMU3ILJJE5ONNPBGIFQ5GLIZIL3BTAGNIQ5ZBEE';

const algod = new algosdk.Algodv2('', ALGOD_URL, '');
const mnemonic = (process.env.GOV_ADMIN_MNEMONIC || '').trim().replace(/\s+/g, ' ');
if (!mnemonic) { console.error('GOV_ADMIN_MNEMONIC required'); process.exit(1); }
const deployer = algosdk.mnemonicToSecretKey(mnemonic);
const deployerAddr = typeof deployer.addr === 'string' ? deployer.addr : algosdk.encodeAddress(deployer.addr.publicKey);
const appAddr = algosdk.getApplicationAddress(APP_ID);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const mode = args.includes('--portfolio') ? 'portfolio' : args.includes('--criteria') ? 'criteria' : args.includes('--asa') ? 'single' : 'portfolio';

async function fetchLpPools() {
  const res = await fetch(LP_API, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' } });
  const data = await res.json();
  const pools = data?.data?.pools || [];
  const map = {};
  for (const p of pools) {
    const asaId = p.property?.assetId || p.assets?.base?.id;
    if (asaId && p.apps?.contracts?.admin && p.apps?.contracts?.lpInterface) {
      map[asaId] = {
        admin: p.apps.contracts.admin,
        lp: p.apps.contracts.lpInterface,
        name: p.property?.address_line1 || '?',
        price: p.price,
      };
    }
  }
  return map;
}

async function getPortfolioAsas() {
  const asas = new Set();
  for (const addr of [W1, TREASURY]) {
    const info = await algod.accountInformation(addr).do();
    for (const a of (info.assets || [])) {
      if (a.amount > 0 && a['asset-id'] !== EARL_ASA_ID && a['asset-id'] !== 31566704) {
        asas.add(a['asset-id']);
      }
    }
  }
  return asas;
}

async function getCriteriaAsas(poolMap) {
  const res = await fetch(LOFTYASSIST_API);
  const data = await res.json();
  const asas = new Set();
  for (const item of data) {
    const p = item.property || {};
    const asaId = p.assetId;
    if (!asaId || !poolMap[asaId]) continue;

    const coc = typeof item.coc === 'number' ? item.coc : (typeof p.coc === 'number' ? p.coc / 100 : 0);
    const nav = item.oraclePrice || p.tokenValue;
    const market = item.marketPrice || poolMap[asaId]?.price;
    const alpha = nav && market && market > 0 ? ((nav - market) / market * 100) : 0;

    if ((alpha > 30 && coc > 0) || coc > 9) {
      asas.add(asaId);
    }
  }
  return asas;
}

async function getRegisteredAsas() {
  const info = await algod.accountInformation(appAddr).do();
  return new Set((info.assets || []).map(a => a['asset-id']));
}

async function registerAsa(asaId, admin, lp) {
  const p = await algod.getTransactionParams().do();
  const p2 = await algod.getTransactionParams().do();
  p2.fee = 2000;
  p2.flatFee = true;

  const mbrTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: deployerAddr, to: appAddr, amount: 106100, suggestedParams: p,
  });
  const acceptTxn = algosdk.makeApplicationCallTxnFromObject({
    from: deployerAddr, appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('accept_asa'),
      algosdk.encodeUint64(asaId),
      algosdk.encodeUint64(admin),
      algosdk.encodeUint64(lp),
    ],
    boxes: [{ appIndex: APP_ID, name: algosdk.encodeUint64(asaId) }],
    suggestedParams: p,
  });
  const optTxn = algosdk.makeApplicationCallTxnFromObject({
    from: deployerAddr, appIndex: APP_ID,
    appArgs: [new TextEncoder().encode('admin_optin'), algosdk.encodeUint64(asaId)],
    foreignAssets: [asaId],
    suggestedParams: p2,
  });
  algosdk.assignGroupID([mbrTxn, acceptTxn, optTxn]);
  await algod.sendRawTransaction([
    mbrTxn.signTxn(deployer.sk),
    acceptTxn.signTxn(deployer.sk),
    optTxn.signTxn(deployer.sk),
  ]).do();
  await algosdk.waitForConfirmation(algod, optTxn.txID(), 4);
}

async function main() {
  console.log(`Mode: ${mode} | App: ${APP_ID} | Dry run: ${dryRun}`);

  const poolMap = await fetchLpPools();
  console.log(`LP pools loaded: ${Object.keys(poolMap).length}`);

  const registered = await getRegisteredAsas();
  console.log(`Already registered: ${registered.size} ASAs`);

  let targetAsas;
  if (mode === 'single') {
    const asaId = Number(args[args.indexOf('--asa') + 1]);
    targetAsas = new Set([asaId]);
  } else if (mode === 'criteria') {
    targetAsas = await getCriteriaAsas(poolMap);
  } else {
    targetAsas = await getPortfolioAsas();
  }

  const toRegister = [];
  for (const asaId of targetAsas) {
    if (registered.has(asaId)) continue;
    if (!poolMap[asaId]) continue;
    toRegister.push({ asaId, ...poolMap[asaId] });
  }

  console.log(`\nTo register: ${toRegister.length} properties`);
  console.log(`Estimated cost: ~${(toRegister.length * 0.108).toFixed(2)} ALGO`);

  if (dryRun) {
    for (const r of toRegister) {
      console.log(`  ASA ${r.asaId} | ${r.name} | $${r.price?.toFixed(2)} | admin:${r.admin} lp:${r.lp}`);
    }
    return;
  }

  const info = await algod.accountInformation(deployerAddr).do();
  const spendable = (info.amount - (info['min-balance'] || 100000)) / 1e6;
  console.log(`GOV_ADMIN spendable: ${spendable.toFixed(3)} ALGO`);

  if (spendable < toRegister.length * 0.115) {
    console.log(`WARNING: May not have enough ALGO for all ${toRegister.length} registrations`);
  }

  let ok = 0, fail = 0;
  for (const r of toRegister) {
    try {
      await registerAsa(r.asaId, r.admin, r.lp);
      ok++;
      process.stdout.write('.');
    } catch (e) {
      fail++;
      console.log(`\nFail ASA ${r.asaId} (${r.name}): ${e.message?.slice(0, 80)}`);
      if (e.message?.includes('below min')) {
        console.log('Out of ALGO. Stopping.');
        break;
      }
    }
  }

  console.log(`\nRegistered: ${ok} | Failed: ${fail}`);
  const finalInfo = await algod.accountInformation(deployerAddr).do();
  console.log(`GOV_ADMIN: ${(finalInfo.amount / 1e6).toFixed(3)} ALGO`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
