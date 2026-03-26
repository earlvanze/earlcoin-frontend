import { supabase } from '@/lib/customSupabaseClient';
import { useState, useEffect } from 'react';
import { 
  WALLETS, 
  INDEXER_BASE, 
  LOFTY_API, 
  COOLWOOD_ASA, 
  COOLWOOD_TOKEN_PRICE, 
  COOLWOOD_MORTGAGE,
  SOLAR_ASA,
  SOLAR_TOKEN_PRICE,
  SOLAR_TOTAL_SHARES,
  SOLAR_EQUITY_SHARES,
  SOLAR_ESCROW_SHARES,
  SOLAR_LOAN_BALANCE,
} from '@/lib/wallets';

async function fetchAllAssets(address) {
  const url = `${INDEXER_BASE}/v2/accounts/${address}/assets?limit=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Indexer error for ${address}: ${res.status}`);
  const data = await res.json();
  return (data.assets || []).filter(a => a.amount > 0).map(a => ({
    assetId: a['asset-id'],
    amount: a.amount,
  }));
}

async function fetchLoftyProperties() {
  const res = await fetch(LOFTY_API);
  if (!res.ok) throw new Error(`LoftyAssist error: ${res.status}`);
  return res.json();
}

async function fetchPortfolioAvmRows() {
  const { data, error } = await supabase
    .from('lofty_portfolio_avm')
    .select('property_id, address, avm, tokens_outstanding, total_investment, market_cap, avm_corrected, avm_source, data_fetch_date');

  if (error) throw new Error(`Supabase AVM error: ${error.message}`);
  return data || [];
}

function buildAvmLookup(avmRows) {
  const byAddress = {};
  const byPropertyId = {};

  for (const row of avmRows) {
    const totalTokens = row.tokens_outstanding || null;
    const fallbackTokens = totalTokens && totalTokens > 0 ? totalTokens : null;
    const avmPerToken = row.avm != null && fallbackTokens ? row.avm / fallbackTokens : null;
    const marketCapPerToken = row.market_cap != null && fallbackTokens ? row.market_cap / fallbackTokens : null;
    const entry = {
      ...row,
      avmPerToken,
      marketCapPerToken,
    };

    if (row.address) byAddress[row.address] = entry;
    if (row.property_id) byPropertyId[row.property_id] = entry;
  }

  return { byAddress, byPropertyId };
}

function getAvmPerToken(avmLookup, address, propertyId, totalTokens) {
  const entry = (propertyId && avmLookup.byPropertyId[propertyId]) || avmLookup.byAddress[address];
  if (!entry) return null;
  if (entry.avmPerToken != null) return entry.avmPerToken;
  if (entry.avm != null && totalTokens > 0) return entry.avm / totalTokens;
  return null;
}

async function fetchAssetMetadata(assetId) {
  try {
    const res = await fetch(`${INDEXER_BASE}/v2/assets/${assetId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.asset?.params;
    if (!a) return null;
    return { name: a.name || a['unit-name'] || String(assetId), unitName: a['unit-name'] || '', decimals: a.decimals ?? 0 };
  } catch { return null; }
}


function buildPropertyLookup(loftyData) {
  const lookup = {};
  for (const item of loftyData) {
    const p = item.property;
    const lp = item.liquidityPool || {};
    const entry = {
      address: p.address,
      state: p.state,
      tokenValue: p.tokenValue,
      capRate: p.cap_rate,
      coc: p.coc || 0,  // Cash-on-cash return (actual rental yield)
      monthlyRent: p.monthly_rent,
      noi: p.netOperatingIncome,
      lpPrice: lp.price || p.tokenValue,
      // Keep LP APY as separate field (for reference only)
      lpApy7d: lp.apy7d?.base || 0,
      lpApy30d: lp.apy30d?.base || 0,
      totalInvestment: p.totalInvestment,
      totalTokens: p.tokens,
      totalLoans: item.totalLoans || 0,
      listingStatus: p.listingStatus,
      propertyId: p.id || p.slug || null,
      assetId: p.assetId,
    };
    lookup[p.assetId] = entry;
    if (p.newAssetId) lookup[p.newAssetId] = entry;
  }
  return lookup;
}

export function usePortfolioData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Fetch assets from all wallets
        const [w1Assets, treasuryAssets, govAdminAssets, loftyRaw, avmRows] = await Promise.all([
          fetchAllAssets(WALLETS.W1),
          fetchAllAssets(WALLETS.TREASURY),
          fetchAllAssets(WALLETS.GOV_ADMIN).catch(() => []), // May not exist yet
          fetchLoftyProperties(),
          fetchPortfolioAvmRows(),
        ]);

        const lookup = buildPropertyLookup(loftyRaw);
        const avmLookup = buildAvmLookup(avmRows);
        const allAssets = [
          ...w1Assets.map(a => ({ ...a, wallet: 'W1' })),
          ...treasuryAssets.map(a => ({ ...a, wallet: 'Treasury' })),
          ...govAdminAssets.map(a => ({ ...a, wallet: 'GovAdmin' })),
        ];

        const properties = [];
        let coolwoodTreasuryTokens = 0;
        let coolwoodEscrowTokens = 0;
        let solarTreasuryTokens = 0;
        let solarEscrowTokens = 0;

        for (const asset of allAssets) {
          // Track Coolwood tokens separately by wallet
          // W1/TREASURY = DAO equity
          // GOV_ADMIN = escrow/collateral (NOT DAO equity)
          if (asset.assetId === COOLWOOD_ASA) {
            if (asset.wallet === 'GovAdmin') {
              coolwoodEscrowTokens += asset.amount;
            } else {
              coolwoodTreasuryTokens += asset.amount;
            }
            continue;
          }
          
          // Track Solar tokens separately by wallet
          // TREASURY = DAO equity (actual ownership)
          // GOV_ADMIN = Loan escrow (collateral, NOT DAO equity)
          if (SOLAR_ASA && asset.assetId === SOLAR_ASA) {
            if (asset.wallet === 'Treasury') {
              solarTreasuryTokens += asset.amount; // Equity tokens
            } else if (asset.wallet === 'GovAdmin') {
              solarEscrowTokens += asset.amount; // Escrow tokens (loan collateral)
            }
            continue;
          }

          const prop = lookup[asset.assetId];
          if (prop) {
            const existing = properties.find(p => p.address === prop.address);
            if (existing) {
              existing.tokens += asset.amount;
              existing.value = existing.tokens * existing.lpPrice;
              existing.fmv = existing.tokens * (getAvmPerToken(avmLookup, existing.address, existing.propertyId, existing.totalTokens) || existing.tokenValue);
            } else {
              properties.push({
                address: prop.address,
                state: prop.state,
                tokens: asset.amount,
                lpPrice: prop.lpPrice,
                tokenValue: prop.tokenValue,
                totalInvestment: prop.totalInvestment,
                totalTokens: prop.totalTokens,
                totalLoans: prop.totalLoans,
                value: asset.amount * prop.lpPrice,
                fmv: asset.amount * (getAvmPerToken(avmLookup, prop.address, prop.propertyId, prop.totalTokens) || prop.tokenValue),
                capRate: prop.capRate,
                propertyId: prop.propertyId,
                avmSource: avmLookup.byAddress[prop.address]?.avm_source || avmLookup.byPropertyId[prop.propertyId]?.avm_source || null,
                avmCorrected: avmLookup.byAddress[prop.address]?.avm_corrected || avmLookup.byPropertyId[prop.propertyId]?.avm_corrected || false,
                coc: prop.coc,  // Cash-on-cash (actual yield)
                lpApy7d: prop.lpApy7d,  // LP trading APY (reference only)
                monthlyRent: prop.monthlyRent,
                listingStatus: prop.listingStatus,
                wallet: asset.wallet,
                assetId: asset.assetId,
              });
            }
          }
        }

        // Collect non-Lofty, non-Coolwood, non-Solar assets as crypto
        const knownAssetIds = new Set(Object.keys(lookup).map(Number));
        knownAssetIds.add(COOLWOOD_ASA);
        if (SOLAR_ASA) knownAssetIds.add(SOLAR_ASA);
        const unknownAssets = allAssets.filter(a => !knownAssetIds.has(a.assetId));

        // Deduplicate by assetId (sum across wallets)
        const cryptoMap = {};
        for (const a of unknownAssets) {
          if (!cryptoMap[a.assetId]) cryptoMap[a.assetId] = { assetId: a.assetId, amount: 0 };
          cryptoMap[a.assetId].amount += a.amount;
        }

        // Fetch metadata for each unknown asset
        const cryptoRaw = await Promise.all(
          Object.values(cryptoMap).map(async ({ assetId, amount }) => {
            const meta = await fetchAssetMetadata(assetId);
            const decimals = meta?.decimals ?? 0;
            const unitName = meta?.unitName || meta?.name || String(assetId);
            const realAmount = amount / Math.pow(10, decimals);
            const usdValue = assetId === 31566704 ? realAmount : null;
            return {
              assetId,
              name: meta?.name || unitName,
              symbol: unitName,
              amount: realAmount,
              decimals,
              usdValue,
            };
          })
        );

        // Filter dust: keep anything with realAmount >= 0.001
        // LP tokens (BaseLP/QuoteLP) are intentionally kept — they represent staking positions
        const cryptoAssets = cryptoRaw.filter(a => a.amount >= 0.001);

        properties.sort((a, b) => b.value - a.value);

        const coolwoodTokens = coolwoodTreasuryTokens;
        const coolwood = coolwoodTokens > 0 ? {
          address: '1 Coolwood Dr, Little Rock, AR 72202',
          state: 'AR',
          tokens: coolwoodTokens,
          lpPrice: COOLWOOD_TOKEN_PRICE,
          tokenValue: COOLWOOD_TOKEN_PRICE,
          value: coolwoodTokens * COOLWOOD_TOKEN_PRICE,
          capRate: null,
          coc: null,
          lpApy7d: null,
          monthlyRent: null,
          wallet: 'Treasury',
          assetId: COOLWOOD_ASA,
          mortgage: COOLWOOD_MORTGAGE,
          isCoolwood: true,
        } : null;

        // Build solar asset data from actual on-chain balances
        // TREASURY = DAO equity (actual ownership)
        // GOV_ADMIN = Loan escrow (collateral, NOT DAO equity)
        const solarTotalTokens = solarTreasuryTokens + solarEscrowTokens;
        const solarAsset = (SOLAR_ASA && solarTotalTokens > 0) ? {
          assetId: SOLAR_ASA,
          treasuryShares: solarTreasuryTokens,      // From TREASURY wallet (DAO equity)
          escrowShares: solarEscrowTokens,           // From GOV_ADMIN wallet (loan escrow)
          totalShares: solarTotalTokens,
          tokenPrice: SOLAR_TOKEN_PRICE,
          totalValue: solarTotalTokens * SOLAR_TOKEN_PRICE,
          treasuryValue: solarTreasuryTokens * SOLAR_TOKEN_PRICE,
          escrowValue: solarEscrowTokens * SOLAR_TOKEN_PRICE,
          loanBalance: SOLAR_LOAN_BALANCE,
          equity: solarTreasuryTokens * SOLAR_TOKEN_PRICE, // Only Treasury counts as equity
        } : null;

        const stateValues = {};
        if (coolwood) {
          stateValues[coolwood.state] = (stateValues[coolwood.state] || 0) + coolwood.value;
        }
        for (const p of properties) {
          stateValues[p.state] = (stateValues[p.state] || 0) + p.value;
        }

        const loftyGross = properties.reduce((s, p) => s + p.value, 0);
        const totalMortgage = properties.reduce((s, p) => {
          if (!p.totalTokens || !p.totalLoans) return s;
          return s + Math.round(p.totalLoans * (p.tokens / p.totalTokens));
        }, 0) + (coolwood ? coolwood.mortgage : 0);
        const loftyFmv = properties.reduce((s, p) => s + (p.fmv || p.value), 0);
        const coolwoodGross = coolwood ? coolwood.value : 0;
        const totalGross = loftyGross + coolwoodGross;
        const totalFmv = loftyFmv + coolwoodGross;

        // Find top CoC property (actual rental yield, not LP APY)
        const topCoc = properties.reduce((best, p) => 
          (p.coc || 0) > (best.coc || 0) ? p : best, 
          { coc: 0, address: 'N/A' }
        );

        if (!cancelled) {
          setData({
            properties,
            coolwood,
            solarAsset,  // New: dynamic solar data
            stateValues,
            loftyGross,
            coolwoodGross,
            totalGross,
            totalFmv,
            loftyFmv,
            totalMortgage: coolwood ? COOLWOOD_MORTGAGE : 0,
            propertyCount: properties.length + (coolwood ? 1 : 0),
            stateCount: Object.keys(stateValues).length,
            coolwoodTokens,
            coolwoodEscrowTokens,
            topCoc,  // Renamed from topApy
            cryptoAssets,
          });
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Portfolio fetch error:', err);
          setError(err.message);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error, lastUpdated };
}
