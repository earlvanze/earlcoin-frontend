import React, { useCallback, useEffect, useMemo, useState } from 'react';
import algosdk from 'algosdk';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Wallet, CreditCard, ArrowRightLeft, TrendingUp, TrendingDown, Activity, AlertTriangle, Clock3, Bitcoin, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { loadStripe } from '@stripe/stripe-js';
import { EARL_ASA_ID, STRIPE_PUBLISHABLE_KEY, EARL_STRIPE_PRICE_ID, USDC_ASA_ID, GOBTC_ASA_ID, GOBTC_DECIMALS } from '@/lib/config';
import { supabase } from '@/lib/customSupabaseClient';
import { algodClient, indexerClient } from '@/lib/algorand';
import { WALLETS } from '@/lib/wallets';

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const DEFAULT_PRICE = 100;
const ASSET_DECIMALS = 6;
const MIN_EARL_ORDER = 0.01;
const MIN_EARL_BASE_UNITS = 10_000;
const BASE_UNIT = 10 ** ASSET_DECIMALS;
const TREASURY_ORDER_EVENT = 'treasury-orders-updated';
const GOBTC_BASE_UNIT = 10 ** GOBTC_DECIMALS;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatCurrency = (value, digits = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const parsePositiveNumber = (value) => {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatAssetAmount = (value, decimals = 6, maxFractionDigits = 4) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(Number(value || 0) / 10 ** decimals);

const formatEarlAmount = (value, maxFractionDigits = 4) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(Number(value || 0));

const earlFromBaseUnits = (value) => Number(value || 0) / BASE_UNIT;
const gobtcFromBaseUnits = (value) => Number(value || 0) / GOBTC_BASE_UNIT;
const toGobtcBaseUnits = (value) => Math.round(Number(value || 0) * GOBTC_BASE_UNIT);
const formatBtcAmount = (value, maxFractionDigits = 8) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits }).format(Number(value || 0));
const toBaseUnits = (value, decimals = ASSET_DECIMALS) => Math.round(Number(value || 0) * 10 ** decimals);
const wholeTokenQuantity = (baseUnits) => (baseUnits % BASE_UNIT === 0 ? baseUnits / BASE_UNIT : null);
const notifyTreasuryOrdersUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(TREASURY_ORDER_EVENT));
  }
};

const DEPTH_LEVELS = 6;
const DEPTH_STEP = 0.01;
const DEPTH_WEIGHTS = [0.30, 0.25, 0.18, 0.12, 0.09, 0.06];

const buildOrderBookFromLiquidity = (midPrice, earlBalance, usdcBalance) => {
  const price = Number(midPrice || DEFAULT_PRICE);
  const totalEarl = Math.max(Number(earlBalance || 0), 0);
  const totalUsdc = Math.max(Number(usdcBalance || 0), 0);

  const asks = Array.from({ length: DEPTH_LEVELS }, (_, i) => {
    const p = Number((price + (i + 1) * DEPTH_STEP).toFixed(2));
    const size = Math.round(totalEarl * (DEPTH_WEIGHTS[i] || 0.05));
    return { price: p, size, total: Number((p * size).toFixed(2)) };
  }).reverse();

  const bids = Array.from({ length: DEPTH_LEVELS }, (_, i) => {
    const p = Number((price - (i + 1) * DEPTH_STEP).toFixed(2));
    const usdcAtLevel = totalUsdc * (DEPTH_WEIGHTS[i] || 0.05);
    const size = p > 0 ? Math.round(usdcAtLevel / p) : 0;
    return { price: p, size, total: Number((p * size).toFixed(2)) };
  });

  return { bids, asks };
};

const parseFulfilledTrades = (orders) =>
  (orders || []).map((o) => {
    const isBuy = /buy/i.test(o.purchase_type);
    const earlQty = Number(o.quantity || 0);
    const effectivePrice = isBuy && earlQty > 0
      ? Number(((Number(o.payment_amount || 0) / BASE_UNIT) / earlQty).toFixed(2))
      : DEFAULT_PRICE;
    const date = new Date(o.created_at);
    return {
      price: effectivePrice,
      size: earlQty,
      time: date.toLocaleTimeString('en-US', { hour12: false }),
      type: isBuy ? 'buy' : 'sell',
    };
  });

const MarketStats = ({ price, totalLiquidity, volume24h, marketCap }) => (
  <Card className="mb-6">
    <CardContent className="pt-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Reference Price</p>
          <p className="text-2xl font-bold">{formatCurrency(price)}</p>
          <p className="text-xs text-muted-foreground mt-1">Treasury reference rate</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">24h Volume</p>
          <p className="text-2xl font-bold">{formatCompactCurrency(volume24h)}</p>
          <p className="text-xs text-muted-foreground mt-1">Fulfilled treasury orders</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Market Cap</p>
          <p className="text-2xl font-bold">{formatCompactCurrency(marketCap)}</p>
          <p className="text-xs text-muted-foreground mt-1">10M EARL total supply</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Liquidity</p>
          <p className="text-2xl font-bold">{formatCompactCurrency(totalLiquidity)}</p>
          <p className="text-xs text-muted-foreground mt-1">Treasury EARL + USDC</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const OrderBook = ({ onPriceSelect, orderBook, price }) => (
  <Card>
    <CardHeader>
      <CardTitle>Order Book</CardTitle>
      <CardDescription>EARL/USDC depth from treasury liquidity</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2 pr-2">
      <div className="grid grid-cols-3 text-xs text-muted-foreground px-2">
        <span>Price (USDC)</span>
        <span className="text-right">Size (EARL)</span>
        <span className="text-right">Total (USDC)</span>
      </div>
      <div className="h-48 overflow-y-auto space-y-1">
        {orderBook.asks.map((order, i) => (
          <div key={`ask-${i}`} className="grid grid-cols-3 text-xs p-1 rounded-md cursor-pointer hover:bg-secondary/50 relative" onClick={() => onPriceSelect(order.price)}>
            <span className="text-red-400 font-medium">{order.price.toFixed(2)}</span>
            <span className="text-right">{order.size.toLocaleString()}</span>
            <span className="text-right">{order.total.toFixed(2)}</span>
            <div className="absolute top-0 left-0 h-full bg-red-500/10" style={{ width: `${Math.min((order.size / 12000) * 100, 100)}%` }}></div>
          </div>
        ))}
      </div>
      <div className="text-xl font-bold text-center py-3 border-y border-border/50 bg-primary/5">
        {formatCurrency(price)} <span className="text-xs font-normal text-muted-foreground">SPREAD: {(DEPTH_STEP * 2).toFixed(2)}</span>
      </div>
      <div className="h-48 overflow-y-auto space-y-1">
        {orderBook.bids.map((order, i) => (
          <div key={`bid-${i}`} className="grid grid-cols-3 text-xs p-1 rounded-md cursor-pointer hover:bg-secondary/50 relative" onClick={() => onPriceSelect(order.price)}>
            <span className="text-green-400 font-medium">{order.price.toFixed(2)}</span>
            <span className="text-right">{order.size.toLocaleString()}</span>
            <span className="text-right">{order.total.toFixed(2)}</span>
            <div className="absolute top-0 left-0 h-full bg-green-500/10" style={{ width: `${Math.min((order.size / 12000) * 100, 100)}%` }}></div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const TradeHistory = ({ trades }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Activity className="h-4 w-4" />
        Recent Trades
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2 pr-2">
      <div className="grid grid-cols-3 text-xs text-muted-foreground px-2">
        <span>Price (USDC)</span>
        <span className="text-right">Size (EARL)</span>
        <span className="text-right">Time</span>
      </div>
      <div className="h-[26rem] overflow-y-auto space-y-1">
        {trades.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No fulfilled trades yet</p>
        ) : trades.map((trade, i) => (
          <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md hover:bg-secondary/20">
            <span className={cn('font-medium', trade.type === 'buy' ? 'text-green-400' : 'text-red-400')}>
              {trade.price.toFixed(2)}
              {trade.type === 'buy' ? <TrendingUp className="h-3 w-3 inline ml-1" /> : <TrendingDown className="h-3 w-3 inline ml-1" />}
            </span>
            <span className="text-right">{trade.size.toLocaleString()}</span>
            <span className="text-right text-muted-foreground">{trade.time}</span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);



const statusTone = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'completed':
    case 'fulfilled':
    case 'paid':
    case 'wallet_payment_confirmed':
    case 'wallet_payment_submitted':
    case 'custodied':
      return 'text-green-400';
    case 'cancelled':
    case 'failed':
    case 'wallet_payment_failed':
    case 'wallet_signature_cancelled':
      return 'text-red-400';
    case 'pending_custody_reserve':
    case 'pending_custody_optin':
    case 'missing_wallet':
      return 'text-yellow-400';
    default:
      return 'text-yellow-400';
  }
};

const formatOrderQuantity = (order) => {
  if (order?.quantity_base_units != null) return formatEarlAmount(earlFromBaseUnits(order.quantity_base_units));
  if (order?.quantity != null) return formatEarlAmount(order.quantity);
  return null;
};

const OrderStatusCard = ({ user }) => {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadOrders = async () => {
      if (!user) {
        setOrders([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('treasury_orders')
          .select('id, purchase_type, quantity, quantity_base_units, status, created_at, stripe_session_id, tx_id, wallet_address, payment_asset_id, payment_amount, payment_tx_id, fulfillment_mode, reserve_wallet_role, reserve_wallet_address, reserve_tx_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setOrders(data || []);
      } catch (error) {
        console.error('Failed to load treasury orders:', error);
        toast({
          variant: 'destructive',
          title: 'Order status unavailable',
          description: 'Could not load treasury order records right now.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadOrders();

    const reloadOrders = () => loadOrders();
    if (typeof window !== 'undefined') {
      window.addEventListener(TREASURY_ORDER_EVENT, reloadOrders);
      return () => window.removeEventListener(TREASURY_ORDER_EVENT, reloadOrders);
    }

    return undefined;
  }, [toast, user]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          Treasury Order Status
        </CardTitle>
        <CardDescription>Latest EARL checkout records visible from Supabase</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!user ? (
          <p className="text-sm text-muted-foreground">Log in to see your recent EARL purchase status.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No treasury orders found yet for this account.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="rounded-lg border border-border/60 p-3 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  {order.purchase_type || 'order'}
                  {formatOrderQuantity(order) ? ` • ${formatOrderQuantity(order)} EARL` : ''}
                </div>
                <div className={`text-xs font-medium uppercase tracking-wide ${statusTone(order.status)}`}>
                  {order.status || 'created'}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Created {new Date(order.created_at).toLocaleString()}
              </div>
              {order.wallet_address && (
                <div className="text-xs text-muted-foreground font-mono">
                  Wallet: {order.wallet_address.slice(0, 6)}...{order.wallet_address.slice(-4)}
                </div>
              )}
              {order.payment_amount && order.payment_asset_id ? (
                <div className="text-xs text-muted-foreground">
                  Wallet leg: {formatAssetAmount(order.payment_amount)} {order.payment_asset_id === USDC_ASA_ID ? 'USDC' : order.payment_asset_id === EARL_ASA_ID ? 'EARL' : 'asset'}
                </div>
              ) : null}
              {order.fulfillment_mode === 'custody' ? (
                <div className="text-xs text-muted-foreground">Custody mode: user liability reserve{order.reserve_wallet_role ? ` • ${order.reserve_wallet_role}` : ''}</div>
              ) : null}
              {order.payment_tx_id ? (
                <div className="text-xs text-muted-foreground font-mono">Payment tx: {order.payment_tx_id}</div>
              ) : null}
              {order.reserve_tx_id ? (
                <div className="text-xs text-blue-400 font-mono">Reserve tx: {order.reserve_tx_id}</div>
              ) : null}
              {order.tx_id ? (
                <div className="text-xs text-green-400 font-mono">Settlement tx: {order.tx_id}</div>
              ) : (
                <div className="text-xs text-muted-foreground">{order.status === 'custodied' ? 'Credited to custodial balance and removed from treasury inventory.' : order.status === 'pending_custody_reserve' ? 'Custodial balance credited; reserve move still pending.' : order.status === 'pending_custody_optin' ? 'Custodial balance credited; custody reserve wallet still needs EARL opt-in.' : order.payment_tx_id ? 'Wallet payment submitted; awaiting treasury settlement record' : 'Awaiting treasury fulfillment record'}</div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

const TradeForm = ({ price, kycVerified }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isConnected, accountAddress, handleConnect, peraWallet, signTransactions } = useAppContext();
  const [usdcAmount, setUsdcAmount] = useState('');
  const [earlAmount, setEarlAmount] = useState('');
  const [activeTab, setActiveTab] = useState('buy');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [balances, setBalances] = useState({ earl: 0, usdc: 0, algo: 0, gobtc: 0, hasEarlOptIn: false, hasUsdcOptIn: false, hasGobtcOptIn: false });
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [treasuryLiquidity, setTreasuryLiquidity] = useState({ earl: 0, usdc: 0, loaded: false });
  const [custodyBalanceBaseUnits, setCustodyBalanceBaseUnits] = useState(0);
  const [custodyLoading, setCustodyLoading] = useState(false);
  const [withdrawingCustody, setWithdrawingCustody] = useState(false);
  const [btcDeposit, setBtcDeposit] = useState(null);
  const [btcDepositCopied, setBtcDepositCopied] = useState(false);

  const [btcUsdPrice, setBtcUsdPrice] = useState(0);

  const numericPrice = Number(price || DEFAULT_PRICE);
  const numericEarl = parsePositiveNumber(earlAmount);
  const numericUsdc = parsePositiveNumber(usdcAmount);
  const quantityBaseUnits = toBaseUnits(numericEarl || 0);
  const meetsMinimumOrder = quantityBaseUnits >= MIN_EARL_BASE_UNITS;
  const requestedUsdcTotal = numericEarl ? Number((numericEarl * numericPrice).toFixed(2)) : numericUsdc ? Number(numericUsdc.toFixed(2)) : 0;
  const requestedGobtc = btcUsdPrice > 0 && requestedUsdcTotal > 0 ? Number((requestedUsdcTotal / btcUsdPrice).toFixed(8)) : 0;
  const sellLiquidityAvailable = treasuryLiquidity.loaded && requestedUsdcTotal > 0 && treasuryLiquidity.usdc + 1e-9 >= requestedUsdcTotal;
  const buyLiquidityAvailable = treasuryLiquidity.loaded && (!numericEarl || treasuryLiquidity.earl + 1e-9 >= numericEarl);
  const maxSellableEarl = treasuryLiquidity.loaded ? Number((treasuryLiquidity.usdc / numericPrice).toFixed(4)) : 0;
  const custodyBalanceEarl = earlFromBaseUnits(custodyBalanceBaseUnits);
  const hasCustodyBalance = custodyBalanceBaseUnits > 0;

  useEffect(() => {
    const loadBalances = async () => {
      if (!isConnected || !accountAddress) {
        setBalances({ earl: 0, usdc: 0, algo: 0, gobtc: 0, hasEarlOptIn: false, hasUsdcOptIn: false, hasGobtcOptIn: false });
        return;
      }

      setBalancesLoading(true);
      try {
        const response = await indexerClient.lookupAccountByID(accountAddress).do();
        const account = response?.account;
        const assets = account?.assets || [];
        const earlAsset = assets.find((asset) => asset['asset-id'] === EARL_ASA_ID);
        const usdcAsset = assets.find((asset) => asset['asset-id'] === USDC_ASA_ID);
        const gobtcAsset = assets.find((asset) => asset['asset-id'] === GOBTC_ASA_ID);

        setBalances({
          algo: Number(((account?.amount || 0) / BASE_UNIT).toFixed(6)),
          earl: Number((((earlAsset?.amount ?? 0) / BASE_UNIT)).toFixed(6)),
          usdc: Number((((usdcAsset?.amount ?? 0) / BASE_UNIT)).toFixed(6)),
          gobtc: gobtcFromBaseUnits(gobtcAsset?.amount ?? 0),
          hasEarlOptIn: !!earlAsset,
          hasUsdcOptIn: !!usdcAsset,
          hasGobtcOptIn: !!gobtcAsset,
        });
      } catch (error) {
        console.error('Failed to load trading balances:', error);
        toast({
          variant: 'destructive',
          title: 'Balance lookup failed',
          description: 'Could not read wallet balances from Algorand right now.',
        });
      } finally {
        setBalancesLoading(false);
      }
    };

    loadBalances();
  }, [accountAddress, isConnected, toast]);

  useEffect(() => {
    const loadCustodyBalance = async () => {
      if (!user) {
        setCustodyBalanceBaseUnits(0);
        return;
      }
      setCustodyLoading(true);
      try {
        const { data: custodyAccount } = await supabase.from('custody_accounts').select('id').eq('user_id', user.id).maybeSingle();
        if (!custodyAccount?.id) {
          setCustodyBalanceBaseUnits(0);
          return;
        }
        const { data: balanceRow } = await supabase.from('custody_balances').select('available_base_units').eq('custody_account_id', custodyAccount.id).eq('asset_id', EARL_ASA_ID).maybeSingle();
        setCustodyBalanceBaseUnits(Number(balanceRow?.available_base_units || 0));
      } catch (error) {
        console.error('Failed to load custody balance:', error);
      } finally {
        setCustodyLoading(false);
      }
    };

    loadCustodyBalance();
    const reloadCustody = () => loadCustodyBalance();
    if (typeof window !== 'undefined') {
      window.addEventListener(TREASURY_ORDER_EVENT, reloadCustody);
      return () => window.removeEventListener(TREASURY_ORDER_EVENT, reloadCustody);
    }

    return undefined;
  }, [user]);

  useEffect(() => {
    const loadTreasuryLiquidity = async () => {
      try {
        const response = await indexerClient.lookupAccountByID(WALLETS.TREASURY).do();
        const assets = response?.account?.assets || [];
        const earlAsset = assets.find((asset) => asset['asset-id'] === EARL_ASA_ID);
        const usdcAsset = assets.find((asset) => asset['asset-id'] === USDC_ASA_ID);
        setTreasuryLiquidity({
          earl: Number((((earlAsset?.amount ?? 0) / BASE_UNIT)).toFixed(6)),
          usdc: Number((((usdcAsset?.amount ?? 0) / BASE_UNIT)).toFixed(6)),
          loaded: true,
        });
      } catch (error) {
        console.error('Failed to load treasury liquidity:', error);
        setTreasuryLiquidity((current) => ({ ...current, loaded: true }));
      }
    };

    loadTreasuryLiquidity();
    const reloadLiquidity = () => loadTreasuryLiquidity();
    if (typeof window !== 'undefined') {
      window.addEventListener(TREASURY_ORDER_EVENT, reloadLiquidity);
      return () => window.removeEventListener(TREASURY_ORDER_EVENT, reloadLiquidity);
    }

    return undefined;
  }, []);

  useEffect(() => {
    const loadBtcPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await res.json();
        const usd = data?.bitcoin?.usd;
        if (usd && usd > 0) setBtcUsdPrice(usd);
      } catch (err) {
        console.error('Failed to fetch BTC/USD price:', err);
      }
    };
    loadBtcPrice();
    const interval = setInterval(loadBtcPrice, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleEarlChange = (e) => {
    const value = e.target.value;
    setEarlAmount(value);
    const parsed = parsePositiveNumber(value);
    setUsdcAmount(parsed ? (parsed * numericPrice).toFixed(2) : '');
  };

  const handleUsdcChange = (e) => {
    const value = e.target.value;
    setUsdcAmount(value);
    const parsed = parsePositiveNumber(value);
    setEarlAmount(parsed ? (parsed / numericPrice).toFixed(4) : '');
  };

  const handleBuyWithStripe = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not logged in', description: 'Please log in to purchase tokens.' });
      return;
    }

    if (!kycVerified) {
      toast({ variant: 'destructive', title: 'Verification required', description: 'Complete KYC before buying EARL.' });
      return;
    }

    if (!numericEarl || !numericUsdc || !meetsMinimumOrder) {
      toast({ variant: 'destructive', title: 'Invalid order size', description: 'Minimum trade size is 0.01 EARL at the treasury reference price.' });
      return;
    }

    setLoading(true);
    try {
      if (!stripePromise || !EARL_STRIPE_PRICE_ID) {
        throw new Error('Stripe not configured for EARL purchases.');
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: JSON.stringify({
          user_id: user.id,
          wallet_address: accountAddress || null,
          price_id: EARL_STRIPE_PRICE_ID,
          quantity_base_units: quantityBaseUnits,
          total_usdc: requestedUsdcTotal,
          purchase_type: 'earl_token',
        }),
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error?.message || 'Checkout session failed');
      }

      const stripe = await stripePromise;
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (stripeError) throw stripeError;
    } catch (error) {
      toast({ variant: 'destructive', title: 'Checkout Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const submitWalletSettlement = async (orderId, paymentTxId) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data, error } = await supabase.functions.invoke('process-wallet-settlement', {
        body: JSON.stringify({ order_id: orderId, payment_tx_id: paymentTxId }),
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || 'Wallet settlement failed');
      }

      if (!data?.retryable) {
        return data;
      }

      await sleep(2000);
    }

    throw new Error('Payment confirmed, but indexing is still catching up. Check Treasury Order Status again in a few seconds.');
  };

  const handleWithdrawCustody = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not logged in', description: 'Log in to withdraw custodial EARL.' });
      return;
    }
    if (!isConnected || !accountAddress) {
      toast({ variant: 'destructive', title: 'Wallet not connected', description: 'Connect wallet to withdraw custodial EARL.' });
      return;
    }
    if (!hasCustodyBalance) {
      toast({ variant: 'destructive', title: 'No custody balance', description: 'There is no custodial EARL available to withdraw.' });
      return;
    }

    setWithdrawingCustody(true);
    try {
      const { data, error } = await supabase.functions.invoke('withdraw-custody-balance', {
        body: JSON.stringify({ amount_base_units: custodyBalanceBaseUnits, destination_wallet: accountAddress }),
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || 'Custody withdrawal failed');
      notifyTreasuryOrdersUpdated();
      toast({ title: 'Custody withdrawal complete', description: 'Custodial EARL was sent to your connected Algorand wallet.' });
    } catch (error) {
      console.error('Custody withdrawal failed:', error);
      toast({ variant: 'destructive', title: 'Custody withdrawal failed', description: error.message || 'Could not withdraw custodial EARL right now.' });
    } finally {
      setWithdrawingCustody(false);
    }
  };

  const handleSwapWithPera = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not logged in', description: 'Please log in so the wallet trade request can be tracked.' });
      return;
    }

    if (!isConnected) {
      toast({ variant: 'destructive', title: 'Wallet not connected', description: 'Please connect your Algorand wallet first.' });
      return;
    }

    if (!kycVerified) {
      toast({ variant: 'destructive', title: 'Verification required', description: 'Complete KYC before trading on Algorand.' });
      return;
    }

    if (!numericEarl || !numericUsdc || !meetsMinimumOrder) {
      toast({ variant: 'destructive', title: 'Invalid order size', description: 'Minimum trade size is 0.01 EARL at the treasury reference price.' });
      return;
    }

    if (activeTab === 'buy' && requestedUsdcTotal > balances.usdc) {
      toast({ variant: 'destructive', title: 'Insufficient USDC', description: 'Your wallet does not hold enough USDC for that request.' });
      return;
    }

    if (activeTab === 'sell' && numericEarl > balances.earl) {
      toast({ variant: 'destructive', title: 'Insufficient EARL', description: 'Your wallet does not hold enough EARL for that order.' });
      return;
    }

    if (activeTab === 'buy' && treasuryLiquidity.loaded && numericEarl > treasuryLiquidity.earl) {
      toast({ variant: 'destructive', title: 'Treasury EARL unavailable', description: 'Treasury does not have enough EARL liquid for that wallet buy right now.' });
      return;
    }

    if (activeTab === 'sell' && (!treasuryLiquidity.loaded || !sellLiquidityAvailable)) {
      toast({ variant: 'destructive', title: 'Treasury USDC unavailable', description: 'Sell-side settlement is not funded live yet. Treasury needs USDC liquidity before EARL sells can execute end to end.' });
      return;
    }

    setLoading(true);
    let orderId = null;

    try {
      const quantity = wholeTokenQuantity(quantityBaseUnits);
      const purchaseType = activeTab === 'buy' ? 'wallet_buy_earl' : 'wallet_sell_earl';
      const paymentAssetId = activeTab === 'buy' ? USDC_ASA_ID : EARL_ASA_ID;
      const paymentAmount = activeTab === 'buy' ? toBaseUnits(requestedUsdcTotal) : quantityBaseUnits;

      // Treasury wallet is the escrow — backend settles with hardened edge functions
      // (server-side pricing, idempotent conditional updates, atomic balance RPCs).
      const { data: order, error: orderError } = await supabase
        .from('treasury_orders')
        .insert({
          user_id: user.id,
          wallet_address: accountAddress,
          purchase_type: purchaseType,
          quantity,
          quantity_base_units: quantityBaseUnits,
          status: 'pending_wallet_settlement',
          payment_asset_id: paymentAssetId,
          payment_amount: paymentAmount,
        })
        .select('id')
        .single();

      if (orderError) throw orderError;
      orderId = order.id;
      notifyTreasuryOrdersUpdated();

      const params = await algodClient.getTransactionParams().do();
      const txns = [];

      if (activeTab === 'buy' && !balances.hasEarlOptIn) {
        txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: accountAddress,
          to: accountAddress,
          amount: 0,
          assetIndex: EARL_ASA_ID,
          suggestedParams: params,
        }));
      }

      const paymentTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: accountAddress,
        to: WALLETS.TREASURY,
        amount: paymentAmount,
        assetIndex: paymentAssetId,
        suggestedParams: params,
        note: new TextEncoder().encode(`treasury_order:${order.id}:${purchaseType}`),
      });
      txns.push(paymentTxn);

      if (txns.length > 1) algosdk.assignGroupID(txns);

      const signedTxns = await peraWallet.signTransaction([txns.map((txn) => ({ txn, signers: [accountAddress] }))], accountAddress);
      const paymentTxId = paymentTxn.txID().toString();

      await algodClient.sendRawTransaction(signedTxns).do();
      await algosdk.waitForConfirmation(algodClient, paymentTxId, 4);

      await supabase
        .from('treasury_orders')
        .update({ status: 'wallet_payment_submitted', payment_tx_id: paymentTxId })
        .eq('id', order.id);
      notifyTreasuryOrdersUpdated();

      const settlement = await submitWalletSettlement(order.id, paymentTxId);
      notifyTreasuryOrdersUpdated();

      toast({
        title: settlement?.status === 'fulfilled' ? 'Wallet trade settled' : 'Wallet payment confirmed',
        description: settlement?.status === 'fulfilled'
          ? 'On-chain payment and treasury settlement both completed.'
          : 'Payment confirmed on Algorand. Treasury Order Status now reflects the settlement state.',
      });
    } catch (error) {
      console.error('Wallet settlement flow failed:', error);
      if (orderId) {
        const failureStatus = /cancel|reject|deny|closed/i.test(error?.message || '')
          ? 'wallet_signature_cancelled'
          : 'wallet_payment_failed';
        await supabase.from('treasury_orders').update({ status: failureStatus }).eq('id', orderId);
        notifyTreasuryOrdersUpdated();
      }
      toast({
        variant: 'destructive',
        title: 'Wallet trade failed',
        description: error.message || 'Could not complete the wallet trade flow right now.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBtcDeposit = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not logged in', description: 'Please log in so the BTC deposit can be tracked.' });
      return;
    }
    if (!kycVerified) {
      toast({ variant: 'destructive', title: 'Verification required', description: 'Complete KYC before buying EARL with BTC.' });
      return;
    }
    if (!numericEarl || !meetsMinimumOrder) {
      toast({ variant: 'destructive', title: 'Invalid order size', description: 'Minimum trade size is 0.01 EARL at the treasury reference price.' });
      return;
    }
    if (btcUsdPrice <= 0) {
      toast({ variant: 'destructive', title: 'BTC price unavailable', description: 'Could not fetch live BTC/USD price. Try again shortly.' });
      return;
    }
    if (treasuryLiquidity.loaded && numericEarl > treasuryLiquidity.earl) {
      toast({ variant: 'destructive', title: 'Treasury EARL unavailable', description: 'Treasury does not have enough EARL liquid for that buy right now.' });
      return;
    }

    setLoading(true);
    try {
      const quantity = wholeTokenQuantity(quantityBaseUnits);
      const gobtcBaseUnits = toGobtcBaseUnits(requestedGobtc);

      const { data, error } = await supabase.functions.invoke('create-btc-deposit', {
        body: JSON.stringify({
          user_id: user.id,
          wallet_address: accountAddress || null,
          quantity,
          quantity_base_units: quantityBaseUnits,
          gobtc_amount: gobtcBaseUnits,
          btc_usd_rate: btcUsdPrice,
          earl_usd_rate: numericPrice,
        }),
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || 'Failed to create BTC deposit address');
      }

      setBtcDeposit({
        orderId: data.order_id,
        btcAddress: data.btc_address,
        btcAmount: requestedGobtc,
        earlAmount: numericEarl,
        expiresAt: data.expires_at,
        status: 'awaiting_btc',
      });
      notifyTreasuryOrdersUpdated();

      toast({
        title: 'BTC deposit address generated',
        description: `Send ${formatBtcAmount(requestedGobtc)} BTC to the address shown. It will auto-convert to goBTC and settle your EARL.`,
      });
    } catch (error) {
      console.error('BTC deposit creation failed:', error);
      toast({
        variant: 'destructive',
        title: 'BTC deposit failed',
        description: error.message || 'Could not generate a BTC deposit address right now.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBtcAddress = useCallback(() => {
    if (!btcDeposit?.btcAddress) return;
    navigator.clipboard.writeText(btcDeposit.btcAddress);
    setBtcDepositCopied(true);
    setTimeout(() => setBtcDepositCopied(false), 2000);
  }, [btcDeposit]);

  const handleCancelBtcDeposit = useCallback(() => {
    setBtcDeposit(null);
    setBtcDepositCopied(false);
  }, []);

  useEffect(() => {
    if (!btcDeposit?.orderId) return undefined;
    const pollStatus = async () => {
      try {
        const { data } = await supabase
          .from('treasury_orders')
          .select('status')
          .eq('id', btcDeposit.orderId)
          .single();
        if (data?.status === 'fulfilled') {
          toast({ title: 'BTC trade settled', description: `${formatBtcAmount(btcDeposit.btcAmount)} BTC received and converted. EARL delivered.` });
          setBtcDeposit(null);
          notifyTreasuryOrdersUpdated();
        } else if (data?.status === 'btc_bridge_confirmed') {
          setBtcDeposit((prev) => prev ? { ...prev, status: 'bridging' } : null);
        }
      } catch (err) {
        console.error('BTC deposit poll failed:', err);
      }
    };
    const interval = setInterval(pollStatus, 10_000);
    return () => clearInterval(interval);
  }, [btcDeposit?.orderId, btcDeposit?.btcAmount, toast]);

  return (
    <Card>
      {user && (custodyLoading || hasCustodyBalance) ? (
        <CardContent className="pt-6 pb-0">
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 text-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">Custodial EARL balance</p>
                <p className="text-xs text-muted-foreground">{custodyLoading ? 'Loading…' : `${formatEarlAmount(custodyBalanceEarl)} EARL reserved outside Treasury inventory until withdrawn.`}</p>
              </div>
              <Button type="button" variant="outline" onClick={handleWithdrawCustody} disabled={withdrawingCustody || !hasCustodyBalance || !isConnected}>
                {withdrawingCustody ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
                Withdraw to Wallet
              </Button>
            </div>
            {!isConnected ? <p className="mt-2 text-xs text-muted-foreground">Connect wallet to withdraw custodial EARL on-chain.</p> : null}
          </div>
        </CardContent>
      ) : null}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <CardHeader>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">Buy EARL</TabsTrigger>
            <TabsTrigger value="sell">Sell EARL</TabsTrigger>
          </TabsList>
        </CardHeader>

        {isConnected && (
          <CardContent className="pb-4">
            <div className="bg-secondary/50 rounded-lg p-4 border border-border/50 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Connected Wallet</span>
                <span className="font-mono text-xs">{accountAddress?.slice(0, 6)}...{accountAddress?.slice(-4)}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">EARL</p>
                  <p className="font-bold">{balancesLoading ? '…' : formatEarlAmount(balances.earl)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">USDC</p>
                  <p className="font-bold">{balancesLoading ? '…' : formatAssetAmount(toBaseUnits(balances.usdc), 6, 2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">goBTC</p>
                  <p className="font-bold">{balancesLoading ? '…' : formatBtcAmount(balances.gobtc, 6)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">ALGO</p>
                  <p className="font-bold">{balancesLoading ? '…' : balances.algo.toFixed(3)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        )}

        <TabsContent value="buy">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buy-amount">Amount (EARL)</Label>
              <Input id="buy-amount" type="text" placeholder="0.01" value={earlAmount} onChange={handleEarlChange} className="text-gray-900" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buy-total">Total (USDC)</Label>
              <Input id="buy-total" type="text" placeholder="1,250.00" value={usdcAmount} onChange={handleUsdcChange} className="text-gray-900" />
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 text-xs text-muted-foreground">
              Treasury reference price: {formatCurrency(numericPrice)} per EARL • Fractional EARL enabled • Practical minimum: {MIN_EARL_ORDER} EARL.
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant={paymentMethod === 'stripe' ? 'default' : 'outline'} onClick={() => setPaymentMethod('stripe')} className="w-full">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Card
                </Button>
                <Button type="button" variant={paymentMethod === 'wallet' ? 'default' : 'outline'} onClick={() => setPaymentMethod('wallet')} className="w-full" disabled={!isConnected}>
                  <Wallet className="mr-2 h-4 w-4" />
                  USDC
                </Button>
                <Button type="button" variant={paymentMethod === 'btc' ? 'default' : 'outline'} onClick={() => setPaymentMethod('btc')} className="w-full" disabled={!isConnected}>
                  <Bitcoin className="mr-2 h-4 w-4" />
                  BTC
                </Button>
              </div>
            </div>

            {paymentMethod === 'stripe' ? (
              <>
                <Button onClick={handleBuyWithStripe} className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  Buy with Card
                </Button>
                <p className="text-xs text-muted-foreground text-center">Secure payment via Stripe • If no Algorand wallet is attached, EARL is credited to custodial balance and reserved out of treasury inventory</p>
              </>
            ) : paymentMethod === 'btc' ? (
              <>
                {btcDeposit ? (
                  <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Bitcoin className="h-4 w-4 text-orange-400" />
                      {btcDeposit.status === 'bridging' ? 'BTC received — bridging to goBTC…' : 'Send BTC to this address'}
                    </div>
                    <div className="flex items-center gap-2 bg-background/80 rounded-md p-2 border border-border/50">
                      <code className="text-xs font-mono flex-1 break-all select-all">{btcDeposit.btcAddress}</code>
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={handleCopyBtcAddress}>
                        {btcDepositCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Amount</span>
                        <p className="font-mono font-medium text-orange-400">{formatBtcAmount(btcDeposit.btcAmount)} BTC</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">You receive</span>
                        <p className="font-mono font-medium text-green-400">{formatEarlAmount(btcDeposit.earlAmount)} EARL</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {btcDeposit.status === 'bridging' ? 'Converting to goBTC on Algorand…' : 'Waiting for BTC confirmation — auto-bridges to goBTC → EARL'}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={handleCancelBtcDeposit}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    {requestedGobtc > 0 && (
                      <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">BTC amount</span>
                          <span className="font-mono font-medium text-orange-400">{formatBtcAmount(requestedGobtc)} BTC</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">BTC/USD rate</span>
                          <span className="font-mono">{btcUsdPrice > 0 ? formatCurrency(btcUsdPrice, 0) : '…'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Route</span>
                          <span className="font-mono">BTC → goBTC → Treasury</span>
                        </div>
                      </div>
                    )}
                    <Button onClick={handleBtcDeposit} className="w-full bg-orange-600 hover:bg-orange-700 text-white" disabled={loading || !buyLiquidityAvailable || btcUsdPrice <= 0}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bitcoin className="mr-2 h-4 w-4" />}
                      Pay with BTC
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">{numericEarl ? `Generates a BTC deposit address • ${formatBtcAmount(requestedGobtc)} BTC auto-converts to goBTC on Algorand and settles ${formatEarlAmount(numericEarl)} EARL` : 'Send native BTC — auto-bridged to goBTC on Algorand and swapped for EARL via DAO treasury'}</p>
                  </>
                )}
              </>
            ) : (
              <>
                <Button onClick={handleSwapWithPera} className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loading || !isConnected || !buyLiquidityAvailable}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                  Swap USDC → EARL
                </Button>
                <p className="text-xs text-muted-foreground text-center">{numericEarl ? `Your wallet will ask you to sign ${formatCurrency(requestedUsdcTotal)} USDC for ${formatEarlAmount(numericEarl)} EARL at the treasury reference price` : 'Sign a USDC transfer via WalletConnect • Treasury auto-fulfills fractional EARL after confirmation'}</p>
              </>
            )}
          </CardContent>
        </TabsContent>

        <TabsContent value="sell">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sell-amount">Amount (EARL)</Label>
              <Input id="sell-amount" type="text" placeholder="0.01" value={earlAmount} onChange={handleEarlChange} className="text-gray-900" />
              {isConnected && <p className="text-xs text-muted-foreground">Available: {balancesLoading ? '…' : formatEarlAmount(balances.earl)} EARL • Treasury can currently redeem up to {treasuryLiquidity.loaded ? formatEarlAmount(maxSellableEarl) : '…'} EARL</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sell-total">Receive (USDC)</Label>
              <Input id="sell-total" type="text" placeholder="1,250.00" value={usdcAmount} onChange={handleUsdcChange} disabled className="text-gray-900" />
            </div>
            <Button onClick={handleSwapWithPera} className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={loading || !isConnected || !sellLiquidityAvailable}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
              Swap EARL → USDC
            </Button>
            <p className="text-xs text-muted-foreground text-center">{sellLiquidityAvailable ? (numericEarl ? `Your wallet will ask you to sign ${formatEarlAmount(numericEarl)} EARL and Treasury will return ${formatCurrency(requestedUsdcTotal)} USDC after confirmation` : 'Sign a fractional EARL transfer via WalletConnect • Treasury sends USDC after confirmation') : `Treasury sell depth is limited to ${treasuryLiquidity.loaded ? formatEarlAmount(maxSellableEarl) : '…'} EARL at the current USDC balance`}</p>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

const Trade = () => {
  const [price, setPrice] = useState(DEFAULT_PRICE);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isConnected, handleConnect, kycVerified } = useAppContext();
  const [treasuryDepth, setTreasuryDepth] = useState({ earl: 0, usdc: 0, gobtc: 0, loaded: false });
  const [fulfilledTrades, setFulfilledTrades] = useState([]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      toast({ title: 'Checkout started', description: 'Payment succeeded. Treasury fulfillment should follow your Stripe order record.' });
      searchParams.delete('status');
      setSearchParams(searchParams);
    } else if (status === 'cancelled') {
      toast({ variant: 'destructive', title: 'Checkout cancelled', description: 'Your EARL purchase was cancelled before completion.' });
      searchParams.delete('status');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, toast]);

  useEffect(() => {
    const loadTreasuryDepth = async () => {
      try {
        const response = await indexerClient.lookupAccountByID(WALLETS.TREASURY).do();
        const assets = response?.account?.assets || [];
        const earlAsset = assets.find((a) => a['asset-id'] === EARL_ASA_ID);
        const usdcAsset = assets.find((a) => a['asset-id'] === USDC_ASA_ID);
        const gobtcAsset = assets.find((a) => a['asset-id'] === GOBTC_ASA_ID);
        setTreasuryDepth({
          earl: (earlAsset?.amount ?? 0) / BASE_UNIT,
          usdc: (usdcAsset?.amount ?? 0) / BASE_UNIT,
          gobtc: gobtcFromBaseUnits(gobtcAsset?.amount ?? 0),
          loaded: true,
        });
      } catch (err) {
        console.error('Failed to load treasury depth:', err);
        setTreasuryDepth((cur) => ({ ...cur, loaded: true }));
      }
    };
    loadTreasuryDepth();
    if (typeof window !== 'undefined') {
      window.addEventListener(TREASURY_ORDER_EVENT, loadTreasuryDepth);
      return () => window.removeEventListener(TREASURY_ORDER_EVENT, loadTreasuryDepth);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const loadTrades = async () => {
      try {
        const { data, error } = await supabase
          .from('treasury_orders')
          .select('purchase_type, quantity, payment_amount, created_at')
          .eq('status', 'fulfilled')
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        setFulfilledTrades(parseFulfilledTrades(data));
      } catch (err) {
        console.error('Failed to load fulfilled trades:', err);
      }
    };
    loadTrades();
    if (typeof window !== 'undefined') {
      window.addEventListener(TREASURY_ORDER_EVENT, loadTrades);
      return () => window.removeEventListener(TREASURY_ORDER_EVENT, loadTrades);
    }
    return undefined;
  }, []);

  const orderBook = useMemo(() => buildOrderBookFromLiquidity(price, treasuryDepth.earl, treasuryDepth.usdc), [price, treasuryDepth]);
  const trades = fulfilledTrades;
  const totalLiquidity = useMemo(() => treasuryDepth.loaded ? treasuryDepth.earl * price + treasuryDepth.usdc : 0, [treasuryDepth, price]);
  const volume24h = useMemo(() => trades.reduce((sum, trade) => sum + trade.price * trade.size, 0), [trades]);
  const marketCap = price * 10_000_000;

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <PageTitle title="Trade EARL" description={`EarlCoin (ASA ${EARL_ASA_ID}) • Treasury reference price ${formatCurrency(price)} • Fractional trading enabled`} />

      <motion.div variants={itemVariants}>
        <MarketStats price={price} totalLiquidity={totalLiquidity} volume24h={volume24h} marketCap={marketCap} />
      </motion.div>

      {!kycVerified && (
        <motion.div variants={itemVariants} className="mb-6">
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium">Trading is gated behind KYC</p>
                  <p className="text-sm text-muted-foreground">Complete verification before buying or selling EARL.</p>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link to="/verification">Complete Verification</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <OrderStatusCard user={user} />
      </motion.div>

      {!isConnected && (
        <motion.div variants={itemVariants} className="mb-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Wallet className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">Connect wallet for live balances</h3>
                    <p className="text-sm text-muted-foreground">Card checkout works without a wallet, but Algorand balances and swap routing need one.</p>
                  </div>
                </div>
                <Button onClick={handleConnect} size="lg">Connect Wallet</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.div className="lg:col-span-4" variants={itemVariants}>
          <TradeForm price={price} kycVerified={kycVerified} />
        </motion.div>

        <motion.div className="lg:col-span-4" variants={itemVariants}>
          <OrderBook onPriceSelect={setPrice} orderBook={orderBook} price={price} />
        </motion.div>

        <motion.div className="lg:col-span-4" variants={itemVariants}>
          <TradeHistory trades={trades} />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Trade;

