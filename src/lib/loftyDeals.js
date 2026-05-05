export const MARKETPLACE_API = 'https://api.lofty.ai/prod/properties/v2/marketplace';
export const LP_MARKETPLACE_API = '/api/lofty.php?source=lp';

export const LOFTY_ASSIST_API = '/api/lofty.php?source=assist';

export const normalizeMarketplaceProperty = (p = {}) => ({
  property: {
    id: p.id || null,
    slug: p.slug || null,
    assetId: p.assetId || null,
    newAssetId: p.newAssetId || null,
    address: p.address || [p.address_line1, p.address_line2].filter(Boolean).join(', ') || 'Unknown property',
    market: p.city || null,
    city: p.city || null,
    state: p.state || null,
    tokenValue: p.liquidity?.marketPrice?.priceLow ?? p.market_price ?? p.tokenValue ?? null,
    cap_rate: p.cap_rate ?? null,
    coc: p.coc ?? 0,
    monthly_rent: p.monthly_rent ?? null,
    netOperatingIncome: p.noi ?? null,
    totalInvestment: p.sale_price ?? p.totalInvestment ?? null,
    tokens: p.tokens ?? null,
    totalLoans: p.current_loan ?? 0,
    listingStatus: p.listingStatus || (p.hideMkt ? 'Hidden' : 'Active'),
    assetName: p.assetName || null,
    assetUnit: p.assetUnit || null,
    dao_app_id: p.dao_app_id || null,
    participant_app_id: p.participant_app_id || null,
  },
  liquidityPool: {
    poolId: p.liquidity?.poolId ?? null,
    price: p.liquidity?.marketPrice?.priceLow ?? null,
    priceLow: p.liquidity?.marketPrice?.priceLow ?? null,
    priceHigh: p.liquidity?.marketPrice?.priceHigh ?? null,
    apy7d: p.liquidity?.stats?.apy7d ?? {},
    vol7d: p.liquidity?.stats?.vol7d ?? {},
    baseStaked: p.liquidity?.baseStaked ?? null,
    quoteStaked: p.liquidity?.quoteStaked ?? null,
  },
  source: 'lofty',
});

export const getMarketplaceProperties = (payload) => payload?.data?.properties || payload?.properties || [];

export async function fetchLoftyMarketplaceItems() {
  const res = await fetch(MARKETPLACE_API);
  if (!res.ok) throw new Error(`Lofty marketplace error: ${res.status}`);
  const payload = await res.json();
  return getMarketplaceProperties(payload).map(normalizeMarketplaceProperty);
}

export async function fetchLoftyAssistItems() {
  const res = await fetch(LOFTY_ASSIST_API);
  if (!res.ok) throw new Error(`LoftyAssist error: ${res.status}`);
  return res.json();
}

const mergeAssistIntoMarketplaceItem = (marketItem, assistItem) => {
  if (!assistItem) return marketItem;

  const marketProperty = marketItem.property || {};
  const assistProperty = assistItem.property || {};
  const assetIds = [...new Set([
    assistProperty.assetId,
    assistProperty.newAssetId,
    marketProperty.assetId,
    marketProperty.newAssetId,
  ].filter((id) => id !== null && id !== undefined && id !== '').map(Number))];

  return {
    ...assistItem,
    property: {
      ...assistProperty,
      ...marketProperty,
      // Preserve both sides of Lofty's 2026-04-28 migration. Marketplace often exposes
      // only the migrated ASA while LoftyAssist may still carry legacy + migrated IDs.
      assetId: marketProperty.assetId ?? assistProperty.assetId ?? null,
      newAssetId: marketProperty.newAssetId ?? assistProperty.newAssetId ?? null,
      legacyAssetId: assistProperty.assetId ?? null,
      migratedAssetId: marketProperty.assetId ?? assistProperty.newAssetId ?? null,
      assetIds,
      // Prefer marketplace live token value/status but keep Assist-only fields below.
      tokenValue: marketProperty.tokenValue ?? assistProperty.tokenValue ?? null,
      listingStatus: marketProperty.listingStatus ?? assistProperty.listingStatus ?? null,
    },
    liquidityPool: {
      ...(assistItem.liquidityPool || {}),
      ...(marketItem.liquidityPool || {}),
      // Preserve Assist contracts for smart-contract swap pricing.
      apps: assistItem.liquidityPool?.apps || marketItem.liquidityPool?.apps,
    },
    source: 'lofty+assist',
  };
};

export async function fetchLoftyPropertyItems({ includeAssistFallback = true } = {}) {
  const [marketplaceResult, assistResult] = await Promise.allSettled([
    fetchLoftyMarketplaceItems(),
    includeAssistFallback ? fetchLoftyAssistItems() : Promise.resolve([]),
  ]);

  const marketplaceItems = marketplaceResult.status === 'fulfilled' ? marketplaceResult.value : [];
  const assistItems = assistResult.status === 'fulfilled' ? assistResult.value : [];

  if (marketplaceResult.status === 'rejected') {
    console.warn('Direct Lofty marketplace unavailable:', marketplaceResult.reason?.message || marketplaceResult.reason);
  }
  if (includeAssistFallback && assistResult.status === 'rejected') {
    console.warn('LoftyAssist fallback unavailable:', assistResult.reason?.message || assistResult.reason);
  }

  const assistByAsset = new Map();
  for (const item of assistItems) {
    const p = item?.property || {};
    for (const id of [p.assetId, p.newAssetId]) {
      if (id !== null && id !== undefined && id !== '') assistByAsset.set(Number(id), item);
    }
  }

  const merged = [];
  const seen = new Set();
  for (const item of marketplaceItems) {
    const p = item?.property || {};
    const assistMatch = assistByAsset.get(Number(p.assetId)) || assistByAsset.get(Number(p.newAssetId));
    merged.push(mergeAssistIntoMarketplaceItem(item, assistMatch));
    for (const id of [p.assetId, p.newAssetId]) if (id) seen.add(Number(id));
  }

  // Keep Assist-only legacy/non-marketplace holdings as fallback rows.
  for (const item of assistItems) {
    const p = item?.property || {};
    const ids = [p.assetId, p.newAssetId].filter(Boolean).map(Number);
    if (!ids.some((id) => seen.has(id))) merged.push({ ...item, source: 'assist-fallback' });
  }

  return merged;
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

// Fetch live LP marketplace prices (176 pools)
// Returns a map of assetId (Number) -> price (Number in USD)
export async function fetchLpPrices() {
  try {
    const res = await fetch(LP_MARKETPLACE_API);
    if (!res.ok) {
      console.error(`LP API ${res.status}`);
      return {};
    }
    const data = await res.json();
    const pools = data?.data?.pools || [];
    const priceMap = {};
    for (const pool of pools) {
      const assetId = pool?.property?.assetId;
      const price = pool?.price;
      if (assetId != null && price != null) {
        priceMap[Number(assetId)] = Number(price);
      }
    }
    return priceMap;
  } catch (err) {
    console.error('Failed to fetch LP prices:', err);
    return {};
  }
}
