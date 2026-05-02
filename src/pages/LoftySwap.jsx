import React, { useCallback, useEffect, useMemo, useState } from 'react';
import algosdk from 'algosdk';
import { motion } from 'framer-motion';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Wallet, ArrowRightLeft, Building2, CheckCircle2, Search, AlertTriangle, Snowflake } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { fetchLpPrices } from '@/lib/loftyDeals';
import { algodClient } from '@/lib/algorand';
import { WALLETS, INDEXER_BASE, LOFTY_API } from '@/lib/wallets';
import { EARL_ASA_ID, INKIND_EXCHANGE_APP_ID } from '@/lib/config';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const EARL_PRICE = 100;
const EARL_DECIMALS = 6;
const LP_UNIT_PREFIXES = ['LP-', 'LP_'];

const formatCurrency = (v, d = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(Number(v || 0));

const LOFTY_CREATORS = new Set([
  'GQ46SBJ6Y5CJHJXLPTDBTHFJYEBI4LHPL5MOPCG5B6C4ONOG2RJHTM6VE',
  'LOFTYYD7TVIGMHGLUJLSJPHMQ7WCEIYSVDPSXPWOHXCYHOB3Y5BSBD57VU',
  'LOFTYRITC3QUX6TVQBGT3BARKWAZDEB2TTJWYQMH6YITKNH7IOMWRLC7SA',
]);

const LOFTY_UNIT_PREFIXES = ['LFTY'];

function isLpToken(unitName, name) {
  const u = (unitName || '').toUpperCase();
  const n = (name || '').toUpperCase();
  return LP_UNIT_PREFIXES.some(prefix => u.startsWith(prefix)) || n.startsWith('LP-') || n.startsWith('LP_');
}

async function fetchLoftyHoldings(walletAddress) {
  const url = `${INDEXER_BASE}/v2/accounts/${walletAddress}?include=all`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Indexer error: ${res.status}`);
  const data = await res.json();
  const assets = (data.assets || []).filter((a) => a.amount > 0);
  if (assets.length === 0) return [];

  // Batch asset lookups — use account response which already includes creator info
  // for assets created by the account holder. For Lofty tokens, we need to check
  // if each asset's creator is in LOFTY_CREATORS.
  // Strategy: fetch all assets in parallel (max 10 concurrent) and filter by creator.
  const batchSize = 10;
  const holdings = [];
  for (let i = 0; i < assets.length; i += batchSize) {
    const batch = assets.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (asset) => {
        try {
          const assetRes = await fetch(`${INDEXER_BASE}/v2/assets/${asset['asset-id']}`);
          if (!assetRes.ok) return null;
          const assetData = await assetRes.json();
          const params = assetData?.asset?.params || {};
          const isLoftyCreator = LOFTY_CREATORS.has(params.creator || '');
          const unitName = (params['unit-name'] || '').toUpperCase();
          const isLoftyUnit = LOFTY_UNIT_PREFIXES.some(p => unitName.startsWith(p));
          if (!isLoftyCreator && !isLoftyUnit) return null;
          return {
            assetId: asset['asset-id'],
            amount: asset.amount,
            decimals: params.decimals || 0,
            name: params.name || `ASA ${asset['asset-id']}`,
            unitName: params['unit-name'] || '',
            defaultFrozen: params['default-frozen'] || false,
            total: params.total || 0,
          };
        } catch { return null; }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) holdings.push(r.value);
    }
  }
  return holdings;
}

const getLoftyContractId = (liquidityPool, key) => (
  Number(
    liquidityPool?.apps?.contracts?.[key]
    ?? liquidityPool?.contracts?.[key]
    ?? liquidityPool?.[`${key}AppId`]
    ?? liquidityPool?.appId
    ?? 0
  ) || null
);

async function fetchLoftyAssistProperties() {
  try {
    const res = await fetch(LOFTY_API);
    if (!res.ok) return {};
    const items = await res.json();
    const map = {};
    for (const item of items) {
      const p = item?.property || {};
      const lp = item?.liquidityPool || {};
      const entry = {
        address: p.address || 'Unknown',
        city: p.market || p.city || '',
        state: p.state || '',
        tokenValue: p.tokenValue || null,
        listingStatus: p.listingStatus || null,
        // LP interface app ID for DODO PMM on-chain pricing
        lpInterfaceAppId: getLoftyContractId(lp, 'lpInterface'),
        // Admin app ID stores oracle + k params
        adminAppId: getLoftyContractId(lp, 'admin')
      };
      if (p.assetId) map[p.assetId] = entry;
      if (p.newAssetId) map[p.newAssetId] = entry;
    }
    return map;
  } catch { return {}; }
}

/**
 * Build an atomic swap group using the in-kind exchange smart contract.
 * Group: [app_call(exchange), axfer(lofty_token → app)]
 *
 * The contract computes the DODO PMM price on-chain and sends EARL back
 * via inner transaction — no trust, no Supabase order needed.
 */
async function buildAtomicSwapGroup({
  appId,
  sender,
  loftyAsaId,
  loftyAmount,
  adminAppId,
  lpInterfaceAppId,
  peraWallet,
}) {
  const params = await algodClient.getTransactionParams().do();

  // Transaction 1: App call — exchange(sender, loftyAsa, adminApp, lpInterface)
  const appCall = algosdk.makeApplicationCallTxnFromObject({
    from: sender,
    appIndex: appId,
    appArgs: [
      new TextEncoder().encode('exchange'),
    ],
    foreignApps: [adminAppId, lpInterfaceAppId],
    foreignAssets: [loftyAsaId, EARL_ASA_ID],
    suggestedParams: params,
  });

  // Transaction 2: Asset transfer — send Lofty tokens to the app
  const tokenPayment = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: sender,
    to: algosdk.getApplicationAddress(appId),
    amount: loftyAmount,
    assetIndex: loftyAsaId,
    suggestedParams: params,
    note: new TextEncoder().encode(`lofty_swap:${loftyAsaId}`),
  });

  // Assign group ID
  algosdk.assignGroupID([appCall, tokenPayment]);

  return [appCall, tokenPayment];
}

const HoldingRow = ({ holding, selected, onToggle, disabled, reason, lpPrice, propertyMeta }) => {
  const tokenCount = holding.decimals > 0 ? holding.amount / 10 ** holding.decimals : holding.amount;
  const price = lpPrice || propertyMeta?.tokenValue || 0;
  const totalValue = tokenCount * price;
  const earlEquivalent = totalValue / EARL_PRICE;
  const label = propertyMeta?.address || holding.name;
  const isFrozen = holding.defaultFrozen;
  const isZeroPrice = price <= 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        disabled
          ? 'border-muted/30 bg-muted/5 cursor-not-allowed opacity-60'
          : 'border-border/50 hover:border-border cursor-pointer',
        selected && !disabled ? 'border-primary bg-primary/10' : '',
      )}
      onClick={disabled ? undefined : () => onToggle(holding.assetId)}
    >
      <div className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
        disabled ? 'border-muted-foreground/20' : selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
      )}>
        {selected && !disabled && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
        {isFrozen && <Snowflake className="h-3.5 w-3.5 text-blue-300" />}
      </div>
      <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground">
          {propertyMeta?.city && propertyMeta?.state ? `${propertyMeta.city}, ${propertyMeta.state} · ` : ''}
          ASA {holding.assetId}
          {holding.unitName ? ` · ${holding.unitName}` : ''}
        </p>
      </div>
      {disabled && reason && (
        <span className="text-xs text-destructive/80 font-medium shrink-0">{reason}</span>
      )}
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">{tokenCount.toLocaleString()} tok</p>
        <p className="text-xs text-muted-foreground">
          {isZeroPrice ? 'No price' : `${formatCurrency(price)}/tok · ${formatCurrency(totalValue)}`}
        </p>
      </div>
      <div className="text-right shrink-0 w-24">
        <p className="text-sm font-bold text-primary">{earlEquivalent > 0 ? earlEquivalent.toFixed(4) : '\u2014'}</p>
        <p className="text-xs text-muted-foreground">EARL</p>
      </div>
    </div>
  );
};

const LoftySwap = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isConnected, accountAddress, handleConnect, peraWallet, kycVerified } = useAppContext();

  const [holdings, setHoldings] = useState([]);
  const [lpPrices, setLpPrices] = useState({});
  const [propertyMap, setPropertyMap] = useState({});
  const [appOptedInAsas, setAppOptedInAsas] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchFilter, setSearchFilter] = useState('');

  const appId = INKIND_EXCHANGE_APP_ID;

  useEffect(() => {
    if (!isConnected || !accountAddress) { setHoldings([]); return; }
    const load = async () => {
      setLoading(true);
      try {
        const [rawHoldings, prices, meta] = await Promise.all([
          fetchLoftyHoldings(accountAddress),
          fetchLpPrices(),
          fetchLoftyAssistProperties(),
        ]);

        // SECURITY #1: Filter out LP pool tokens
        let filtered = rawHoldings.filter(h => !isLpToken(h.unitName, h.name));

        // SECURITY #5: LoftyAssist property allowlist — fail closed if no data
        if (Object.keys(meta).length > 0) {
          filtered = filtered.filter(h => meta[h.assetId]);
        } else {
          filtered = [];
        }

        // Fetch app's opt-in status for ASA readiness check
        let optedIn = new Set();
        if (appId && appId > 0) {
          try {
            const appAddr = algosdk.getApplicationAddress(appId);
            const appAcct = await algodClient.accountInformation(appAddr).do();
            optedIn = new Set((appAcct.assets || []).map(a => a['asset-id']));
          } catch { /* ignore — will show all as needing setup */ }
        }
        setAppOptedInAsas(optedIn);

        setHoldings(filtered);
        setLpPrices(prices);
        setPropertyMap(meta);
      } catch (err) {
        toast({ variant: 'destructive', title: 'Load failed', description: err.message });
      } finally { setLoading(false); }
    };
    load();
  }, [isConnected, accountAddress, toast]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const holdingsWithStatus = useMemo(() => {
    return holdings.map(h => {
      const isFrozen = h.defaultFrozen;
      const price = lpPrices[h.assetId] || propertyMap[h.assetId]?.tokenValue || 0;
      const isZeroPrice = price <= 0;
      // Check if we have LP app IDs for on-chain pricing
      const meta = propertyMap[h.assetId];
      const hasLpApp = !!(meta?.lpInterfaceAppId && meta?.adminAppId);
      // Check if the smart contract is opted into this ASA
      const isAppReady = appId && appId > 0 && appOptedInAsas.has(h.assetId);
      let disabled = false;
      let reason = '';
      if (isFrozen) { disabled = true; reason = 'Frozen'; }
      else if (isZeroPrice) { disabled = true; reason = 'No price'; }
      else if (!hasLpApp && appId) { disabled = true; reason = 'No LP data'; }
      else if (!isAppReady && appId) { disabled = true; reason = 'Not yet available'; }
      return { ...h, price, disabled, reason, isAppReady };
    });
  }, [holdings, lpPrices, propertyMap, appId, appOptedInAsas]);

  const filteredHoldings = useMemo(() => {
    if (!searchFilter.trim()) return holdingsWithStatus;
    const q = searchFilter.toLowerCase();
    return holdingsWithStatus.filter((h) => {
      const m = propertyMap[h.assetId];
      return [h.name, h.unitName, String(h.assetId), m?.address, m?.city, m?.state]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [holdingsWithStatus, searchFilter, propertyMap]);

  const selectAll = useCallback(() => {
    const selectable = filteredHoldings.filter(h => !h.disabled);
    setSelectedIds((prev) => {
      const selectableIds = new Set(selectable.map(h => h.assetId));
      const allSelected = [...selectableIds].every(id => prev.has(id));
      return allSelected ? new Set() : selectableIds;
    });
  }, [filteredHoldings]);

  const { totalUsdValue, totalEarl, selectedHoldings } = useMemo(() => {
    let usd = 0, earl = 0;
    const sel = [];
    for (const h of holdingsWithStatus) {
      if (!selectedIds.has(h.assetId) || h.disabled) continue;
      const tc = h.decimals > 0 ? h.amount / 10 ** h.decimals : h.amount;
      const v = tc * h.price;
      usd += v;
      earl += v / EARL_PRICE;
      sel.push({ ...h, tokenCount: tc, value: v });
    }
    return { totalUsdValue: usd, totalEarl: earl, selectedHoldings: sel };
  }, [holdingsWithStatus, selectedIds]);

  const canSwap = selectedHoldings.length > 0 && totalEarl > 0 && !submitting && kycVerified;

  /**
   * Atomic swap using the in-kind exchange smart contract.
   * For each selected token, builds a 2-txn group:
   *   [app_call(exchange), axfer(lofty → app)]
   * The contract computes the DODO PMM price on-chain and sends EARL
   * back via inner transaction — trustless and atomic.
   *
   * Falls back to the old trust-based flow if the contract is not deployed.
   */
  const handleSwap = async () => {
    if (!kycVerified) { toast({ variant: 'destructive', title: 'KYC required' }); return; }
    if (!canSwap) { toast({ variant: 'destructive', title: 'Select tokens with price data' }); return; }

    // Re-verify no disabled tokens
    const invalidToken = selectedHoldings.find(h => h.disabled);
    if (invalidToken) {
      toast({ variant: 'destructive', title: 'Invalid selection', description: `${invalidToken.name} is not swappable.` });
      return;
    }

    setSubmitting(true);

    try {
      if (appId && appId > 0) {
        // ═══════════════════════════════════════════════
        // SMART CONTRACT PATH: Atomic trustless swap
        // ═══════════════════════════════════════════════

        // Each token swap is a separate atomic group (2 txns each).
        // We execute them sequentially to avoid group ID conflicts.
        for (let i = 0; i < selectedHoldings.length; i++) {
          const h = selectedHoldings[i];
          const meta = propertyMap[h.assetId];
          const adminAppId = meta?.adminAppId;
          const lpInterfaceAppId = meta?.lpInterfaceAppId;

          if (!adminAppId || !lpInterfaceAppId) {
            throw new Error(`No LP app data for ${h.name} (ASA ${h.assetId}). Cannot compute on-chain price.`);
          }

          const txns = await buildAtomicSwapGroup({
            appId,
            sender: accountAddress,
            loftyAsaId: h.assetId,
            loftyAmount: h.amount,
            adminAppId,
            lpInterfaceAppId,
            peraWallet,
          });

          // Sign both transactions with Pera wallet
          const signed = await peraWallet.signTransaction(
            [txns.map(txn => ({ txn, signers: [accountAddress] }))],
            accountAddress,
          );

          const { txId } = await algodClient.sendRawTransaction(signed).do();
          await algosdk.waitForConfirmation(algodClient, txId, 6);

          toast({
            title: `Swap ${i + 1}/${selectedHoldings.length} confirmed`,
            description: `${h.name || `ASA ${h.assetId}`} → EARL (on-chain PMM price)`,
          });
        }

        toast({
          title: 'All swaps complete',
          description: `${selectedHoldings.length} token(s) swapped for EARL atomically via smart contract.`,
        });
      } else {
        // ═══════════════════════════════════════════════
        // FALLBACK: Smart contract not deployed
        // ═══════════════════════════════════════════════
        toast({
          variant: 'destructive',
          title: 'Exchange contract not available',
          description: 'The in-kind exchange smart contract has not been deployed yet. Please deploy it first.',
        });
        return;
      }

      setSelectedIds(new Set());
      setHoldings(await fetchLoftyHoldings(accountAddress));
    } catch (err) {
      console.error('Lofty swap failed:', err);
      const msg = err?.message || String(err);
      const isCancel = /cancel|reject|deny|closed/i.test(msg);
      toast({
        variant: 'destructive',
        title: isCancel ? 'Cancelled' : 'Swap failed',
        description: msg,
      });
    } finally { setSubmitting(false); }
  };

  const swappableCount = holdingsWithStatus.filter(h => !h.disabled).length;
  const frozenCount = holdingsWithStatus.filter(h => h.defaultFrozen).length;
  const noPriceCount = holdingsWithStatus.filter(h => !h.defaultFrozen && h.price <= 0).length;
  const noLpDataCount = holdingsWithStatus.filter(h => !h.defaultFrozen && h.price > 0 && h.disabled && h.reason === 'No LP data').length;
  const notReadyCount = holdingsWithStatus.filter(h => !h.defaultFrozen && h.price > 0 && h.disabled && h.reason === 'Not yet available').length;
  const isContractMode = appId && appId > 0;

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <PageTitle title="Lofty → EARL Swap" description="Trade your Lofty property tokens for EARL at live LP market prices" />

      {isContractMode && (
        <motion.div variants={itemVariants} className="mb-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 border border-green-500/20 text-xs text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Atomic smart contract active — swaps are trustless and on-chain</span>
          </div>
        </motion.div>
      )}

      {!isConnected && (
        <motion.div variants={itemVariants} className="mb-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Wallet className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">Connect your Algorand wallet</h3>
                    <p className="text-sm text-muted-foreground">We'll scan for Lofty property tokens and show live LP prices.</p>
                  </div>
                </div>
                <Button onClick={handleConnect} size="lg">Connect Wallet</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isConnected && !kycVerified && (
        <motion.div variants={itemVariants} className="mb-6">
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div>
                <p className="font-medium">KYC verification required</p>
                <p className="text-sm text-muted-foreground">Complete identity verification before swapping Lofty tokens for EARL.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading && (
        <motion.div variants={itemVariants} className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Scanning wallet for Lofty tokens…</span>
        </motion.div>
      )}

      {isConnected && !loading && (
        <motion.div variants={itemVariants}>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" /> Your Lofty Tokens ({holdingsWithStatus.length})
                  </CardTitle>
                  <CardDescription>
                    {swappableCount} swappable
                    {notReadyCount > 0 && ` · ${notReadyCount} pending setup`}
                    {frozenCount > 0 && ` · ${frozenCount} frozen`}
                    {noPriceCount > 0 && ` · ${noPriceCount} no price`}
                    {noLpDataCount > 0 && ` · ${noLpDataCount} no LP data`}
                  </CardDescription>
                </div>
                {swappableCount > 0 && (
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedIds.size === swappableCount ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>
              {holdingsWithStatus.length > 5 && (
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Filter by address, city, or ASA ID…" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} className="pl-9 text-gray-900" />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto">
              {holdingsWithStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No swappable Lofty property tokens found in this wallet.</p>
              ) : filteredHoldings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tokens match your filter.</p>
              ) : filteredHoldings.map((h) => (
                <HoldingRow
                  key={h.assetId}
                  holding={h}
                  selected={selectedIds.has(h.assetId)}
                  onToggle={toggleSelect}
                  disabled={h.disabled}
                  reason={h.reason}
                  lpPrice={lpPrices[h.assetId]}
                  propertyMeta={propertyMap[h.assetId]}
                />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isConnected && !loading && selectedIds.size > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div><p className="text-xs text-muted-foreground">Selected</p><p className="text-2xl font-bold">{selectedHoldings.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Est. Value</p><p className="text-2xl font-bold">{formatCurrency(totalUsdValue)}</p></div>
                <div><p className="text-xs text-muted-foreground">EARL Price</p><p className="text-2xl font-bold">{formatCurrency(EARL_PRICE)}</p></div>
                <div><p className="text-xs text-muted-foreground">Est. EARL</p><p className="text-2xl font-bold text-primary">{totalEarl.toFixed(4)}</p></div>
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 text-xs text-muted-foreground mb-4">
                {isContractMode ? (
                  <>
                    <strong>Atomic swap:</strong> Your Lofty tokens transfer to the smart contract, which computes the DODO PMM price
                    on-chain and sends EARL back in the same transaction group. No trust required.
                    Final EARL amount is determined by the on-chain PMM formula, not the estimate above.
                  </>
                ) : (
                  <>
                    <strong>Estimated only:</strong> The smart contract is not yet deployed. Swap is unavailable until deployment.
                  </>
                )}
              </div>
              <Button onClick={handleSwap} className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg" disabled={!canSwap || !isContractMode}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                {!isContractMode ? 'Contract Not Deployed' : `Swap ${selectedHoldings.length} Token${selectedHoldings.length !== 1 ? 's' : ''} → EARL`}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default LoftySwap;