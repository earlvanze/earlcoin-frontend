import React, { useCallback, useEffect, useMemo, useState } from 'react';
import algosdk from 'algosdk';
import { motion } from 'framer-motion';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Wallet, ArrowRightLeft, Building2, CheckCircle2, Search, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { fetchLpPrices } from '@/lib/loftyDeals';
import { supabase } from '@/lib/customSupabaseClient';
import { algodClient } from '@/lib/algorand';
import { WALLETS, INDEXER_BASE, LOFTY_API } from '@/lib/wallets';
import { EARL_ASA_ID } from '@/lib/config';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const EARL_PRICE = 100;
const ASSET_DECIMALS = 6;
const BASE_UNIT = 10 ** ASSET_DECIMALS;
const TREASURY_ORDER_EVENT = 'treasury-orders-updated';

const formatCurrency = (v, d = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(Number(v || 0));

const notifyTreasuryOrdersUpdated = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TREASURY_ORDER_EVENT));
};

const LOFTY_CREATORS = new Set([
  'GQ46SBJ6Y5CJHJXLPTDBTHFJYEBI4LHPL5MOPCG5B6C4ONOG2RJHTM6VE',
  'LOFTYYD7TVIGMHGLUJLSJPHMQ7WCEIYSVDPSXPWOHXCYHOB3Y5BSBD57VU',
]);

async function fetchLoftyHoldings(walletAddress) {
  const url = `${INDEXER_BASE}/v2/accounts/${walletAddress}/assets?limit=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Indexer error: ${res.status}`);
  const data = await res.json();
  const assets = (data.assets || []).filter((a) => a.amount > 0);
  const holdings = [];
  for (const asset of assets) {
    try {
      const assetRes = await fetch(`${INDEXER_BASE}/v2/assets/${asset['asset-id']}`);
      if (!assetRes.ok) continue;
      const assetData = await assetRes.json();
      const params = assetData?.asset?.params || {};
      if (LOFTY_CREATORS.has(params.creator || '')) {
        holdings.push({
          assetId: asset['asset-id'],
          amount: asset.amount,
          decimals: params.decimals || 0,
          name: params.name || `ASA ${asset['asset-id']}`,
          unitName: params['unit-name'] || '',
        });
      }
    } catch { /* skip */ }
  }
  return holdings;
}

async function fetchLoftyAssistProperties() {
  try {
    const res = await fetch(LOFTY_API);
    if (!res.ok) return {};
    const items = await res.json();
    const map = {};
    for (const item of items) {
      const p = item?.property || {};
      const entry = {
        address: p.address || 'Unknown',
        city: p.market || p.city || '',
        state: p.state || '',
        tokenValue: p.tokenValue || null,
      };
      if (p.assetId) map[p.assetId] = entry;
      if (p.newAssetId) map[p.newAssetId] = entry;
    }
    return map;
  } catch { return {}; }
}

const HoldingRow = ({ holding, selected, onToggle, lpPrice, propertyMeta }) => {
  const tokenCount = holding.decimals > 0 ? holding.amount / 10 ** holding.decimals : holding.amount;
  const price = lpPrice || propertyMeta?.tokenValue || 0;
  const totalValue = tokenCount * price;
  const earlEquivalent = totalValue / EARL_PRICE;
  const label = propertyMeta?.address || holding.name;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
        selected ? 'border-primary bg-primary/10' : 'border-border/50 hover:border-border'
      )}
      onClick={() => onToggle(holding.assetId)}
    >
      <div className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
        selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
      )}>
        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
      </div>
      <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground">
          {propertyMeta?.city && propertyMeta?.state ? `${propertyMeta.city}, ${propertyMeta.state} · ` : ''}
          ASA {holding.assetId}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">{tokenCount.toLocaleString()} tok</p>
        <p className="text-xs text-muted-foreground">
          {price > 0 ? `${formatCurrency(price)}/tok · ${formatCurrency(totalValue)}` : 'No price'}
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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (!isConnected || !accountAddress) { setHoldings([]); return; }
    const load = async () => {
      setLoading(true);
      try {
        const [h, prices, meta] = await Promise.all([
          fetchLoftyHoldings(accountAddress),
          fetchLpPrices(),
          fetchLoftyAssistProperties(),
        ]);
        setHoldings(h);
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

  const filteredHoldings = useMemo(() => {
    if (!searchFilter.trim()) return holdings;
    const q = searchFilter.toLowerCase();
    return holdings.filter((h) => {
      const m = propertyMap[h.assetId];
      return [h.name, h.unitName, String(h.assetId), m?.address, m?.city, m?.state]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [holdings, searchFilter, propertyMap]);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === filteredHoldings.length
        ? new Set()
        : new Set(filteredHoldings.map((h) => h.assetId))
    );
  }, [filteredHoldings]);

  const { totalUsdValue, totalEarl, selectedHoldings } = useMemo(() => {
    let usd = 0, earl = 0;
    const sel = [];
    for (const h of holdings) {
      if (!selectedIds.has(h.assetId)) continue;
      const tc = h.decimals > 0 ? h.amount / 10 ** h.decimals : h.amount;
      const p = lpPrices[h.assetId] || propertyMap[h.assetId]?.tokenValue || 0;
      const v = tc * p;
      usd += v;
      earl += v / EARL_PRICE;
      sel.push({ ...h, tokenCount: tc, price: p, value: v });
    }
    return { totalUsdValue: usd, totalEarl: earl, selectedHoldings: sel };
  }, [holdings, selectedIds, lpPrices, propertyMap]);

  const handleSwap = async () => {
    if (!user) { toast({ variant: 'destructive', title: 'Not logged in' }); return; }
    if (!kycVerified) { toast({ variant: 'destructive', title: 'KYC required' }); return; }
    if (!selectedHoldings.length || totalEarl <= 0) {
      toast({ variant: 'destructive', title: 'Select tokens with price data' });
      return;
    }

    setSubmitting(true);
    try {
      const params = await algodClient.getTransactionParams().do();
      const txns = selectedHoldings.map((h) =>
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: accountAddress,
          to: WALLETS.TREASURY,
          amount: h.amount,
          assetIndex: h.assetId,
          suggestedParams: params,
          note: new TextEncoder().encode(`lofty_swap:${h.assetId}:${h.tokenCount}@${h.price}`),
        })
      );
      if (txns.length > 1) algosdk.assignGroupID(txns);

      const signed = await peraWallet.signTransaction(
        [txns.map((txn) => ({ txn, signers: [accountAddress] }))],
        accountAddress
      );
      await algodClient.sendRawTransaction(signed).do();
      const txId = txns[0].txID().toString();
      await algosdk.waitForConfirmation(algodClient, txId, 4);

      const earlBaseUnits = Math.round(totalEarl * BASE_UNIT);
      const { error: orderErr } = await supabase.from('treasury_orders').insert({
        user_id: user.id,
        wallet_address: accountAddress,
        purchase_type: 'lofty_swap',
        quantity: Math.floor(totalEarl),
        quantity_base_units: earlBaseUnits,
        status: 'pending_wallet_settlement',
        payment_amount: Math.round(totalUsdValue * BASE_UNIT),
        payment_tx_id: txId,
      });
      if (orderErr) throw orderErr;

      notifyTreasuryOrdersUpdated();
      toast({
        title: 'Lofty → EARL swap submitted',
        description: `${selectedHoldings.length} token(s) sent to Treasury. ${totalEarl.toFixed(4)} EARL pending settlement.`,
      });
      setSelectedIds(new Set());
      setHoldings(await fetchLoftyHoldings(accountAddress));
    } catch (err) {
      console.error('Lofty swap failed:', err);
      toast({
        variant: 'destructive',
        title: /cancel|reject|deny|closed/i.test(err?.message) ? 'Cancelled' : 'Swap failed',
        description: err.message,
      });
    } finally { setSubmitting(false); }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <PageTitle title="Lofty → EARL Swap" description="Trade your Lofty property tokens for EARL at live LP market prices" />

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
                    <Building2 className="h-5 w-5" /> Your Lofty Tokens ({holdings.length})
                  </CardTitle>
                  <CardDescription>Select tokens to swap for EARL at Lofty LP market price</CardDescription>
                </div>
                {holdings.length > 0 && (
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedIds.size === filteredHoldings.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>
              {holdings.length > 5 && (
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Filter by address, city, or ASA ID…" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} className="pl-9 text-gray-900" />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto">
              {holdings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No Lofty property tokens found in this wallet.</p>
              ) : filteredHoldings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tokens match your filter.</p>
              ) : filteredHoldings.map((h) => (
                <HoldingRow key={h.assetId} holding={h} selected={selectedIds.has(h.assetId)} onToggle={toggleSelect} lpPrice={lpPrices[h.assetId]} propertyMeta={propertyMap[h.assetId]} />
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
                <div><p className="text-xs text-muted-foreground">Selected</p><p className="text-2xl font-bold">{selectedIds.size}</p></div>
                <div><p className="text-xs text-muted-foreground">Total LP Value</p><p className="text-2xl font-bold">{formatCurrency(totalUsdValue)}</p></div>
                <div><p className="text-xs text-muted-foreground">EARL Price</p><p className="text-2xl font-bold">{formatCurrency(EARL_PRICE)}</p></div>
                <div><p className="text-xs text-muted-foreground">You Receive</p><p className="text-2xl font-bold text-primary">{totalEarl.toFixed(4)} EARL</p></div>
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 text-xs text-muted-foreground mb-4">
                Your Lofty tokens transfer to the DAO Treasury. You receive {totalEarl.toFixed(4)} EARL at {formatCurrency(EARL_PRICE)}/EARL.
                LP prices sourced live from Lofty liquidity pools.
              </div>
              <Button onClick={handleSwap} className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg" disabled={submitting || !kycVerified}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                Swap {selectedIds.size} Lofty Token{selectedIds.size !== 1 ? 's' : ''} → {totalEarl.toFixed(4)} EARL
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default LoftySwap;
