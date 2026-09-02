export const MARKETPLACE_API = '/api/lofty.php?source=marketplace';
export const LP_MARKETPLACE_API = '/api/lofty.php?source=lp';
export const LOFTY_ASSIST_API = '/api/lofty.php';

export async function fetchLoftyPropertyItems({ includeAssistFallback = false } = {}) {
  const responses = await Promise.allSettled([
    fetch(MARKETPLACE_API).then((res) => {
      if (!res.ok) throw new Error(`Lofty marketplace API ${res.status}`);
      return res.json();
    }),
    ...(includeAssistFallback ? [fetch(LOFTY_ASSIST_API).then((res) => {
      if (!res.ok) throw new Error(`LoftyAssist API ${res.status}`);
      return res.json();
    })] : []),
  ]);

  const items = [];
  const seen = new Set();
  for (const response of responses) {
    if (response.status !== 'fulfilled' || !Array.isArray(response.value)) continue;
    for (const item of response.value) {
      const property = item?.property || {};
      const key = property.id || property.slug || property.newAssetId || property.assetId;
      if (key == null || seen.has(String(key))) continue;
      seen.add(String(key));
      items.push(item);
    }
  }

  if (items.length === 0) throw new Error('Lofty property APIs returned no data');
  return items;
}

export const normalizeAddressLookupKey = (value) => {
  if (!value) return '';

  const [street = '', city = ''] = String(value)
    .split(',')
    .map((part) => part.trim())
    .slice(0, 2);

  return `${street} ${city}`
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const buildMarketplaceIdSet = (properties = []) => {
  const ids = new Set();

  for (const property of properties) {
    for (const id of [property?.assetId, property?.newAssetId]) {
      if (id !== null && id !== undefined && id !== '') {
        ids.add(String(id));
      }
    }
  }

  return ids;
};

export const isMarketplaceTradable = (deal = {}, marketplaceIds = new Set()) => {
  const candidateIds = [deal.assetId, deal.newAssetId]
    .filter((id) => id !== null && id !== undefined && id !== '')
    .map((id) => String(id));

  return candidateIds.some((id) => marketplaceIds.has(id));
};

export const shouldIncludeTradableDeal = (deal = {}, marketplaceIds = new Set()) => {
  if (deal.listingStatus !== 'Active') return false;
  // If Lofty marketplace allowlist is unavailable, do not blank the page.
  // Fall back to active LoftyAssist/Supabase rows and let LP pricing enrich what it can.
  if (!marketplaceIds || marketplaceIds.size === 0) return true;
  return isMarketplaceTradable(deal, marketplaceIds);
};

export const normalizeCashflowDeal = (item) => {
  const p = item?.property || {};

  return {
    id: p.id || p.slug || p.assetId,
    property_id: p.id || null,
    assetId: p.assetId || null,
    newAssetId: p.newAssetId || null,
    address: p.address || 'Unknown property',
    slug: p.slug || null,
    city: p.market || p.city || null,
    state: p.state || null,
    market_price: p.tokenValue ?? null,
    cap_rate: typeof p.cap_rate === 'number' ? p.cap_rate / 100 : null,
    coc: typeof p.coc === 'number' ? p.coc / 100 : null,
    listingStatus: p.listingStatus || null,
    source: 'loftyassist',
  };
};

export const buildLoftyPropertyLookup = (items = []) => {
  const byAddressKey = {};
  const byAssetId = {};

  for (const item of items) {
    const p = item?.property || {};
    const key = normalizeAddressLookupKey(p.address);
    if (!key) continue;

    byAddressKey[key] = {
      property_id: p.id || p.slug || null,
      slug: p.slug || null,
      address: p.address || null,
      city: p.market || p.city || null,
      state: p.state || null,
      assetId: p.assetId || null,
      newAssetId: p.newAssetId || null,
      listingStatus: p.listingStatus || null,
    };

    if (p.assetId) byAssetId[p.assetId] = byAddressKey[key];
    if (p.newAssetId) byAssetId[p.newAssetId] = byAddressKey[key];
  }

  return { byAddressKey, byAssetId };
};

export const attachLoftyPropertyMeta = (items = [], loftyLookup = {}) => {
  const { byAddressKey, byAssetId } = loftyLookup;
  return items.map((item) => {
    // Try assetId first
    if (item.assetId && byAssetId[item.assetId]) {
      const match = byAssetId[item.assetId];
      return { ...item, ...match };
    }
    // Fall back to address lookup
    const lookupValue = item.address || item.scenario || '';
    const loftyMatch = byAddressKey[normalizeAddressLookupKey(lookupValue)];
    if (!loftyMatch) return item;
    return { ...item, ...loftyMatch };
  });
};

export const filterTradableDeals = (items = [], marketplaceIds = new Set()) => (
  items.filter((item) => shouldIncludeTradableDeal(item, marketplaceIds))
);

export const normalizeAssetAmount = (amount, decimals = 0) => (
  Number(amount || 0) / Math.pow(10, Number(decimals || 0))
);

export const buildLpPriceMap = (payload) => {
  const priceMap = {};
  const pools = Array.isArray(payload)
    ? payload
    : (payload?.data?.pools || payload?.pools || []);

  for (const item of pools) {
    const property = item?.property || {};
    const pool = item?.liquidityPool || item;
    const price = pool?.price;
    if (price == null) continue;

    // Lofty's migrated tokens use newAssetId; retaining assetId keeps older
    // balances priceable during the migration window.
    for (const assetId of [property.newAssetId, property.assetId, pool?.property?.assetId]) {
      if (assetId != null && assetId !== '') {
        priceMap[Number(assetId)] = Number(price);
      }
    }
  }

  return priceMap;
};

// Fetch live LP marketplace prices.
// Returns a map of assetId (Number) -> price (Number in USD)
export async function fetchLpPrices() {
  try {
    const res = await fetch(LP_MARKETPLACE_API);
    if (!res.ok) {
      console.error(`LP API ${res.status}`);
      return {};
    }
    return buildLpPriceMap(await res.json());
  } catch (err) {
    console.error('Failed to fetch LP prices:', err);
    return {};
  }
}
