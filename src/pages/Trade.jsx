
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Loader2, Wallet, CreditCard, ArrowRightLeft, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { cn } from '@/lib/utils';
import { normalizeTxId } from '@/lib/algorand';
import { supabase } from '@/lib/customSupabaseClient';
import { loadStripe } from '@stripe/stripe-js';
import algosdk from 'algosdk';
import { ALGOD_URL, EARL_ASA_ID, USDC_ASA_ID, STRIPE_PUBLISHABLE_KEY, EARL_STRIPE_PRICE_ID, GOV_APP_ID, TREASURY_ADDRESS, ATOMIC_SWAP_ENABLED } from '@/lib/config';

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const DAO_TREASURY_WALLET = TREASURY_ADDRESS || (GOV_APP_ID ? algosdk.getApplicationAddress(GOV_APP_ID) : '');

if (!DAO_TREASURY_WALLET) {
  console.warn('Missing DAO treasury config: set VITE_TREASURY_ADDRESS or VITE_GOV_APP_ID');
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const OrderBook = ({ onPriceSelect }) => {
  const bids = [
    { price: 1.24, size: 350, total: 434.00 },
    { price: 1.23, size: 500, total: 615.00 },
    { price: 1.22, size: 200, total: 244.00 },
    { price: 1.21, size: 1000, total: 1210.00 },
  ];
  const asks = [
    { price: 1.26, size: 400, total: 504.00 },
    { price: 1.27, size: 600, total: 762.00 },
    { price: 1.28, size: 150, total: 192.00 },
    { price: 1.29, size: 800, total: 1032.00 },
  ].reverse();

  return (
    <Card>
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
          {asks.map((order, i) => (
            <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md cursor-pointer hover:bg-secondary/50 relative" onClick={() => onPriceSelect(order.price)}>
              <span className="text-red-400">{order.price.toFixed(2)}</span>
              <span className="text-right">{order.size.toLocaleString()}</span>
              <span className="text-right">{order.total.toFixed(2)}</span>
              <div className="absolute top-0 left-0 h-full bg-red-500/10" style={{ width: `${(order.size / 1000) * 100}%`}}></div>
            </div>
          ))}
        </div>
        <div className="text-lg font-bold text-center py-2 border-y border-border/50">
          1.25 USDC
        </div>
        <div className="h-40 overflow-y-auto space-y-1">
          {bids.map((order, i) => (
            <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md cursor-pointer hover:bg-secondary/50 relative" onClick={() => onPriceSelect(order.price)}>
              <span className="text-green-400">{order.price.toFixed(2)}</span>
              <span className="text-right">{order.size.toLocaleString()}</span>
              <span className="text-right">{order.total.toFixed(2)}</span>
              <div className="absolute top-0 left-0 h-full bg-green-500/10" style={{ width: `${(order.size / 1000) * 100}%`}}></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const TradeHistory = () => {
  const trades = [
    { price: 1.25, size: 100, time: '10:34:12', type: 'buy' },
    { price: 1.26, size: 50, time: '10:34:09', type: 'sell' },
    { price: 1.25, size: 200, time: '10:33:58', type: 'buy' },
    { price: 1.24, size: 75, time: '10:33:55', type: 'buy' },
    { price: 1.26, size: 120, time: '10:33:41', type: 'sell' },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Trade History</CardTitle></CardHeader>
      <CardContent className="space-y-2 pr-2">
        <div className="grid grid-cols-3 text-xs text-muted-foreground px-2">
          <span>Price (USDC)</span>
          <span className="text-right">Size (EARL)</span>
          <span className="text-right">Time</span>
        </div>
        <div className="h-[14.5rem] overflow-y-auto space-y-1">
          {trades.map((trade, i) => (
            <div key={i} className="grid grid-cols-3 text-xs p-1 rounded-md">
              <span className={cn(trade.type === 'buy' ? 'text-green-400' : 'text-red-400')}>{trade.price.toFixed(2)}</span>
              <span className="text-right">{trade.size}</span>
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
  const [balances, setBalances] = useState({ earl: 0, usdc: 0, algo: 0 });
  const [isOptedIn, setIsOptedIn] = useState({ earl: false, usdc: false });
  const [searchParams, setSearchParams] = useSearchParams();

  const algodClient = new algosdk.Algodv2('', ALGOD_URL, '');

  useEffect(() => {
    const status = searchParams.get('status');
    const sessionId = searchParams.get('session_id');
    if (!status) return;

    const handleStatus = async () => {
      if (status === 'cancelled') {
        toast({ variant: 'destructive', title: 'Checkout Cancelled', description: 'Your payment was cancelled.' });
      }

      if (status === 'success' && sessionId) {
        try {
          const { data, error } = await supabase.functions.invoke('treasury-claim', {
            body: JSON.stringify({ session_id: sessionId })
          });
          if (error || data?.error) {
            throw new Error(error?.message || data?.error || 'Claim failed');
          }
          toast({ title: 'Tokens Delivered', description: `Treasury transfer completed${data?.txId ? ` (TX: ${data.txId})` : ''}.` });
        } catch (err) {
          toast({ variant: 'destructive', title: 'Claim Failed', description: err.message || 'Please try again.' });
        }
      }

      searchParams.delete('status');
      searchParams.delete('session_id');
      setSearchParams(searchParams);
    };

    handleStatus();
  }, [searchParams, setSearchParams, toast]);

  useEffect(() => {
    if (isConnected && accountAddress) {
      fetchBalances();
      checkOptInStatus();
    }
  }, [isConnected, accountAddress]);

  const fetchBalances = async () => {
    if (!accountAddress) return;

    try {
      const accountInfo = await algodClient.accountInformation(accountAddress).do();
      const algoBalance = accountInfo.amount / 1000000;

      let earlBalance = 0;
      let usdcBalance = 0;

      if (accountInfo.assets) {
        const earlAsset = accountInfo.assets.find(a => a['asset-id'] === EARL_ASA_ID);
        const usdcAsset = accountInfo.assets.find(a => a['asset-id'] === USDC_ASA_ID);

        if (earlAsset) earlBalance = earlAsset.amount;
        if (usdcAsset) usdcBalance = usdcAsset.amount / 1000000;
      }

      setBalances({ earl: earlBalance, usdc: usdcBalance, algo: algoBalance });
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  const checkOptInStatus = async () => {
    if (!accountAddress) return;

    try {
      const accountInfo = await algodClient.accountInformation(accountAddress).do();
      const assets = accountInfo.assets || [];

      setIsOptedIn({
        earl: assets.some(a => a['asset-id'] === EARL_ASA_ID),
        usdc: assets.some(a => a['asset-id'] === USDC_ASA_ID)
      });
    } catch (error) {
      console.error('Error checking opt-in status:', error);
    }
  };

  const handleOptIn = async (assetId, assetName) => {
    if (!isConnected) {
      toast({ variant: 'destructive', title: 'Wallet not connected', description: 'Please connect your Pera Wallet first.' });
      return;
    }

    setLoading(true);
    try {
      const suggestedParams = await algodClient.getTransactionParams().do();

      const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: accountAddress,
        receiver: accountAddress,
        amount: 0,
        assetIndex: assetId,
        suggestedParams
      });

      const singleTxnGroups = [{ txn: optInTxn, signers: [accountAddress] }];
      const signedTxn = await signTransactions([singleTxnGroups]);

      const sendResult = await algodClient.sendRawTransaction(signedTxn).do();
      const txId = normalizeTxId(sendResult);
      if (!txId) {
        throw new Error('Transaction submission failed (missing txId).');
      }
      await algosdk.waitForConfirmation(algodClient, txId, 4);

      toast({ title: 'Success!', description: `Successfully opted into ${assetName}` });
      await checkOptInStatus();
      await fetchBalances();
    } catch (error) {
      console.error('Opt-in error:', error);
      toast({ variant: 'destructive', title: 'Opt-in Failed', description: error.message || 'Failed to opt into asset' });
    } finally {
      setLoading(false);
    }
  };

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
    if (!earlAmount || parseFloat(earlAmount) <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount of EARL to buy.' });
      return;
    }
    if (parseFloat(earlAmount) < 1) {
      toast({ variant: 'destructive', title: 'Minimum Purchase', description: 'Minimum purchase is 1 EARL.' });
      return;
    }
    if (!stripePromise || !EARL_STRIPE_PRICE_ID) {
      toast({ variant: 'destructive', title: 'Stripe Not Configured', description: 'Set VITE_STRIPE_PUBLISHABLE_KEY and VITE_EARL_STRIPE_PRICE_ID to enable checkout.' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: JSON.stringify({
          user_id: user.id,
          price_id: EARL_STRIPE_PRICE_ID,
          quantity: Math.ceil(parseFloat(earlAmount)),
          wallet_address: accountAddress || 'not_connected',
          purchase_type: 'earl'
        }),
      });

      if (error || data.error) {
        throw new Error(error?.message || data.error.message);
      }

      const { sessionId } = data;
      const stripe = await stripePromise;
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
      if (stripeError) {
        throw stripeError;
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Checkout Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSwapWithPera = async () => {
    if (!isConnected) {
      toast({ variant: 'destructive', title: 'Wallet not connected', description: 'Please connect your Pera Wallet first.' });
      return;
    }

    if (!GOV_APP_ID || !DAO_TREASURY_WALLET) {
      toast({ variant: 'destructive', title: 'Treasury Not Configured', description: 'Set VITE_GOV_APP_ID and/or VITE_TREASURY_ADDRESS to enable swaps.' });
      return;
    }

    if (!ATOMIC_SWAP_ENABLED) {
      toast({ variant: 'destructive', title: 'Atomic Swap Disabled', description: 'Enable VITE_ENABLE_ATOMIC_SWAP=true after deploying on-chain swap logic.' });
      return;
    }

    if (!earlAmount || parseFloat(earlAmount) <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount.' });
      return;
    }

    if (activeTab === 'buy' && !isOptedIn.earl) {
      toast({ variant: 'destructive', title: 'Opt-in Required', description: 'Please opt into EARL token first.' });
      return;
    }

    if (activeTab === 'buy' && !isOptedIn.usdc) {
      toast({ variant: 'destructive', title: 'Opt-in Required', description: 'Please opt into USDC first.' });
      return;
    }

    setLoading(true);
    try {
      const suggestedParams = await algodClient.getTransactionParams().do();

      const usdcAmountMicroAlgos = Math.floor(parseFloat(usdcAmount) * 1000000);
      const earlAmountMicroAlgos = Math.floor(parseFloat(earlAmount) * 1000000);

      let payTxn;
      let appCallTxn;

      // Use TextEncoder instead of Buffer for better browser compatibility in v3
      const encoder = new TextEncoder();

      if (activeTab === 'buy') {
        payTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: accountAddress,
          receiver: DAO_TREASURY_WALLET,
          amount: usdcAmountMicroAlgos,
          assetIndex: USDC_ASA_ID,
          suggestedParams,
        });

        appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
          sender: accountAddress,
          appIndex: GOV_APP_ID,
          appArgs: [
            encoder.encode("trade"),
            encoder.encode("buy"),
            algosdk.encodeUint64(usdcAmountMicroAlgos),
          ],
          suggestedParams,
        });
      } else {
        payTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: accountAddress,
          receiver: DAO_TREASURY_WALLET,
          amount: earlAmountMicroAlgos,
          assetIndex: EARL_ASA_ID,
          suggestedParams,
        });

        appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
          sender: accountAddress,
          appIndex: GOV_APP_ID,
          appArgs: [
            encoder.encode("trade"),
            encoder.encode("sell"),
            algosdk.encodeUint64(earlAmountMicroAlgos),
          ],
          suggestedParams,
        });
      }

      const txnGroup = algosdk.assignGroupID([payTxn, appCallTxn]);

      const singleTxnGroups = [
        { txn: payTxn, signers: [accountAddress] },
        { txn: appCallTxn, signers: [accountAddress] }
      ];

      const signedTxns = await signTransactions([singleTxnGroups]);

      toast({
        title: '🚧 Atomic Swap Coming Soon!',
        description: "This feature isn't implemented yet-but don't worry! You can request it in your next prompt! 🚀"
      });

      await fetchBalances();
    } catch (error) {
      console.error('Swap error:', error);
      toast({ variant: 'destructive', title: 'Swap Failed', description: error.message || 'Transaction failed' });
    } finally {
      setLoading(false);
    }
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

        {/* Wallet Connection Section */}
        {!isConnected && (
          <CardContent className="pb-4">
            <div className="bg-secondary/50 rounded-lg p-4 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Pera Wallet</span>
                </div>
                <Button onClick={handleConnect} size="sm" variant="outline">
                  Connect Wallet
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Connect your wallet to trade ASA tokens</p>
            </div>
          </CardContent>
        )}

        {/* Balances Section */}
        {isConnected && (
          <CardContent className="pb-4">
            <div className="bg-secondary/50 rounded-lg p-4 border border-border/50 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Wallet</span>
                <span className="font-mono text-xs">{accountAddress?.slice(0, 6)}...{accountAddress?.slice(-4)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">EARL</p>
                  <p className="font-bold">{balances.earl.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">USDC</p>
                  <p className="font-bold">{balances.usdc.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">ALGO</p>
                  <p className="font-bold">{balances.algo.toFixed(2)}</p>
                </div>
              </div>

              {/* Opt-in Status */}
              {(!isOptedIn.earl || !isOptedIn.usdc) && (
                <div className="pt-2 border-t border-border/30 space-y-2">
                  {!isOptedIn.earl && (
                    <Button
                      onClick={() => handleOptIn(EARL_ASA_ID, 'EARL')}
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Opt-in to EARL (ASA {EARL_ASA_ID})
                    </Button>
                  )}
                  {!isOptedIn.usdc && (
                    <Button
                      onClick={() => handleOptIn(USDC_ASA_ID, 'USDC')}
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Opt-in to USDC (ASA {USDC_ASA_ID})
                    </Button>
                  )}
                </div>
              )}
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
                placeholder="100"
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
                placeholder="125.00"
                value={usdcAmount}
                onChange={handleUsdcChange}
                className="text-gray-900"
              />
            </div>

            {/* Payment Method Selection */}
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
                  Buy with Stripe
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Purchase EARL tokens directly with a credit/debit card via Stripe
                </p>
              </>
            ) : (
              <>
                <Button
                  onClick={handleSwapWithPera}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={loading || !isConnected || !isOptedIn.earl || !isOptedIn.usdc || !ATOMIC_SWAP_ENABLED}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                  Swap USDC for EARL
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {ATOMIC_SWAP_ENABLED
                    ? `Atomic swap using your Pera Wallet (ASA ${EARL_ASA_ID})`
                    : 'Atomic swap disabled until on-chain swap logic is deployed.'}
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
                placeholder="100"
                value={earlAmount}
                onChange={handleEarlChange}
                className="text-gray-900"
              />
              {isConnected && (
                <p className="text-xs text-muted-foreground">
                  Available: {balances.earl.toFixed(2)} EARL
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sell-total">Receive (USDC)</Label>
              <Input
                id="sell-total"
                type="text"
                placeholder="125.00"
                value={usdcAmount}
                onChange={handleUsdcChange}
                disabled
                className="text-gray-900"
              />
            </div>
            <Button
              onClick={handleSwapWithPera}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={loading || !isConnected || !isOptedIn.earl || !isOptedIn.usdc || !ATOMIC_SWAP_ENABLED}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
              Swap EARL for USDC
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {ATOMIC_SWAP_ENABLED
                ? 'Atomic swap EARL for USDC on-chain using Pera Wallet'
                : 'Atomic swap disabled until on-chain swap logic is deployed.'}
            </p>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

const NotVerifiedCover = () => (
  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
    <ShieldAlert className="h-16 w-16 text-primary mb-4" />
    <h3 className="text-xl font-bold">Verification Required</h3>
    <p className="text-muted-foreground mb-4">You need to be verified to trade DAO tokens.</p>
    <Button asChild>
      <Link to="/verification">Get Verified</Link>
    </Button>
  </div>
);

const Trade = () => {
  const { hasVerificationNft, kycVerified } = useAppContext();
  const [price, setPrice] = useState('1.25');
  const isVerified = kycVerified && hasVerificationNft;

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <PageTitle
        title="DEX Trading"
        description={`Trade EarlCoin (ASA ${EARL_ASA_ID}) with Pera Wallet or buy with Stripe`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {!isVerified && <div className="absolute inset-0 z-20"><NotVerifiedCover /></div>}

        <motion.div className={cn("lg:col-span-4", !isVerified && 'blur-sm')} variants={itemVariants}>
          <TradeForm price={price} setPrice={setPrice} />
        </motion.div>

        <motion.div className={cn("lg:col-span-4", !isVerified && 'blur-sm')} variants={itemVariants}>
          <OrderBook onPriceSelect={(p) => setPrice(p.toFixed(2))} />
        </motion.div>

        <motion.div className={cn("lg:col-span-4", !isVerified && 'blur-sm')} variants={itemVariants}>
          <TradeHistory />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Trade;
