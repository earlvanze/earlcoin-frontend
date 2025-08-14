import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowDown, ShieldAlert, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { loadStripe } from '@stripe/stripe-js';
const stripePromise = loadStripe('pk_live_51RmvAnB1j8uA46lA73UjlFW3ykqG1Y6MPNTww6qfNKSnCbB99pnitadSMLjnhbJH6YdLNmORL8e0waarsuE6Y6Ev00jKURgb6y');
const containerVariants = {
  hidden: {
    opacity: 0
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};
const itemVariants = {
  hidden: {
    y: 20,
    opacity: 0
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring'
    }
  }
};
const OrderBook = ({
  onPriceSelect
}) => {
  const bids = [{
    price: 1.24,
    size: 350,
    total: 434.00
  }, {
    price: 1.23,
    size: 500,
    total: 615.00
  }, {
    price: 1.22,
    size: 200,
    total: 244.00
  }, {
    price: 1.21,
    size: 1000,
    total: 1210.00
  }];
  const asks = [{
    price: 1.26,
    size: 400,
    total: 504.00
  }, {
    price: 1.27,
    size: 600,
    total: 762.00
  }, {
    price: 1.28,
    size: 150,
    total: 192.00
  }, {
    price: 1.29,
    size: 800,
    total: 1032.00
  }].reverse();
  return <Card>
                <CardHeader>
                    <CardTitle>Order Book</CardTitle>
                    <CardDescription>EARL/USDC</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pr-2">
                    <div className="grid grid-cols-3 text-xs text-muted-foreground px-2">
                        <span>Price (USDC)</span>
                        <span className="text-right">Size (EARL)</span>
                        <span className="text-right">Total (USDC)</span>
                    </div>
                    <div className="h-40 overflow-y-auto space-y-1">
                        {asks.map((order, i) => <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md cursor-pointer hover:bg-secondary/50 relative" onClick={() => onPriceSelect(order.price)}>
                                <span className="text-red-400">{order.price.toFixed(2)}</span>
                                <span className="text-right">{order.size.toLocaleString()}</span>
                                <span className="text-right">{order.total.toFixed(2)}</span>
                                <div className="absolute top-0 left-0 h-full bg-red-500/10" style={{
            width: `${order.size / 1000 * 100}%`
          }}></div>
                            </div>)}
                    </div>
                    <div className="text-lg font-bold text-center py-2 border-y border-border/50">
                        1.25 USDC
                    </div>
                     <div className="h-40 overflow-y-auto space-y-1">
                        {bids.map((order, i) => <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md cursor-pointer hover:bg-secondary/50 relative" onClick={() => onPriceSelect(order.price)}>
                                <span className="text-green-400">{order.price.toFixed(2)}</span>
                                <span className="text-right">{order.size.toLocaleString()}</span>
                                <span className="text-right">{order.total.toFixed(2)}</span>
                                <div className="absolute top-0 left-0 h-full bg-green-500/10" style={{
            width: `${order.size / 1000 * 100}%`
          }}></div>
                            </div>)}
                    </div>
                </CardContent>
            </Card>;
};
const TradeHistory = () => {
  const trades = [{
    price: 1.25,
    size: 100,
    time: '10:34:12',
    type: 'buy'
  }, {
    price: 1.26,
    size: 50,
    time: '10:34:09',
    type: 'sell'
  }, {
    price: 1.25,
    size: 200,
    time: '10:33:58',
    type: 'buy'
  }, {
    price: 1.24,
    size: 75,
    time: '10:33:55',
    type: 'buy'
  }, {
    price: 1.26,
    size: 120,
    time: '10:33:41',
    type: 'sell'
  }];
  return <Card>
                <CardHeader><CardTitle>Trade History</CardTitle></CardHeader>
                <CardContent className="space-y-2 pr-2">
                    <div className="grid grid-cols-3 text-xs text-muted-foreground px-2">
                        <span>Price (USDC)</span>
                        <span className="text-right">Size (EARL)</span>
                        <span className="text-right">Time</span>
                    </div>
                    <div className="h-[14.5rem] overflow-y-auto space-y-1">
                        {trades.map((trade, i) => <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md">
                                <span className={cn(trade.type === 'buy' ? 'text-green-400' : 'text-red-400')}>{trade.price.toFixed(2)}</span>
                                <span className="text-right">{trade.size}</span>
                                <span className="text-right text-muted-foreground">{trade.time}</span>
                            </div>)}
                    </div>
                </CardContent>
            </Card>;
};
const TradeForm = ({
  price,
  setPrice
}) => {
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const [usdcAmount, setUsdcAmount] = useState('');
  const [earlAmount, setEarlAmount] = useState('');
  const [activeTab, setActiveTab] = useState('buy');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleEarlChange = e => {
    const value = e.target.value;
    setEarlAmount(value);
    if (price && value) {
      setUsdcAmount((parseFloat(value) * parseFloat(price)).toFixed(2));
    } else {
      setUsdcAmount('');
    }
  };
  const handleUsdcChange = e => {
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
      toast({
        variant: 'destructive',
        title: 'Not logged in',
        description: 'Please log in to purchase tokens.'
      });
      return;
    }
    if (!earlAmount || parseFloat(earlAmount) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount of EARL to buy.'
      });
      return;
    }
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('create-checkout-session', {
        body: JSON.stringify({
          user_id: user.id,
          price_id: 'price_1RmwBuB1j8uA46lAWzaRVWgf',
          quantity: Math.ceil(parseFloat(earlAmount))
        })
      });
      if (error || data.error) {
        throw new Error(error?.message || data.error.message);
      }
      const {
        sessionId
      } = data;
      const stripe = await stripePromise;
      const {
        error: stripeError
      } = await stripe.redirectToCheckout({
        sessionId
      });
      if (stripeError) {
        throw stripeError;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Checkout Error",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };
  return <Card>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <CardHeader>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="buy">Buy EARL</TabsTrigger>
                            <TabsTrigger value="sell">Sell EARL</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <TabsContent value="buy">
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="buy-amount">Amount (EARL)</Label>
                                <Input id="buy-amount" type="text" placeholder="100" value={earlAmount} onChange={handleEarlChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="buy-total">Total (USDC)</Label>
                                <Input id="buy-total" type="text" placeholder="125.00" value={usdcAmount} onChange={handleUsdcChange} />
                            </div>
                            <Button onClick={handleBuyWithStripe} className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Buy with Stripe'}
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">Buy EARL tokens directly with a credit/debit card.</p>
                        </CardContent>
                    </TabsContent>
                    <TabsContent value="sell">
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="sell-amount">Amount (EARL)</Label>
                                <Input id="sell-amount" type="text" placeholder="100" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sell-total">Receive (USDC)</Label>
                                <Input id="sell-total" type="text" placeholder="125.00" disabled />
                            </div>
                            <Button onClick={() => toast({
            title: 'Feature not implemented'
          })} className="w-full bg-red-600 hover:bg-red-700 text-white">Sell EARL</Button>
                            <p className="text-xs text-muted-foreground text-center">Swap EARL for USDC on-chain.</p>
                        </CardContent>
                    </TabsContent>
                </Tabs>
            </Card>;
};
const NotVerifiedCover = () => <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
            <ShieldAlert className="h-16 w-16 text-primary mb-4" />
            <h3 className="text-xl font-bold">Verification Required</h3>
            <p className="text-muted-foreground mb-4">You need to be verified to trade DAO tokens.</p>
            <Button asChild>
                <Link to="/verification">Get Verified</Link>
            </Button>
        </div>;
const Trade = () => {
  const {
    hasVerificationNft,
    kycVerified
  } = useAppContext();
  const [price, setPrice] = useState('1.25');
  const isVerified = kycVerified && hasVerificationNft;
  return <motion.div initial="hidden" animate="visible" variants={containerVariants}>
                <PageTitle title="DEX Trading" description="Trustless atomic swaps for EarlCoin (EARL) powered by EXA Swap." />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
                    {!isVerified && <div className="absolute inset-0 z-20"><NotVerifiedCover /></div>}
                    
                    <motion.div className={cn("lg:col-span-4", !isVerified && 'blur-sm')} variants={itemVariants}>
                        <TradeForm price={price} setPrice={setPrice} />
                    </motion.div>

                    <motion.div className={cn("lg:col-span-4", !isVerified && 'blur-sm')} variants={itemVariants}>
                        <OrderBook onPriceSelect={p => setPrice(p.toFixed(2))} />
                    </motion.div>

                    <motion.div className={cn("lg:col-span-4", !isVerified && 'blur-sm')} variants={itemVariants}>
                        <TradeHistory />
                    </motion.div>
                </div>
            </motion.div>;
};
export default Trade;