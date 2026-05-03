/**
 * onchain_price.mjs — Read DODO PMM prices directly from Lofty admin contracts on-chain.
 * Run: node scripts/onchain_price.mjs [assetId]
 *   e.g.: node scripts/onchain_price.mjs 715111483
 */

const ALGOD = 'https://mainnet-idx.4160.nodely.dev';
const LP_API = 'https://lp.lofty.ai/prod/liquidity/v1/marketplace';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let poolCache = null;

async function fetchPoolData() {
  if (poolCache) return poolCache;
  const res = await fetch(LP_API, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`LP API ${res.status}`);
  const data = await res.json();
  poolCache = data.data.pools;
  return poolCache;
}

async function algorandGet(path) {
  const res = await fetch(`${ALGOD}${path}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Algod ${res.status}`);
  return res.json();
}

function decodeKey(key) {
  return Buffer.from(key, 'base64').toString('utf8');
}

async function readAppState(appId) {
  const data = await algorandGet(`/v2/applications/${appId}?include=state`);
  const gs = data.application.params['global-state'] || [];
  const state = {};
  for (const entry of gs) {
    state[decodeKey(entry.key)] = entry.value.type === 2 ? entry.value.uint : entry.value.bytes;
  }
  return { appId: Number(appId), state };
}

function computeDodoPrice(i, k, B, B0) {
  const K_DENOM = 1_000_000n;
  const i_big = BigInt(i);
  const k_big = BigInt(k);
  const B_big = BigInt(B);
  const B0_big = BigInt(B0);

  const term1 = K_DENOM - k_big;
  const B0_sq = B0_big * B0_big;
  const B_sq = B_big * B_big;
  const term2 = (k_big * B0_sq) / B_sq;
  const P = (i_big * (term1 + term2)) / K_DENOM;
  return P;
}

// oracle_price is in USDC micro-units (USDC × 1e6)
// raw DODO price is also in quote units × 1e6
function rawToUsd(raw) {
  return Number(raw / 1_000_000n);
}

async function getOnchainPrice(assetId) {
  const pools = await fetchPoolData();
  const pool = pools.find(p => String(p.property?.assetId) === String(assetId));
  if (!pool) return { error: `Pool not found for assetId ${assetId}` };

  const adminAppId = Number(pool.apps?.contracts?.admin);
  const lpAppId = Number(pool.apps?.contracts?.lpInterface);

  if (!adminAppId || !lpAppId) return { error: 'Missing app IDs in pool data' };

  const [adminState, lpState] = await Promise.all([
    readAppState(adminAppId),
    readAppState(lpAppId),
  ]);

  const i = adminState.state['oracle_price'];
  const k = adminState.state['k'];
  const B = lpState.state['base_balance'];
  const B0 = lpState.state['target_base_balance'];

  if (!i || !k || !B || !B0) {
    return { error: 'Missing DODO parameters', adminState: adminState.state, lpState: lpState.state };
  }

  const dodoRaw = computeDodoPrice(i, k, B, B0);
  const usdPrice = rawToUsd(dodoRaw);

  return {
    assetId,
    address: pool.addressLine1 || pool.property?.address_line1,
    adminAppId,
    lpAppId,
    tradingAppId: Number(pool.apps?.contracts?.trading),
    oracle_price: i,
    k,
    base_balance: B,
    target_base_balance: B0,
    dodo_price_raw: dodoRaw.toString(),
    lp_api_price: pool.price,
    onchain_usd: usdPrice,
  };
}

const assetId = process.argv[2] || '715111483';
console.log(`Fetching on-chain DODO PMM price for assetId ${assetId}...\n`);

const result = await getOnchainPrice(assetId);

if (result.error) {
  console.error('Error:', result.error);
  process.exit(1);
}

console.log('Pool:', result.address);
console.log('Admin App ID:', result.adminAppId);
console.log('LP Interface App ID:', result.lpAppId);
console.log('Trading App ID:', result.tradingAppId);
console.log('\nDODO PMM Parameters:');
console.log('  oracle_price (i):', result.oracle_price, '(USDC × 1e6 = $' + (result.oracle_price / 1e6).toFixed(6) + ')');
console.log('  k:', result.k, '/ 1,000,000 =', (result.k / 1e6).toFixed(6));
console.log('  base_balance (B):', result.base_balance);
console.log('  target_base_balance (B0):', result.target_base_balance);
console.log('\nComputed DODO PMM Price:');
console.log('  raw:', result.dodo_price_raw, '(quote units per base unit × 1e6)');
console.log('  USD: $' + result.onchain_usd.toFixed(6));
console.log('\nLP API price (off-chain): $' + result.lp_api_price);
console.log('Delta: $' + (result.onchain_usd - result.lp_api_price).toFixed(6));
