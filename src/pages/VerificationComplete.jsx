
import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, Loader2, AlertTriangle, Gift } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import algosdk from 'algosdk';
import { VNFT_ADMIN_ADDRESS } from '@/lib/config';
import { hasVnft, algodClient } from '@/lib/algorand';

const VerificationComplete = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { accountAddress, handleConnect, setHasVerificationNft, signTransactions } = useAppContext();
    const [status, setStatus] = useState('verifying');
    const [checkingWallet, setCheckingWallet] = useState(false);
    const [minting, setMinting] = useState(false);
    const [optingIn, setOptingIn] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [nftAssetId, setNftAssetId] = useState(null);
    const [optedIn, setOptedIn] = useState(false);
    const navigate = useNavigate();
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!user) {
            setStatus('error');
            toast({ variant: 'destructive', title: 'Not logged in', description: 'You must be logged in to complete verification.' });
            return;
        }

        const cleanup = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            const channel = supabase.channel(`kyc-verification-${user.id}`);
            if (channel) {
                supabase.removeChannel(channel);
            }
        };

        const checkStatus = async () => {
            const { data } = await supabase.from('profiles').select('kyc_verified').eq('id', user.id).single();
            if (data?.kyc_verified) {
                setStatus('verified');
                cleanup();
                return;
            }
            const sessionId = localStorage.getItem('stripe_kyc_session_id');
            if (sessionId) {
                try {
                    const { data: syncData, error } = await supabase.functions.invoke('sync-kyc-status', {
                        body: JSON.stringify({ session_id: sessionId })
                    });
                    if (!error && syncData?.status === 'verified') {
                        setStatus('verified');
                        cleanup();
                    }
                } catch (e) {
                    // ignore
                }
            }
        };

        checkStatus();

        const channel = supabase.channel(`kyc-verification-${user.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                (payload) => {
                    if (payload.new.kyc_verified === true) {
                        setStatus('verified');
                        cleanup();
                    }
                }
            )
            .subscribe();

        intervalRef.current = setInterval(checkStatus, 5000);

        const timeoutId = setTimeout(() => {
            if (status === 'verifying') {
                setStatus('timeout');
                cleanup();
            }
        }, 60000);

        return () => {
            cleanup();
            clearTimeout(timeoutId);
        };
    }, [user, toast, status]);

    useEffect(() => {
        if (!user) return;
        const stored = localStorage.getItem(`vnft_asset_id_${user.id}`);
        if (stored) {
            const parsed = Number(stored);
            if (!Number.isNaN(parsed)) setNftAssetId(parsed);
        }
    }, [user]);

    useEffect(() => {
        if (!accountAddress || status !== 'verified') return;
        let cancelled = false;
        const checkExisting = async () => {
            try {
                const owns = await hasVnft(accountAddress);
                if (!cancelled && owns) {
                    setStatus('minted');
                    setHasVerificationNft(true);
                }
            } catch {
                // ignore
            }
        };
        checkExisting();
        return () => {
            cancelled = true;
        };
    }, [accountAddress, status, setHasVerificationNft]);

    useEffect(() => {
        const checkOptIn = async () => {
            if (!accountAddress || !nftAssetId) {
                setOptedIn(false);
                return;
            }
            try {
                const acct = await algodClient.accountInformation(accountAddress).do();
                const assets = acct?.assets || [];
                setOptedIn(assets.some((a) => a['asset-id'] === Number(nftAssetId)));
            } catch {
                setOptedIn(false);
            }
        };
        checkOptIn();
    }, [accountAddress, nftAssetId]);

    const handleCheckWallet = async () => {
        if (!accountAddress) {
            toast({ variant: 'destructive', title: 'Wallet Not Connected', description: 'Please connect your Pera Wallet to verify VNFT ownership.' });
            handleConnect();
            return;
        }
        setCheckingWallet(true);
        try {
            const owns = await hasVnft(accountAddress);
            if (owns) {
                setStatus('minted');
                setHasVerificationNft(true);
                toast({ title: 'Verification NFT Found', description: 'You are verified on-chain.' });
            } else {
                toast({ variant: 'destructive', title: 'VNFT Not Found', description: 'Your wallet does not hold a verification NFT.' });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Wallet Check Failed', description: 'Could not verify VNFT ownership. Please try again.' });
        } finally {
            setCheckingWallet(false);
        }
    };

    const handleMintVnft = async () => {
        if (!accountAddress) {
            toast({ variant: 'destructive', title: 'Wallet Not Connected', description: 'Please connect your Pera Wallet to mint the VNFT.' });
            handleConnect();
            return;
        }
        if (!VNFT_ADMIN_ADDRESS) {
            toast({ variant: 'destructive', title: 'VNFT Admin Missing', description: 'Set VITE_VNFT_ADMIN_ADDRESS to enable minting.' });
            return;
        }
        setMinting(true);
        try {
            const { data, error } = await supabase.functions.invoke('mint-vnft', {
                body: JSON.stringify({ wallet_address: accountAddress, user_id: user.id })
            });
            if (error || data?.error) {
                const errMsg = error?.message || data?.error?.message || data?.error || 'Mint failed';
                throw new Error(errMsg);
            }

            if (data?.status === 'pending' && !data?.assetId) {
                toast({ title: 'Mint Submitted', description: 'Your VNFT mint was submitted and may take a minute to confirm. If you see it in your wallet, click “I already have a VNFT — check wallet”.' });
                return;
            }

            const assetId = data?.assetId;
            setNftAssetId(assetId);
            if (assetId && user?.id) {
                localStorage.setItem(`vnft_asset_id_${user.id}`, String(assetId));
            }
            toast({ title: 'VNFT Created', description: `Asset ID: ${assetId}. Please opt-in to receive it.` });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'VNFT Mint Failed', description: err.message || 'Please try again.' });
        } finally {
            setMinting(false);
        }
    };

    const handleOptInVnft = async () => {
        if (!accountAddress) {
            toast({ variant: 'destructive', title: 'Wallet Not Connected', description: 'Please connect your Pera Wallet to opt in.' });
            handleConnect();
            return;
        }
        if (!nftAssetId) {
            toast({ variant: 'destructive', title: 'Missing Asset', description: 'Mint your VNFT first.' });
            return;
        }
        setOptingIn(true);
        try {
            const suggestedParams = await algodClient.getTransactionParams().do();
            const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                sender: accountAddress,
                receiver: accountAddress,
                amount: 0,
                assetIndex: Number(nftAssetId),
                suggestedParams,
            });
            const signed = await signTransactions([[{ txn: optInTxn, signers: [accountAddress] }]]);
            const { txId } = await algodClient.sendRawTransaction(signed).do();
            await algosdk.waitForConfirmation(algodClient, txId, 4);
            setOptedIn(true);
            toast({ title: 'Opt-in Complete', description: 'You can now claim your VNFT.' });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Opt-in Failed', description: err.message || 'Please try again.' });
        } finally {
            setOptingIn(false);
        }
    };

    const handleClaimVnft = async () => {
        if (!accountAddress || !nftAssetId) {
            toast({ variant: 'destructive', title: 'Missing Data', description: 'Connect wallet and mint VNFT first.' });
            return;
        }
        if (!optedIn) {
            toast({ variant: 'destructive', title: 'Not Opted In', description: 'Please opt in to the VNFT asset before claiming.' });
            return;
        }
        setClaiming(true);
        try {
            const { data, error } = await supabase.functions.invoke('transfer-vnft', {
                body: JSON.stringify({ wallet_address: accountAddress, asset_id: nftAssetId })
            });
            if (error || data?.error) {
                const errMsg = error?.message || data?.error?.message || data?.error || 'Transfer failed';
                throw new Error(errMsg);
            }
            setStatus('minted');
            setHasVerificationNft(true);
            if (user?.id) {
                localStorage.removeItem(`vnft_asset_id_${user.id}`);
            }
            toast({ title: 'VNFT Transferred', description: 'Verification complete.' });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Transfer Failed', description: err.message || 'Please try again.' });
        } finally {
            setClaiming(false);
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'verifying':
                return (
                    <>
                        <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
                        <CardTitle className="mt-6">Verification in Progress</CardTitle>
                        <CardDescription>We're confirming your details. This may take a moment.</CardDescription>
                    </>
                );
            case 'verified':
                return (
                    <>
                        <CheckCircle className="h-16 w-16 text-green-500" />
                        <CardTitle className="mt-6">You are Verified!</CardTitle>
                        <CardDescription>Your identity has been confirmed. Mint your on-chain VNFT to complete the process.</CardDescription>
                        {nftAssetId && (
                            <p className="text-xs text-muted-foreground mt-2">Asset ID: {nftAssetId}</p>
                        )}
                        <div className="flex flex-col gap-3 mt-6">
                            <Button onClick={handleMintVnft} disabled={minting} className="bg-gradient-to-r from-green-500 to-teal-500">
                                {minting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                                Mint Verification NFT
                            </Button>
                            {nftAssetId && (
                                <>
                                    <Button onClick={handleOptInVnft} variant="secondary" disabled={optingIn || optedIn}>
                                        {optingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        {optedIn ? 'Opted In' : 'Opt-in to VNFT'}
                                    </Button>
                                    <Button onClick={handleClaimVnft} variant="secondary" disabled={claiming || !optedIn}>
                                        {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Claim VNFT
                                    </Button>
                                </>
                            )}
                            <Button onClick={handleCheckWallet} disabled={checkingWallet} variant="outline">
                                {checkingWallet ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                I already have a VNFT — check wallet
                            </Button>
                        </div>
                    </>
                );
            case 'minted':
                 return (
                    <>
                        <Gift className="h-16 w-16 text-primary" />
                        <CardTitle className="mt-6">NFT Minted Successfully!</CardTitle>
                        <CardDescription>
                            {nftAssetId ? (
                                <>Asset ID: <a href={`https://testnet.explorer.perawallet.app/asset/${nftAssetId}`} target="_blank" rel="noopener noreferrer" className="underline">{nftAssetId}</a>. </>
                            ) : null}
                            Welcome to the DAO!
                        </CardDescription>
                        <Button onClick={() => navigate('/trade')} className="mt-6">Start Trading</Button>
                    </>
                );
            case 'timeout':
                return (
                    <>
                        <AlertTriangle className="h-16 w-16 text-yellow-500" />
                        <CardTitle className="mt-6">Verification Timed Out</CardTitle>
                        <CardDescription>We couldn't confirm your status. Please check back later or contact support if the issue persists.</CardDescription>
                        <Button onClick={() => navigate('/verification')} className="mt-6">Try Again</Button>
                    </>
                );
            case 'error':
            default:
                return (
                    <>
                        <AlertTriangle className="h-16 w-16 text-red-500" />
                        <CardTitle className="mt-6">An Error Occurred</CardTitle>
                        <CardDescription>Something went wrong. Please return to the verification page and try again.</CardDescription>
                        <Button onClick={() => navigate('/verification')} className="mt-6">Back to Verification</Button>
                    </>
                );
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <PageTitle title="Verification Complete" description="Finalizing your DAO membership." />
            <div className="flex justify-center">
                <Card className="w-full max-w-lg">
                    <CardHeader />
                    <CardContent className="flex flex-col items-center text-center p-10">
                        {renderContent()}
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    );
};

export default VerificationComplete;
