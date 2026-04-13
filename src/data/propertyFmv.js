// Property FMV — sourced from Yhome Transition Reconciliation oracle + LoftyAssist market valuations
// Updated: 2026-03-28
// Sources: Yhome Transition Reconciliation.xlsx (oracle NAV per token × tokens_outstanding),
//          LoftyAssist Market Price Valuations, Redfin/Realtor.com sold comps, Zillow estimates
//
// Priority: fmvOverride > oraclePrice (Yhome/Supabase AVM) > tokenValue (Lofty stated)
// FMV per token = fmv / totalTokens
// Earl's holding FMV = (fmv / totalTokens) * earlTokens

export const propertyFmv = {
  // ─── Yhome Transition Reconciliation Oracle (Sheet 3 - Deeded & Sold) ────

  // 3139 West Blvd, Cleveland, OH 44111 — Single family, 4,486 tokens
  // Oracle NAV: $52.59/token × 4,486 = $235,917
  // Market: $26.78 LP → ~49% discount to oracle NAV
  '3139 West Blvd, Cleveland, OH 44111': {
    fmv: 235917,
    source: 'Yhome Transition Reconciliation (Sheet 3 - Deeded & Sold), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $52.59/token. Replaces placeholder. Market trading ~49% below oracle NAV.',
  },

  // 4318 Clybourne Ave, Cleveland, OH 44109 — 2-unit multi-family, 4,819 tokens
  // Oracle NAV: $85.76/token × 4,819 = $413,290
  '4318 Clybourne Ave, Cleveland, OH 44109': {
    isTotalFmv: true,
    fmv: 413290,
    source: 'Yhome Transition Reconciliation (Sheet 3), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $85.76/token. LP trades at ~$18.69 → massive discount.',
  },

  // 1090 Diagonal Rd, Akron, Ohio 44320 — Single family, 1,797 tokens
  // Oracle NAV: $30.05/token × 1,797 = $54,004
  // No LP price — property being divested
  '1090 Diagonal Rd, Akron, Ohio 44320': {
    isTotalFmv: true,
    fmv: 54004,
    source: 'Yhome Transition Reconciliation (Sheet 3 - Deeded & Sold), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $30.05/token. No LP price — sold/divested.',
  },

  // 1845 W 48th St, Cleveland, Ohio 44102 — 2-unit multi-family, 4,430 tokens
  // Oracle NAV: $48.31/token × 4,430 = $214,027
  '1845 W 48th St, Cleveland, Ohio 44102': {
    isTotalFmv: true,
    fmv: 214027,
    source: 'Yhome Transition Reconciliation (Sheet 3), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $48.31/token. LP at $17.05 → ~65% discount.',
  },

  // ─── Yhome Transition Reconciliation Oracle (Sheet 1 - Cleveland) ───────────

  // 428 Cross St, Akron, OH 44311 — 3-unit multi-family, 4,882 tokens
  // Oracle NAV: $49.49/token × 4,882 = $241,627
  '428 Cross St, Akron, OH 44311': {
    isTotalFmv: true,
    fmv: 241627,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $49.49/token. LP at $23.42 → ~53% discount.',
  },

  // 3493 W 119th St, Cleveland, Ohio 44111 — Single family, 2,258 tokens
  // Oracle NAV: $60.84/token × 2,258 = $137,366
  '3493 W 119th St, Cleveland, Ohio 44111': {
    isTotalFmv: true,
    fmv: 137366,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $60.84/token. LP at $26.78 → ~56% discount.',
  },

  // 918 Frederick Blvd, Akron, Ohio 44320 — Single family, 1,560 tokens
  // Oracle NAV: $66.33/token × 1,560 = $103,475
  '918 Frederick Blvd, Akron, Ohio 44320': {
    isTotalFmv: true,
    fmv: 103475,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $66.33/token. LP at $31.46 → ~53% discount.',
  },

  // 1456 W 85th St, Cleveland, OH 44102 — 3-unit multi-family, 4,662 tokens
  // Oracle NAV: $58.64/token × 4,662 = $273,364
  '1456 W 85th St, Cleveland, OH 44102': {
    isTotalFmv: true,
    fmv: 273364,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $58.64/token. LP at $24.54 → ~58% discount.',
  },

  // 3905 E 189th St, Cleveland, OH 44122 — Single family, 2,352 tokens
  // Oracle NAV: $54.70/token × 2,352 = $128,664
  '3905 E 189th St, Cleveland, OH 44122': {
    isTotalFmv: true,
    fmv: 128664,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $54.70/token. LP at $27.22 → ~50% discount.',
  },

  // 4920 E 110th St, Garfield Heights, OH 44125 — Single family, 2,509 tokens
  // Oracle NAV: $54.31/token × 2,509 = $136,268
  '4920 E 110th St, Garfield Heights, OH 44125': {
    isTotalFmv: true,
    fmv: 136268,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $54.31/token. LP at $39.13 → ~28% discount.',
  },

  // 9634 S Green St, Chicago, IL 60643 — Single family, 3,367 tokens
  // Oracle NAV: $53.41/token × 3,367 = $179,843
  '9634 S Green St, Chicago, IL 60643': {
    isTotalFmv: true,
    fmv: 179843,
    source: 'Yhome Transition Reconciliation (Sheet 2 - Chicago), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $53.41/token. LP at $22.60 → ~58% discount.',
  },

  // 5541 S Peoria St, Chicago, IL 60621 — 2-unit multi-family, 5,728 tokens
  // Oracle NAV: $53.43/token × 5,728 = $306,031
  '5541 S Peoria St, Chicago, IL 60621': {
    isTotalFmv: true,
    fmv: 306031,
    source: 'Yhome Transition Reconciliation (Sheet 2 - Chicago), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $53.43/token. LP at $29.22 → ~45% discount.',
  },

  // 8143 S Sangamon St, Chicago, IL 60620 — 2-unit multi-family, 7,021 tokens
  // Oracle NAV: $48.41/token × 7,021 = $339,909
  '8143 S Sangamon St, Chicago, IL 60620': {
    isTotalFmv: true,
    fmv: 339909,
    source: 'Yhome Transition Reconciliation (Sheet 2 - Chicago), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $48.41/token. LP at $23.08 → ~52% discount.',
  },

  // 25 Circle Dr, Dixmoor, IL 60426 — Single family, 2,922 tokens
  // Oracle NAV: $44.03/token × 2,922 = $128,670
  '25 Circle Dr, Dixmoor, IL 60426': {
    isTotalFmv: true,
    fmv: 128670,
    source: 'Yhome Transition Reconciliation (Sheet 2 - Chicago), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $44.03/token. LP at $23.50 → ~47% discount.',
  },

  // 7542 and 7656 S Colfax Ave, Chicago, IL 60649 — 6-unit multi-family, 16,168 tokens
  // Oracle NAV: $41.34/token × 16,168 = $668,332
  '7542 and 7656 S Colfax Ave, Chicago, IL 60649': {
    isTotalFmv: true,
    fmv: 668332,
    source: 'Yhome Transition Reconciliation (Sheet 2 - Chicago), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $41.34/token. LP at $24.92 → ~40% discount. Largest holding.',
  },

  // 15555 Millard Ave, Markham, IL 60428 — Single family, 3,208 tokens
  // Oracle NAV: $36.11/token × 3,208 = $115,848
  '15555 Millard Ave, Markham, IL 60428': {
    isTotalFmv: true,
    fmv: 115848,
    source: 'Yhome Transition Reconciliation (Sheet 2 - Chicago), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $36.11/token. LP at $20.98 → ~42% discount.',
  },

  // 1278 E 187th St, Cleveland, OH 44110 — Single family, 1,717 tokens
  // Oracle NAV: $55.34/token × 1,717 = $95,020
  '1278 E 187th St, Cleveland, OH 44110': {
    isTotalFmv: true,
    fmv: 95020,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $55.34/token. LP at $17.78 → ~68% discount.',
  },

  // 16713 Lotus Dr, Cleveland, OH 44128 — Single family, 2,344 tokens
  // Oracle NAV: $46.95/token × 2,344 = $110,049
  '16713 Lotus Dr, Cleveland, OH 44128': {
    isTotalFmv: true,
    fmv: 110049,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $46.95/token. LP at $32.59 → ~31% discount.',
  },

  // 10917 Fidelity Ave, Cleveland, OH 44111 — Single family, 3,254 tokens
  // Oracle NAV: $53.17/token × 3,254 = $173,024
  '10917 Fidelity Ave, Cleveland, OH 44111': {
    isTotalFmv: true,
    fmv: 173024,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $53.17/token. LP at $33.82 → ~36% discount.',
  },

  // 11400 Linnet Ave, Cleveland, OH 44111 — Single family, 3,012 tokens
  // Oracle NAV: $48.23/token × 3,012 = $145,268
  '11400 Linnet Ave, Cleveland, OH 44111': {
    isTotalFmv: true,
    fmv: 145268,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $48.23/token. LP at $34.76 → ~28% discount.',
  },

  // 2094 W 34th Place, Cleveland, OH 44113 — Single family, 4,266 tokens
  // Oracle NAV: $35.79/token × 4,266 = $152,684
  '2094 W 34th Place, Cleveland, OH 44113': {
    isTotalFmv: true,
    fmv: 152684,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $35.79/token. LP at $17.21 → ~52% discount.',
  },

  // 8708 Willard Ave, Cleveland, OH 44102 — Single family, 2,638 tokens
  // Oracle NAV: $40.52/token × 2,638 = $106,901
  '8708 Willard Ave, Cleveland, OH 44102': {
    isTotalFmv: true,
    fmv: 106901,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $40.52/token. LP at $27.92 → ~31% discount.',
  },

  // 4183 E 146th St, Cleveland, OH 44128 — Single family, 1,939 tokens
  // Oracle NAV: $43.02/token × 1,939 = $83,417
  '4183 E 146th St, Cleveland, OH 44128': {
    isTotalFmv: true,
    fmv: 83417,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $43.02/token. LP at $19.54 → ~55% discount.',
  },

  // 3178 W 41st St, Cleveland, Ohio 44109 — Single family, 1,979 tokens
  // Oracle NAV: $45.93/token × 1,979 = $90,893
  '3178 W 41st St, Cleveland, Ohio 44109': {
    isTotalFmv: true,
    fmv: 90893,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $45.93/token. LP at $14.66 → ~68% discount.',
  },

  // 3850 W 17th St, Cleveland, Ohio 44109 — 2-unit multi-family, 3,334 tokens
  // Oracle NAV: $23.11/token × 3,334 = $77,048
  '3850 W 17th St, Cleveland, Ohio 44109': {
    isTotalFmv: true,
    fmv: 77048,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $23.11/token. LP at $23.32 → near par.',
  },

  // 26931 Shoreview Ave, Euclid, OH 44132 — Single family, 2,684 tokens
  // Oracle NAV: $28.66/token × 2,684 = $76,914
  '26931 Shoreview Ave, Euclid, OH 44132': {
    isTotalFmv: true,
    fmv: 76914,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $28.66/token. LP at $21.96 → ~23% discount.',
  },

  // 12028 Wade Park Ave, Cleveland, OH 44106 — Single family, 4,442 tokens
  // Oracle NAV: $32.53/token × 4,442 = $144,479
  '12028 Wade Park Ave, Cleveland, OH 44106': {
    isTotalFmv: true,
    fmv: 144479,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $32.53/token. LP at $14.44 → ~56% discount.',
  },

  // 783 Leonard St, Akron, OH 44307 — Single family, 1,661 tokens
  // Oracle NAV: $26.77/token × 1,661 = $44,465
  '783 Leonard St, Akron, OH 44307': {
    isTotalFmv: true,
    fmv: 44465,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $26.77/token. LP at $23.58 → ~12% discount.',
  },

  // 1432 Sara Ave, Akron, Ohio 44305 — Single family, 1,950 tokens
  // Oracle NAV: $14.72/token × 1,950 = $28,703
  '1432 Sara Ave, Akron, Ohio 44305': {
    isTotalFmv: true,
    fmv: 28703,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $14.72/token. LP at $15.39 → ~5% premium to oracle.',
  },

  // 10724 Gooding Ave, Cleveland, OH 44108 — 2-unit multi-family, 2,501 tokens
  // Oracle NAV: $46.50/token × 2,501 = $116,309
  '10724 Gooding Ave, Cleveland, OH 44108': {
    isTotalFmv: true,
    fmv: 116309,
    source: 'Yhome Transition Reconciliation (Sheet 1 - Cleveland), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $46.50/token. LP at $15.10 → ~68% discount.',
  },

  // 1236 W 7th St, Davenport, IA 52802 — Condemned, 1,667 tokens
  // Oracle NAV: $6.07/token × 1,667 = $10,117 (distressed — condemned property)
  '1236 W 7th St, Davenport, IA 52802': {
    isTotalFmv: true,
    fmv: 10117,
    source: 'Yhome Transition Reconciliation (Sheet 2 - Chicago), 2026-03-28',
    date: '2026-03-28',
    notes: 'Oracle NAV: $6.07/token. Condemned property — distressed valuation.',
  },

  // ─── LoftyAssist / Comps-Based Valuations ──────────────────────────────────

  // 84 Madison Ave, Albany, NY 12202 — Multi-family, 7,821 tokens
  // Last sold: $260,000 (Dec 2024, Redfin). Feb 2026 est: $259k–$286k
  '84 Madison Ave, Albany, NY 12202': {
    fmv: 265000,
    source: 'Redfin/Realtor.com (Dec 2024 sale + 3% LTM appreciation)',
    date: '2026-03-25',
    notes: 'Multi-family, 2,600 sqft, built 1815. LP at $59.79 → premium to comps.',
  },

  // 86 Madison Ave, Albany, NY 12202 — Multi-family, 7,361 tokens
  '86 Madison Ave, Albany, NY 12202': {
    fmv: 225000,
    source: 'Realtor.com/CoreLogic/Quantarium estimates (Feb 2026)',
    date: '2026-03-25',
    notes: '5BR/2BA multi-family, 2,496 sqft, built 1901.',
  },

  // 88 Madison Ave, Albany, NY 12202 — Multi-family, 7,455 tokens
  '88 Madison Ave, Albany, NY 12202': {
    fmv: 275000,
    source: 'Estimated from 84 Madison Ave comp + 3% growth (Dec 2024–Mar 2026)',
    date: '2026-03-25',
    notes: 'Madison Ave cluster.',
  },

  // 90 Madison Ave, Albany, NY 12202 — Multi-family, 6,450 tokens
  '90 Madison Ave, Albany, NY 12202': {
    fmv: 274557,
    source: 'LoftyAssist Market Price Valuation (Feb 25, 2026)',
    date: '2026-02-25',
    notes: 'PropertyShark assessed: $201k.',
  },

  // 9 Country Club Ln N, Briarcliff Manor, NY 10510 — Vacation rental, 39,213 tokens
  // SOLD: $2,100,000 (May 2, 2025, Zillow)
  '9 Country Club Ln N, Briarcliff Manor, NY 10510': {
    fmv: 2100000,
    source: 'Zillow — Sold May 2, 2025 ($2.1M, 4BR/6BA, 4,151 sqft)',
    date: '2025-05-02',
    notes: 'Vacation rental. LP at $20.21 → massive discount to sold price.',
  },

  // 1821 Donetto Dr, Leander, TX 78641 — Single family, 12,754 tokens
  '1821 Donetto Dr, Leander, TX 78641': {
    fmv: 580000,
    source: 'Redfin ($587k) + Realtor.com ($570k) + CoreLogic ($604k), Feb 2026',
    date: '2026-03-25',
    notes: '5BR/4BA, ~2,880 sqft, built 2022.',
  },

  // 3761 Jade Ave, Las Cruces, NM 88012 — Vacation rental, 6,272 tokens
  '3761 Jade Ave, Las Cruces, NM 88012': {
    fmv: 235000,
    source: 'Realtor.com ($244k) + CoreLogic ($266k) + Quantarium ($201k), Feb 2026',
    date: '2026-03-25',
    notes: '3BR/2BA, 1,602 sqft, built 1988. Vacation rental.',
  },

  // 217 McClallen Dr, Killington, VT 05751 — Vacation rental, 18,461 tokens
  '217 McClallen Dr, Killington, VT 05751': {
    fmv: 950000,
    source: 'Estimated from Killington STR market (no recent comps available)',
    date: '2026-03-25',
    notes: 'Killington ski resort. LP $53.44 vs tokenValue $50.02.',
  },

  // 2221 E Chase St, Baltimore, MD 21213 — Vacation rental, 5,546 tokens
  '2221 E Chase St, Baltimore, MD 21213': {
    fmv: 360574,
    source: 'LoftyAssist Market Price Valuation ($360,574 vs listing $279k)',
    date: '2026-03-25',
    notes: '716 sqft townhouse, fully renovated. Vacation rental premium.',
  },

  // 395 Main St, Tiffin, OH 44883 — Single family, 3,804 tokens
  '395 Main St, Tiffin, OH 44883': {
    fmv: 150000,
    source: 'Last sold $150,000 (2023); est $142k–$177k (Feb 2026 Realtor.com)',
    date: '2026-03-25',
    notes: '3BR/1BA, 1,402 sqft, built 1962.',
  },

  // 3634 Bosworth Rd, Cleveland, OH 44111 — Large multi-family, 10,408 tokens
  // No LP price — likely being divested
  '3634 Bosworth Rd, Cleveland, OH 44111': {
    isTotalFmv: true,
    fmv: 427590,
    source: 'LoftyAssist totalInvestment ($427,590)',
    date: '2026-03-28',
    notes: 'No LP price — property being divested. totalInvestment used as FMV proxy.',
  },

  // 3634 Bosworth Rd Rear, Cleveland, OH 44111 — Rear unit
  '3634 Bosworth Rd Rear, Cleveland, OH 44111': {
    isTotalFmv: true,
    fmv: 0,
    source: 'No data available',
    date: '2026-03-28',
    notes: 'Rear unit of 3634 Bosworth. Zero FMV indicated in Yhome sheet.',
  },

  // 4318 Clybourne Ave - REAR, Cleveland, OH 44109 — Rear unit
  '4318 Clybourne Ave - REAR, Cleveland, OH 44109': {
    isTotalFmv: true,
    fmv: 0,
    source: 'Yhome Transition Reconciliation (Sheet 3) — REAR unit has $0 owners equity',
    date: '2026-03-28',
    notes: 'Rear unit. $0 in Yhome oracle — not a separateFMable asset.',
  },

  // ─── Not in LoftyAssist (pre-tokenization / DAO-owned) ────────────────────

  // 1 Coolwood Dr, Little Rock, AR — Condo complex, Coolwood DAO tokens
  '1 Coolwood Dr, Little Rock, AR 72202': {
    isTotalFmv: true,
    fmv: 1188000,
    source: 'Recent unit sales/listings: $87k–$111k per unit (midpoint-based portfolio FMV)',
    date: '2026-03-28',
    notes: 'Estimated gross property FMV using midpoint of recent unit sales/listings (~$99k) across the Coolwood complex. Used for holding FMV display.',
  },

  // Universal Lending DAO (ULD), Sheridan, Wyoming 82801
  // NAV per token: $52.92 (LoftyDeals NAV_PER_TOKEN_OVERRIDES)
  'Universal Lending DAO (ULD), Sheridan, Wyoming 82801': {
    isTotalFmv: true,
    fmv: 120342,
    source: 'Listing NAV $52.92 × 2,274 tokens',
    date: '2026-03-28',
    notes: 'NAV: $52.92/token. LP at $53.62 → near par.',
  },
};

// ─── FMV per token lookup ──────────────────────────────────────────────────
// Returns FMV per token, or null if no override
export function getFmvPerToken(address, totalTokens) {
  const override = propertyFmv[address];
  if (!override || override.fmv == null || totalTokens <= 0) return null;

  // When FMV is stored as total property FMV, convert to per-token.
  if (override.isTotalFmv) {
    return override.fmv / totalTokens;
  }

  // Legacy/manual entries already store total property FMV too; keep same behavior.
  return override.fmv / totalTokens;
}

// ─── LP discount/premium to FMV ──────────────────────────────────────────
// Returns % discount (negative = premium)
export function getFmvDiscount(address, lpPricePerToken, totalTokens) {
  const fmvPerToken = getFmvPerToken(address, totalTokens);
  if (fmvPerToken == null || lpPricePerToken == null) return null;
  return ((lpPricePerToken - fmvPerToken) / fmvPerToken) * 100;
}
