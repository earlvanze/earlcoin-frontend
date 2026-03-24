import { useState, useEffect } from 'react';
import { WALLETS, INDEXER_BASE, LOFTY_API, COOLWOOD_ASA, COOLWOOD_TOKEN_PRICE, COOLWOOD_MORTGAGE } from '@/lib/wallets';

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
      monthlyRent: p.monthly_rent,
      noi: p.netOperatingIncome,
      lpPrice: lp.price || p.tokenValue,
      apy7d: lp.apy7d?.base || 0,
      apy30d: lp.apy30d?.base || 0,
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
        const [w1Assets, treasuryAssets, loftyRaw] = await Promise.all([
          fetchAllAssets(WALLETS.W1),
          fetchAllAssets(WALLETS.TREASURY),
          fetchLoftyProperties(),
        ]);

        const lookup = buildPropertyLookup(loftyRaw);
        const allAssets = [
          ...w1Assets.map(a => ({ ...a, wallet: 'W1' })),
          ...treasuryAssets.map(a => ({ ...a, wallet: 'Treasury' })),
        ];

        const properties = [];
        let coolwoodTokens = 0;

        for (const asset of allAssets) {
          if (asset.assetId === COOLWOOD_ASA) {
            coolwoodTokens += asset.amount;
            continue;
          }
          const prop = lookup[asset.assetId];
          if (prop) {
            const existing = properties.find(p => p.address === prop.address);
            if (existing) {
              existing.tokens += asset.amount;
              existing.value = existing.tokens * existing.lpPrice;
            } else {
              properties.push({
                address: prop.address,
                state: prop.state,
                tokens: asset.amount,
                lpPrice: prop.lpPrice,
                tokenValue: prop.tokenValue,
                value: asset.amount * prop.lpPrice,
                capRate: prop.capRate,
                apy7d: prop.apy7d,
                monthlyRent: prop.monthlyRent,
                wallet: asset.wallet,
                assetId: asset.assetId,
              });
            }
          }
        }

        properties.sort((a, b) => b.value - a.value);

        const coolwood = coolwoodTokens > 0 ? {
          address: '1 Coolwood Dr, Little Rock, AR 72202',
          state: 'AR',
          tokens: coolwoodTokens,
          lpPrice: COOLWOOD_TOKEN_PRICE,
          tokenValue: COOLWOOD_TOKEN_PRICE,
          value: coolwoodTokens * COOLWOOD_TOKEN_PRICE,
          capRate: null,
          apy7d: null,
          monthlyRent: null,
          wallet: 'Treasury',
          assetId: COOLWOOD_ASA,
          mortgage: COOLWOOD_MORTGAGE,
          isCoolwood: true,
        } : null;

        const stateValues = {};
        if (coolwood) {
          stateValues[coolwood.state] = (stateValues[coolwood.state] || 0) + coolwood.value;
        }
        for (const p of properties) {
          stateValues[p.state] = (stateValues[p.state] || 0) + p.value;
        }

        const loftyGross = properties.reduce((s, p) => s + p.value, 0);
        const coolwoodGross = coolwood ? coolwood.value : 0;
        const totalGross = loftyGross + coolwoodGross;

        // Find top APY property
        const topApy = properties.reduce((best, p) => 
          (p.apy7d || 0) > (best.apy7d || 0) ? p : best, 
          { apy7d: 0, address: 'N/A' }
        );

        if (!cancelled) {
          setData({
            properties,
            coolwood,
            stateValues,
            loftyGross,
            coolwoodGross,
            totalGross,
            totalMortgage: coolwood ? COOLWOOD_MORTGAGE : 0,
            propertyCount: properties.length + (coolwood ? 1 : 0),
            stateCount: Object.keys(stateValues).length,
            coolwoodTokens,
            topApy,
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
