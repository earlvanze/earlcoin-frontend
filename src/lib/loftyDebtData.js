/**
 * Lofty Debt/Leverage Data Utilities
 * Fetches property debt information from LoftyAssist API
 */

const LOFTYASSIST_API = 'https://www.loftyassist.com/api/properties';

// Cache to avoid repeated API calls
let cachedProperties = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all properties from LoftyAssist API
 */
async function fetchLoftyAssistData() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedProperties && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedProperties;
  }
  
  try {
    const response = await fetch(LOFTYASSIST_API);
    if (!response.ok) {
      throw new Error(`LoftyAssist API error: ${response.status}`);
    }
    
    cachedProperties = await response.json();
    cacheTimestamp = now;
    return cachedProperties;
  } catch (error) {
    console.error('Failed to fetch LoftyAssist data:', error);
    return cachedProperties || []; // Return stale cache if available
  }
}

/**
 * Find a property in LoftyAssist data by matching address or name
 */
function findProperty(properties, holding) {
  const searchTerms = [
    holding.propertyName?.toLowerCase(),
    holding.property?.toLowerCase(),
    holding.address?.toLowerCase(),
    holding.id?.toLowerCase(),
  ].filter(Boolean);
  
  return properties.find(prop => {
    const propAddress = prop.property?.address?.toLowerCase() || '';
    const propSlug = prop.property?.slug?.toLowerCase() || '';
    const propId = prop.property?.id?.toLowerCase() || '';
    
    return searchTerms.some(term => 
      propAddress.includes(term) || 
      term.includes(propAddress.split(',')[0]) ||
      propSlug.includes(term.replace(/[^a-z0-9]/g, '')) ||
      propId === term
    );
  });
}

/**
 * Enrich holdings with debt information from LoftyAssist
 */
export async function enrichHoldingsWithDebt(holdings) {
  if (!holdings || holdings.length === 0) return holdings;
  
  const properties = await fetchLoftyAssistData();
  if (!properties || properties.length === 0) return holdings;
  
  return holdings.map(holding => {
    const match = findProperty(properties, holding);
    
    if (!match) {
      return holding;
    }
    
    const prop = match.property || {};
    const totalLoans = match.totalLoans || 0;
    const totalInvestment = prop.totalInvestment || 0;
    const tokens = prop.tokens || 1;
    const sharesOwned = Number(holding.sharesOwned) || Number(holding.shares) || 0;
    
    // Calculate LTV
    const ltv = totalInvestment > 0 ? Math.round((totalLoans / totalInvestment) * 100) : 0;
    
    // Calculate user's proportional share of debt
    const ownershipPct = tokens > 0 ? sharesOwned / tokens : 0;
    const userShareOfDebt = Math.round(totalLoans * ownershipPct);
    
    return {
      ...holding,
      debtInfo: {
        hasDebt: totalLoans > 0,
        totalLoans: totalLoans,
        totalInvestment: totalInvestment,
        ltv: ltv,
        userShareOfDebt: userShareOfDebt,
        ownershipPercent: Math.round(ownershipPct * 10000) / 100, // 2 decimal places
      },
      marketData: {
        marketPrice: match.marketPrice,
        coc: match.coc ? Math.round(match.coc * 10000) / 100 : null,
        effectiveCoc: match.effectiveCoc ? Math.round(match.effectiveCoc * 10000) / 100 : null,
        neighborhoodScore: match.neighborhoodScore,
        cashFlowPositive: match.cashFlowPercentagePositive ? Math.round(match.cashFlowPercentagePositive * 100) : null,
        premiumDiscount: match.premiumOrDiscount ? Math.round(match.premiumOrDiscount * 100) : null,
      }
    };
  });
}

/**
 * Calculate portfolio-wide debt summary
 */
export function calculatePortfolioDebtSummary(enrichedHoldings) {
  if (!enrichedHoldings || enrichedHoldings.length === 0) {
    return null;
  }
  
  const withDebtInfo = enrichedHoldings.filter(h => h.debtInfo);
  const withDebt = withDebtInfo.filter(h => h.debtInfo.hasDebt);
  const highLtv = withDebt.filter(h => h.debtInfo.ltv > 60);
  
  const totalUserDebtExposure = withDebt.reduce((sum, h) => sum + (h.debtInfo.userShareOfDebt || 0), 0);
  const totalPropertyDebt = withDebt.reduce((sum, h) => sum + (h.debtInfo.totalLoans || 0), 0);
  
  const avgLtv = withDebt.length > 0
    ? Math.round(withDebt.reduce((sum, h) => sum + h.debtInfo.ltv, 0) / withDebt.length)
    : 0;
  
  return {
    totalPropertiesAnalyzed: withDebtInfo.length,
    propertiesWithDebt: withDebt.length,
    propertiesDebtFree: withDebtInfo.length - withDebt.length,
    highLtvCount: highLtv.length,
    totalUserDebtExposure: totalUserDebtExposure,
    totalPropertyDebt: totalPropertyDebt,
    averageLtv: avgLtv,
  };
}

/**
 * Get debt risk assessment for a single property
 */
export function getDebtRiskLevel(ltv) {
  if (!ltv || ltv === 0) return { level: 'none', color: 'green', label: 'Debt-Free' };
  if (ltv < 30) return { level: 'low', color: 'blue', label: 'Low Leverage' };
  if (ltv < 50) return { level: 'moderate', color: 'yellow', label: 'Moderate' };
  if (ltv < 70) return { level: 'elevated', color: 'orange', label: 'Elevated' };
  return { level: 'high', color: 'red', label: 'High Risk' };
}
