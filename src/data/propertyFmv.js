// Property FMV overrides — sourced from 6-month recently sold comps
// Updated: 2026-03-25
// Source: Manual review / RentCast AVM / county assessor
// Run scripts/refresh-fmv.js to update from API
//
// Priority: fmvOverride > tokenValue > lpPrice
// The gap between FMV and lpPrice = arbitrage opportunity
//
// TODO: Wire up RentCast API (50 free calls/month) for automated refresh

export const propertyFmv = {
  // Format: 'property address': { fmv: total property FMV, source: 'manual|rentcast|zillow', date: 'YYYY-MM-DD' }
  // Per-token FMV = fmv / totalTokens
  // Earl's FMV = (fmv / totalTokens) * earlTokens
};

// Helper: get FMV per token for a property
export function getFmvPerToken(address, totalTokens) {
  const override = propertyFmv[address];
  if (override && totalTokens > 0) {
    return override.fmv / totalTokens;
  }
  return null;
}
