import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Wallet, CreditCard, ArrowRightLeft, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_PUBLISHABLE_KEY, EARL_STRIPE_PRICE_ID } from '@/lib/config';

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const MarketStats = () => {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current Price</p>
            <p className="text-2xl font-bold">$1.25</p>
            <p className="text-xs text-green-400 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              +2.4% (24h)
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">24h Volume</p>
            <p className="text-2xl font-bold">$287K</p>
            <p className="text-xs text-muted-foreground mt-1">228,412 EARL</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Market Cap</p>
            <p className="text-2xl font-bold">$12.5M</p>
            <p className="text-xs text-muted-foreground mt-1">10M EARL supply</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Liquidity</p>
            <p className="text-2xl font-bold">$1.8M</p>
            <p className="text-xs text-muted-foreground mt-1">LP Depth</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const OrderBook = ({ onPriceSelect }) => {
  const bids = [
    { price: 1.24, size: 3500, total: 4340.00 },
    { price: 1.23, size: 5000, total: 6150.00 },
    { price: 1.22, size: 2000, total: 2440.00 },
    { price: 1.21, size: 10000, total: 12100.00 },
    { price: 1.20, size: 7500, total: 9000.00 },
  ];
  const asks = [
    { price: 1.26, size: 4000, total: 5040.00 },
    { price: 1.27, size: 6000, total: 7620.00 },
    { price: 1.28, size: 1500, total: 1920.00 },
    { price: 1.29, size: 8000, total: 10320.00 },
    { price: 1.30, size: 5500, total: 7150.00 },
  ].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Book</CardTitle>
        <CardDescription>EARL/USDC Liquidity Pool</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pr-2">
        <div className="grid grid-cols-3 text-xs text-muted-foreground px-2">
          <span>Price (USDC)</span>
          <span className="text-right">Size (EARL)</span>
          <span className="text-right">Total (USDC)</span>
        </div>
        <div className="h-48 overflow-y-auto space-y-1">
          {asks.map((order, i) => (
            <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md cursor-pointer hover:bg-secondary/50 relative" onClick={() => onPriceSelect(order.price)}>
              <span className="text-red-400 font-medium">{order.price.toFixed(2)}</span>
              <span className="text-right">{order.size.toLocaleString()}</span>
              <span className="text-right">{order.total.toFixed(2)}</span>
              <div className="absolute top-0 left-0 h-full bg-red-500/10" style={{ width: `${(order.size / 10000) * 100}%`}}></div>
            </div>
          ))}
        </div>
        <div className="text-xl font-bold text-center py-3 border-y border-border/50 bg-primary/5">
          $1.25 <span className="text-xs font-normal text-muted-foreground">SPREAD: 0.01</span>
        </div>
        <div className="h-48 overflow-y-auto space-y-1">
          {bids.map((order, i) => (
            <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md cursor-pointer hover:bg-secondary/50 relative" onClick={() => onPriceSelect(order.price)}>
              <span className="text-green-400 font-medium">{order.price.toFixed(2)}</span>
              <span className="text-right">{order.size.toLocaleString()}</span>
              <span className="text-right">{order.total.toFixed(2)}</span>
              <div className="absolute top-0 left-0 h-full bg-green-500/10" style={{ width: `${(order.size / 10000) * 100}%`}}></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const TradeHistory = () => {
  const trades = [
    { price: 1.25, size: 1200, time: '10:34:12', type: 'buy' },
    { price: 1.26, size: 500, time: '10:34:09', type: 'sell' },
    { price: 1.25, size: 2000, time: '10:33:58', type: 'buy' },
    { price: 1.24, size: 750, time: '10:33:55', type: 'buy' },
    { price: 1.26, size: 1200, time: '10:33:41', type: 'sell' },
    { price: 1.25, size: 3500, time: '10:33:21', type: 'buy' },
    { price: 1.24, size: 800, time: '10:33:15', type: 'buy' },
    { price: 1.25, size: 1500, time: '10:33:02', type: 'sell' },
  ];
  return (
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
          {trades.map((trade, i) => (
            <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md hover:bg-secondary/20">
              <span className={cn("font-medium", trade.type === 'buy' ? 'text-green-400' : 'text-red-400')}>
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
  )
}

const TradeForm = ({ price, setPrice }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isConnected, accountAddress, handleConnect, signTransactions } = useAppContext();
  const [usdcAmount, setUsdcAmount] = useState('');
  const [earlAmount, setEarlAmount] = useState('');
  const [activeTab, setActiveTab] = useState('buy');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [balances] = useState({ earl: 12500, usdc: 3250, algo: 125 });
  
  const handleEarlChange = (e) => {
    const value = e.target.value;
    setEarlAmount(value);
    if (price && value) {
      setUsdcAmount((parseFloat(value) * parseFloat(price)).toFixed(2));
    } else {
      setUsdcAmount('');
    }
  };

  const handleUsdcChange = (e) => {
    const value = e.target.value;
    setUsdcAmount(value);
    if (price && value && parseFloat(price) > 0) {
      setEarlAmount((parseFloat(value) / parseFloat(price)).toFixed(4));
    } else {
      setEarlAmount('');
    }
  };

  const handleBuyWithStripe = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not logged in', description: 'Please log in to purchase tokens.' });
      return;
    }
    toast({
      title: 'Stripe Checkout',
      description: 'Redirecting to secure payment...'
    });
  };

  const handleSwapWithPera = async () => {
    if (!isConnected) {
      toast({ variant: 'destructive', title: 'Wallet not connected', description: 'Please connect your Pera Wallet first.' });
      return;
    }
    toast({
      title: '🚧 Atomic Swap',
      description: "Processing your trade on Algorand..."
    });
  };

  return (
    <Card>
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
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">EARL</p>
                  <p className="font-bold">{balances.earl.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">USDC</p>
                  <p className="font-bold">{balances.usdc.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">ALGO</p>
                  <p className="font-bold">{balances.algo.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        )}

        <TabsContent value="buy">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buy-amount">Amount (EARL)</Label>
              <Input
                id="buy-amount"
                type="text"
                placeholder="1,000"
                value={earlAmount}
                onChange={handleEarlChange}
                className="text-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buy-total">Total (USDC)</Label>
              <Input
                id="buy-total"
                type="text"
                placeholder="1,250.00"
                value={usdcAmount}
                onChange={handleUsdcChange}
                className="text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === 'stripe' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('stripe')}
                  className="w-full"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Credit Card
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'wallet' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('wallet')}
                  className="w-full"
                  disabled={!isConnected}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Pera Wallet
                </Button>
              </div>
            </div>

            {paymentMethod === 'stripe' ? (
              <>
                <Button
                  onClick={handleBuyWithStripe}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  Buy with Card
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Secure payment via Stripe • Tokens delivered instantly
                </p>
              </>
            ) : (
              <>
                <Button
                  onClick={handleSwapWithPera}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={loading || !isConnected}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                  Swap USDC → EARL
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Atomic swap on Algorand • 0.1% fee
                </p>
              </>
            )}
          </CardContent>
        </TabsContent>

        <TabsContent value="sell">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sell-amount">Amount (EARL)</Label>
              <Input
                id="sell-amount"
                type="text"
                placeholder="1,000"
                value={earlAmount}
                onChange={handleEarlChange}
                className="text-gray-900"
              />
              {isConnected && (
                <p className="text-xs text-muted-foreground">
                  Available: {balances.earl.toLocaleString()} EARL
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sell-total">Receive (USDC)</Label>
              <Input
                id="sell-total"
                type="text"
                placeholder="1,250.00"
                value={usdcAmount}
                onChange={handleUsdcChange}
                disabled
                className="text-gray-900"
              />
            </div>
            <Button
              onClick={handleSwapWithPera}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={loading || !isConnected}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
              Swap EARL → USDC
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Instant settlement on Algorand • 0.1% fee
            </p>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

const Trade = () => {
  const [price, setPrice] = useState('1.25');
  const { isConnected, handleConnect } = useAppContext();

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <PageTitle
        title="Trade EARL"
        description={`EarlCoin (ASA 756256156) • Real Estate Backed • Buy with Card or Algorand`}
      />
      
      <motion.div variants={itemVariants}>
        <MarketStats />
      </motion.div>

      {!isConnected && (
        <motion.div variants={itemVariants} className="mb-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Wallet className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">Connect Pera Wallet for Trading</h3>
                    <p className="text-sm text-muted-foreground">Trade EARL tokens directly on Algorand</p>
                  </div>
                </div>
                <Button onClick={handleConnect} size="lg">
                  Connect Wallet
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.div className="lg:col-span-4" variants={itemVariants}>
          <TradeForm price={price} setPrice={setPrice} />
        </motion.div>

        <motion.div className="lg:col-span-4" variants={itemVariants}>
          <OrderBook onPriceSelect={(p) => setPrice(p.toFixed(2))} />
        </motion.div>

        <motion.div className="lg:col-span-4" variants={itemVariants}>
          <TradeHistory />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Trade;
