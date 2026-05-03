const DEFAULT_HOLDINGS = [
  { propertyName: '88 Madison Ave, Albany, NY 12202', sharesOwned: 7, lastUpdated: '2025-12-14' },
  { propertyName: '90 Madison Ave, Albany, NY 12202', sharesOwned: 27, lastUpdated: '2025-12-10' },
  { propertyName: '86 Madison Ave, Albany, NY 12202', sharesOwned: 12, lastUpdated: '2025-12-14' },
  { propertyName: '84 Madison Ave, Albany, NY 12202', sharesOwned: 120, lastUpdated: '2025-12-11' },
  { propertyName: '724 3rd Ave, Watervliet, NY 12189', sharesOwned: 16, lastUpdated: '2025-12-10' },
  { propertyName: '85-104 Alawa Pl, Waianae, HI 96792', sharesOwned: 90, lastUpdated: '2025-12-14' },
  { propertyName: '254 Bowmanville St, Akron, OH 44305', sharesOwned: 5, lastUpdated: '2025-12-14' },
  { propertyName: '326-332 S Alcott St, Denver, CO 80219', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: '1432 Sara Ave, Akron, OH 44305', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: '5541 S Peoria St, Chicago, IL 60621', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: '2337 Greenvale Rd, Cleveland, OH 44121', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: '9634 S Green St, Chicago, IL 60643', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: '9919 S Oglesby Ave, Chicago, IL 60617', sharesOwned: 6, lastUpdated: '2025-12-07' },
  { propertyName: '15555 Millard Ave, Markham, IL 60428', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: '3024 W 103rd St, Cleveland, OH 44111', sharesOwned: 233, lastUpdated: '2025-12-07' },
  { propertyName: '8708 Willard Ave, Cleveland, OH 44102', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: '1278 E 187th St, Cleveland, OH 44110', sharesOwned: 3, lastUpdated: '2025-12-14' },
  { propertyName: '7542 and 7656 S Colfax Ave, Chicago, IL 60649', sharesOwned: 4, lastUpdated: '2025-12-09' },
  { propertyName: '428 Cross St, Akron, OH 44311', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: '3139 West Blvd, Cleveland, OH 44111', sharesOwned: 1, lastUpdated: '2025-10-27' },
  { propertyName: '25 Circle Dr, Dixmoor, IL 60426', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: 'Ohio 3 Property Package, Akron, OH 44117', sharesOwned: 41, unitPriceUsd: 22.07, lastUpdated: '2025-12-07' },
  { propertyName: '918 Frederick Blvd, Akron, OH 44320', sharesOwned: 9, lastUpdated: '2025-12-14' },
  { propertyName: '614 E 97th St, Cleveland, OH 44108', sharesOwned: 1, lastUpdated: '2025-12-14' },
  { propertyName: '13806 Coit Rd, Cleveland, OH 44110', sharesOwned: 7, lastUpdated: '2025-12-14' },
  { propertyName: '9 Country Club Ln N, Briarcliff Manor, NY 10510', sharesOwned: 450, lastUpdated: '2025-12-12' },
];

export const DEFAULT_LOFTY_PORTFOLIO_SEED = {
  source: 'ECO Systems LLC - Lofty Management Portfolio.pdf',
  sourceType: 'pdf_profile_snapshot',
  snapshotAsOf: '2025-12-14',
  notes: 'Current-version fallback seed built from local Lofty-related portfolio snapshot. Replace with direct Lofty account export/import when available.',
  holdings: DEFAULT_HOLDINGS,
};

const numberLike = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[$,]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const firstString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const normalizeHolding = (holding, index = 0) => {
  const propertyName = firstString(
    holding.propertyName,
    holding.property,
    holding.address,
    holding.name,
    holding.label,
    holding.assetName,
  );

  const sharesOwned = numberLike(
    holding.sharesOwned ?? holding.shares ?? holding.shareCount ?? holding.owned ?? holding.quantity ?? holding.tokenCount
  );

  if (!propertyName || sharesOwned === null) return null;

  return {
    id: firstString(holding.id, holding.propertyId, holding.assetId) || `lofty-${index + 1}`,
    propertyName,
    sharesOwned,
    currentValueUsd: numberLike(holding.currentValueUsd ?? holding.marketValueUsd ?? holding.valueUsd),
    investedUsd: numberLike(holding.investedUsd ?? holding.costBasisUsd),
    unitPriceUsd: numberLike(holding.unitPriceUsd ?? holding.pricePerShareUsd),
    monthlyIncomeUsd: numberLike(holding.monthlyIncomeUsd ?? holding.rentUsd ?? holding.distributionUsd),
    status: firstString(holding.status, holding.positionStatus) || 'seeded',
    lastUpdated: firstString(holding.lastUpdated, holding.asOf, holding.snapshotAsOf),
    notes: firstString(holding.notes),
    source: firstString(holding.source),
  };
};

export const normalizeLoftyPortfolioPayload = (payload) => {
  const root = Array.isArray(payload) ? { holdings: payload } : (payload || {});
  const rawHoldings = Array.isArray(root.holdings)
    ? root.holdings
    : Array.isArray(root.positions)
      ? root.positions
      : Array.isArray(root.assets)
        ? root.assets
        : [];

  const holdings = rawHoldings
    .map((holding, index) => normalizeHolding(holding, index))
    .filter(Boolean);

  if (!holdings.length) {
    throw new Error('Import did not contain any recognizable Lofty holdings.');
  }

  return {
    source: firstString(root.source, root.sourceFile, root.sourceName) || 'Manual Lofty import',
    sourceType: firstString(root.sourceType) || 'manual_import',
    snapshotAsOf: firstString(root.snapshotAsOf, root.asOf, root.lastUpdated) || new Date().toISOString().slice(0, 10),
    notes: firstString(root.notes),
    holdings,
  };
};

export const buildPortfolioSummary = (seed) => {
  const holdings = seed?.holdings || [];
  return holdings.reduce((acc, holding) => {
    acc.propertyCount += 1;
    acc.totalShares += Number(holding.sharesOwned || 0);
    if (Number.isFinite(holding.currentValueUsd)) acc.totalValueUsd += Number(holding.currentValueUsd);
    if (Number.isFinite(holding.investedUsd)) acc.totalInvestedUsd += Number(holding.investedUsd);
    if (Number.isFinite(holding.monthlyIncomeUsd)) acc.totalMonthlyIncomeUsd += Number(holding.monthlyIncomeUsd);
    return acc;
  }, {
    propertyCount: 0,
    totalShares: 0,
    totalValueUsd: 0,
    totalInvestedUsd: 0,
    totalMonthlyIncomeUsd: 0,
  });
};
