// Property FMV — sourced from 6-month recently sold comparables + LoftyAssist market valuations
// Updated: 2026-03-25
// Sources: LoftyAssist Market Price Valuations, Redfin/Realtor.com sold comps, Zillow estimates
//
// Priority: fmvOverride > oraclePrice (LoftyAssist AVM) > tokenValue (Lofty stated)
// FMV per token = fmv / totalTokens
// Earl's holding FMV = (fmv / totalTokens) * earlTokens

export const propertyFmv = {
  // ─── Lofty Tokenized Properties ────────────────────────────────────────────
  
  // 84 Madison Ave, Albany, NY 12202 — Multi-family, 7,821 tokens
  // Last sold: $260,000 (Dec 2024, Redfin). Feb 2026 est: $259k–$286k
  // Note: LP trades at $61.54/token vs $50 cost basis → +23% on LP
  '84 Madison Ave, Albany, NY 12202': {
    fmv: 265000,
    source: 'Redfin/Realtor.com (Dec 2024 sale + 3% LTM appreciation)',
    date: '2026-03-25',
    notes: 'Multi-family, 2,600 sqft, built 1815. LP premium reflects recent rental income strength.',
  },

  // 86 Madison Ave, Albany, NY 12202 — Multi-family, 7,361 tokens
  // Estimates: $214k–$234k (Realtor.com/CoreLogic/Quantarium Feb 2026)
  // Last sold: $110,000 (Oct 2021) — pre-renovation. Trades at $33.23 (below cost).
  '86 Madison Ave, Albany, NY 12202': {
    fmv: 225000,
    source: 'Realtor.com/CoreLogic/Quantarium estimates (Feb 2026)',
    date: '2026-03-25',
    notes: '5BR/2BA multi-family, 2,496 sqft, built 1901. LP discount to tokenValue = buying opportunity.',
  },

  // 88 Madison Ave, Albany, NY 12202 — Multi-family, 7,455 tokens
  // No recent sale. Used 84 Madison as comp ($260k Dec 2024) + modest growth
  '88 Madison Ave, Albany, NY 12202': {
    fmv: 275000,
    source: 'Estimated from 84 Madison Ave comp + 3% growth (Dec 2024–Mar 2026)',
    date: '2026-03-25',
    notes: 'Madison Ave cluster. Nearby sale $260k Dec 2024.',
  },

  // 90 Madison Ave, Albany, NY 12202 — Multi-family, 6,450 tokens
  // LoftyAssist Market Price Valuation: $274,557 (Feb 25, 2026)
  '90 Madison Ave, Albany, NY 12202': {
    fmv: 274557,
    source: 'LoftyAssist Market Price Valuation (Feb 25, 2026)',
    date: '2026-02-25',
    notes: 'Multi-family. PropertyShark assessed: $201k.',
  },

  // 9 Country Club Ln N, Briarcliff Manor, NY 10510 — Vacation rental, 39,213 tokens
  // SOLD: $2,100,000 (May 2, 2025, Zillow) — 4BR/6BA, 4,151 sqft
  // Current LP price $20.67 = massive discount to FMV → significant upside
  '9 Country Club Ln N, Briarcliff Manor, NY 10510': {
    fmv: 2100000,
    source: 'Zillow — Sold May 2, 2025 ($2.1M, 4BR/6BA, 4,151 sqft)',
    date: '2025-05-02',
    notes: 'Vacation rental. LP/token $20.67 vs FMV/token $53.57 → DAO holders at ~39¢ on FMV dollar.',
  },

  // 1821 Donetto Dr, Leander, TX 78641 — Single family, 12,754 tokens
  // Estimates: $546k–$604k (Redfin $587k, Realtor.com $570k, CoreLogic $604k Feb 2026)
  '1821 Donetto Dr, Leander, TX 78641': {
    fmv: 580000,
    source: 'Redfin ($587k) + Realtor.com ($570k) + CoreLogic ($604k), Feb 2026',
    date: '2026-03-25',
    notes: '5BR/4BA, ~2,880 sqft, built 2022. Newer construction.',
  },

  // 3761 Jade Ave, Las Cruces, NM 88012 — Vacation rental, 6,272 tokens
  // Estimates: $201k–$266k. Vacation rental premium over SFR comps.
  '3761 Jade Ave, Las Cruces, NM 88012': {
    fmv: 235000,
    source: 'Realtor.com ($244k) + CoreLogic ($266k) + Quantarium ($201k), Feb 2026',
    date: '2026-03-25',
    notes: '3BR/2BA, 1,602 sqft, built 1988. Vacation rental w/ solar + remodel.',
  },

  // 217 McClallen Dr, Killington, VT 05751 — Vacation rental, 18,461 tokens
  // No recent sales found (last sale: $360k in 2003). Killington is high-demand ski market.
  // Lofty totalInvestment = $923,050. Used comparable STR valuations.
  '217 McClallen Dr, Killington, VT 05751': {
    fmv: 950000,
    source: 'Estimated from Killington STR market (no recent comps available)',
    date: '2026-03-25',
    notes: 'Killington ski resort market. LP $53.44 vs tokenValue $50.02 = slight premium.',
  },

  // 2221 E Chase St, Baltimore, MD 21213 — Vacation rental, 5,546 tokens
  // LoftyAssist Market Price Valuation: $360,574 (vs listing $279k)
  // Redfin: $145k, Zillow: $152k — but fully renovated STR commands premium
  '2221 E Chase St, Baltimore, MD 21213': {
    fmv: 360574,
    source: 'LoftyAssist Market Price Valuation ($360,574 vs listing $279k)',
    date: '2026-03-25',
    notes: '716 sqft townhouse, fully renovated. Vacation rental premium over traditional comps.',
  },

  // 395 Main St, Tiffin, OH 44883 — Single family, 3,804 tokens
  // Last sold: $150,000 (2023). Current estimates: $138k–$177k
  '395 Main St, Tiffin, OH 44883': {
    fmv: 150000,
    source: 'Last sold $150,000 (2023); est $142k–$177k (Feb 2026 Realtor.com)',
    date: '2026-03-25',
    notes: '3BR/1BA, 1,402 sqft, built 1962. Tiffin OH market flat.',
  },

  // ─── Not in LoftyAssist (pre-tokenization / DAO-owned) ────────────────────

  // 1 Coolwood Dr, Little Rock, AR — Condo complex, Coolwood DAO tokens
  // Units recently sold/listed: $87k–$111k (Redfin/Realtor.com 2023–2026)
  // Not in LoftyAssist API. Referenced separately via COOLWOOD_ASA tokens.
  '1 Coolwood Dr, Little Rock, AR 72202': {
    fmv: null, // Coolwood handled via COOLWOOD_ASA + separate mortgage tracking
    source: 'Coolwood units: $87k–$111k recent sales (Redfin/Realtor.com)',
    date: '2026-03-25',
    notes: 'Coolwood mortgage removed from frontend (2026-03-24). 23,255 tokens in W1.',
  },
};

// ─── FMV per token lookup ──────────────────────────────────────────────────
// Returns FMV per token, or null if no override
export function getFmvPerToken(address, totalTokens) {
  const override = propertyFmv[address];
  if (override && override.fmv && totalTokens > 0) {
    return override.fmv / totalTokens;
  }
  return null;
}

// ─── LP discount/premium to FMV ──────────────────────────────────────────
// Returns % discount (negative = premium)
export function getFmvDiscount(address, lpPricePerToken, totalTokens) {
  const fmvPerToken = getFmvPerToken(address, totalTokens);
  if (fmvPerToken == null || lpPricePerToken == null) return null;
  return ((lpPricePerToken - fmvPerToken) / fmvPerToken) * 100;
}
