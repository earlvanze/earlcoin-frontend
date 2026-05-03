
import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle, Gift } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import algosdk from 'algosdk';
import { NETWORK, VNFT_ADMIN_ADDRESS } from '@/lib/config';
import { getVnftAssetId, algodClient } from '@/lib/algorand';

const VerificationComplete = () => {
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const { accountAddress, handleConnect, setHasVerificationNft, signTransactions, refreshVerificationState } = useAppContext();
    const [status, setStatus] = useState('verifying');
    const [checkingWallet, setCheckingWallet] = useState(false);
    const [minting, setMinting] = useState(false);
    const [optingIn, setOptingIn] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [nftAssetId, setNftAssetId] = useState(null);
    const [optedIn, setOptedIn] = useState(false);
    const [automationError, setAutomationError] = useState(null);
    const navigate = useNavigate();
    const intervalRef = useRef(null);
    const automationRef = useRef({ running: false, attemptedConnect: false, completed: false });

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!user) {
            setStatus('error');
            toast({ variant: 'destructive', title: 'Not logged in', description: 'You must be logged in to complete verification.' });
            return;
        }

        let channel;
        const cleanup = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (channel) {
                supabase.removeChannel(channel);
                channel = null;
            }
        };

        const checkStatus = async () => {
            const { data } = await supabase.from('profiles').select('kyc_verified').eq('id', user.id).single();
            if (data?.kyc_verified) {
                setStatus('verified');
                cleanup();
                await refreshVerificationState();
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
                        refreshVerificationState();
                    } else if (!error && ['canceled', 'failed', 'requires_input'].includes(syncData?.status)) {
                        setStatus('kyc_failed');
                        cleanup();
                    }
                } catch (e) {
                    // ignore
                }
            }
        };

        checkStatus();

        channel = supabase.channel(`kyc-verification-${user.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                (payload) => {
                    if (payload.new.kyc_verified === true) {
                        setStatus('verified');
                        cleanup();
                        refreshVerificationState();
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
    }, [authLoading, refreshVerificationState, user, toast, status]);

    useEffect(() => {
        if (!user) return;
        const stored = localStorage.getItem(`vnft_asset_id_${user.id}`);
        if (stored) {
            const parsed = Number(stored);
            if (!Number.isNaN(parsed)) setNftAssetId(parsed);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const loadProfileVnft = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('vnft_asset_id, vnft_wallet')
                .eq('id', user.id)
                .single();
            if (error) return;
            if (data?.vnft_asset_id) {
                setNftAssetId(Number(data.vnft_asset_id));
            }
        };
        loadProfileVnft();
    }, [user]);

    useEffect(() => {
        if (!accountAddress || status !== 'verified') return;
        let cancelled = false;
        const checkExisting = async () => {
            try {
                const assetId = await getVnftAssetId(accountAddress);
                if (!cancelled && assetId) {
                    setNftAssetId(assetId);
                    setOptedIn(true);
                    if (user?.id) {
                        localStorage.setItem(`vnft_asset_id_${user.id}`, String(assetId));
                    }
                    setStatus('minted');
                    setHasVerificationNft(true);
                refreshVerificationState();
                }
            } catch {
                // ignore
            }
        };
        checkExisting();
        return () => {
            cancelled = true;
        };
    }, [accountAddress, status, setHasVerificationNft, user]);

    useEffect(() => {
        if (!accountAddress || !nftAssetId || status !== 'verified') return;
        const checkHolding = async () => {
            try {
                const acct = await algodClient.accountInformation(accountAddress).do();
                const assets = acct?.assets || [];
                const holding = assets.find((a) => a['asset-id'] === Number(nftAssetId));
                if (holding && (holding.amount ?? 0) > 0) {
                    setStatus('minted');
                    setHasVerificationNft(true);
                refreshVerificationState();
                }
            } catch {
                // ignore
            }
        };
        checkHolding();
    }, [accountAddress, nftAssetId, status, setHasVerificationNft]);

    useEffect(() => {
        const checkOptIn = async () => {
            if (!accountAddress || !nftAssetId) {
                setOptedIn(false);
                return;
            }
            try {
                const acct = await algodClient.accountInformation(accountAddress).do();
                const assets = acct?.assets || [];
                const holding = assets.find((a) => a['asset-id'] === Number(nftAssetId));
                const opted = !!holding;
                setOptedIn(opted);
                if (holding && (holding.amount ?? 0) > 0) {
                    setStatus('minted');
                    setHasVerificationNft(true);
                refreshVerificationState();
                }
            } catch {
                setOptedIn(false);
            }
        };
        checkOptIn();
    }, [accountAddress, nftAssetId, setHasVerificationNft]);

    const handleCheckWallet = async () => {
        if (!accountAddress) {
            toast({ variant: 'destructive', title: 'Wallet Not Connected', description: 'Please connect your Algorand wallet to verify VNFT ownership.' });
            handleConnect();
            return;
        }
        setCheckingWallet(true);
        try {
            const assetId = await getVnftAssetId(accountAddress);
            if (assetId) {
                setNftAssetId(assetId);
                setOptedIn(true);
                if (user?.id) {
                    localStorage.setItem(`vnft_asset_id_${user.id}`, String(assetId));
                }
                setStatus('minted');
                setHasVerificationNft(true);
                refreshVerificationState();
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

    const handleMintVnft = async ({ silent = false } = {}) => {
        if (!accountAddress) {
            if (!silent) toast({ variant: 'destructive', title: 'Wallet Not Connected', description: 'Please connect your Algorand wallet to mint the VNFT.' });
            await handleConnect();
            return null;
        }
        if (!VNFT_ADMIN_ADDRESS) {
            if (!silent) toast({ variant: 'destructive', title: 'VNFT Admin Missing', description: 'Set VITE_VNFT_ADMIN_ADDRESS to enable minting.' });
            return null;
        }
        setMinting(true);
        try {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('vnft_asset_id, vnft_wallet')
                .eq('id', user?.id)
                .single();
            if (profileData?.vnft_asset_id) {
                const assetId = Number(profileData.vnft_asset_id);
                setNftAssetId(assetId);
                if (user?.id) {
                    localStorage.setItem(`vnft_asset_id_${user.id}`, String(assetId));
                }
                if (profileData.vnft_wallet && profileData.vnft_wallet === accountAddress) {
                    setStatus('minted');
                    setHasVerificationNft(true);
                refreshVerificationState();
                }
                if (!silent) toast({ title: 'VNFT Assigned', description: `Asset ID: ${assetId}. If you don't see it, opt-in and claim.` });
                return assetId;
            }

            const existingAssetId = await getVnftAssetId(accountAddress);
            if (existingAssetId) {
                setNftAssetId(existingAssetId);
                setOptedIn(true);
                if (user?.id) {
                    localStorage.setItem(`vnft_asset_id_${user.id}`, String(existingAssetId));
                }
                setStatus('minted');
                setHasVerificationNft(true);
                refreshVerificationState();
                if (!silent) toast({ title: 'Verification NFT Found', description: 'You are already verified on-chain.' });
                return existingAssetId;
            }

            const { data, error } = await supabase.functions.invoke('mint-vnft', {
                body: JSON.stringify({ wallet_address: accountAddress, user_id: user.id })
            });
            if (error || data?.error) {
                const errMsg = error?.message || data?.error?.message || data?.error || 'Mint failed';
                throw new Error(errMsg);
            }

            if (data?.status === 'pending' && !data?.assetId) {
                if (!silent) toast({ title: 'Mint Submitted', description: 'Your VNFT mint was submitted and may take a minute to confirm. If you see it in your wallet, click “I already have a VNFT — check wallet”.' });
                return null;
            }

            if ((data?.status === 'already_minted' || data?.status === 'already_assigned') && data?.assetId) {
                setNftAssetId(data.assetId);
                if (user?.id) {
                    localStorage.setItem(`vnft_asset_id_${user.id}`, String(data.assetId));
                }
                if (!silent) toast({ title: 'VNFT Already Minted', description: `Asset ID: ${data.assetId}. Please opt-in to receive it.` });
                return Number(data.assetId);
            }

            const assetId = data?.assetId;
            setNftAssetId(assetId);
            if (assetId && user?.id) {
                localStorage.setItem(`vnft_asset_id_${user.id}`, String(assetId));
            }
            if (!silent) toast({ title: 'VNFT Created', description: `Asset ID: ${assetId}. Please opt-in to receive it.` });
            return assetId ? Number(assetId) : null;
        } catch (err) {
            console.error(err);
            if (!silent) toast({ variant: 'destructive', title: 'VNFT Mint Failed', description: err.message || 'Please try again.' });
            throw err;
        } finally {
            setMinting(false);
        }
    };

    const handleOptInVnft = async (assetIdOverride = null, { silent = false } = {}) => {
        const assetId = assetIdOverride || nftAssetId;
        if (!accountAddress) {
            if (!silent) toast({ variant: 'destructive', title: 'Wallet Not Connected', description: 'Please connect your Algorand wallet to opt in.' });
            await handleConnect();
            return false;
        }
        if (!assetId) {
            if (!silent) toast({ variant: 'destructive', title: 'Missing Asset', description: 'Mint your VNFT first.' });
            return false;
        }
        setOptingIn(true);
        try {
            const suggestedParams = await algodClient.getTransactionParams().do();
            const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                sender: accountAddress,
                receiver: accountAddress,
                amount: 0,
                assetIndex: Number(assetId),
                suggestedParams,
            });
            const signed = await signTransactions([[{ txn: optInTxn, signers: [accountAddress] }]]);
            const signedPayload = Array.isArray(signed) ? signed.flat() : signed;
            const sendResult = await algodClient.sendRawTransaction(signedPayload).do();
            const txId = sendResult?.txId || sendResult;
            if (!txId) {
                throw new Error('Transaction submission failed (missing txId).');
            }
            await algosdk.waitForConfirmation(algodClient, txId, 4);
            setOptedIn(true);
            if (!silent) toast({ title: 'Opt-in Complete', description: 'You can now claim your VNFT.' });
            return true;
        } catch (err) {
            console.error(err);
            if (!silent) toast({ variant: 'destructive', title: 'Opt-in Failed', description: err.message || 'Please try again.' });
            throw err;
        } finally {
            setOptingIn(false);
        }
    };

    const handleClaimVnft = async (assetIdOverride = null, { silent = false } = {}) => {
        const assetId = assetIdOverride || nftAssetId;
        if (!accountAddress || !assetId) {
            if (!silent) toast({ variant: 'destructive', title: 'Missing Data', description: 'Connect wallet and mint VNFT first.' });
            return false;
        }
        if (!optedIn && !assetIdOverride) {
            if (!silent) toast({ variant: 'destructive', title: 'Not Opted In', description: 'Please opt in to the VNFT asset before claiming.' });
            return false;
        }
        setClaiming(true);
        try {
            const { data, error } = await supabase.functions.invoke('transfer-vnft', {
                body: JSON.stringify({ wallet_address: accountAddress, asset_id: assetId })
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
            await refreshVerificationState();
            if (!silent) toast({ title: 'VNFT Transferred', description: 'Verification complete.' });
            return true;
        } catch (err) {
            console.error(err);
            if (!silent) toast({ variant: 'destructive', title: 'Transfer Failed', description: err.message || 'Please try again.' });
            throw err;
        } finally {
            setClaiming(false);
        }
    };


    useEffect(() => {
        if (status !== 'verified' || automationError || automationRef.current.running || automationRef.current.completed) return;

        let cancelled = false;
        const finalizeAutomatically = async () => {
            automationRef.current.running = true;
            setAutomationError(null);
            try {
                if (!accountAddress) {
                    if (!automationRef.current.attemptedConnect) {
                        automationRef.current.attemptedConnect = true;
                        await handleConnect();
                    }
                    return;
                }

                const existingAssetId = await getVnftAssetId(accountAddress);
                if (cancelled) return;
                if (existingAssetId) {
                    setNftAssetId(existingAssetId);
                    setOptedIn(true);
                    if (user?.id) localStorage.setItem(`vnft_asset_id_${user.id}`, String(existingAssetId));
                    setStatus('minted');
                    setHasVerificationNft(true);
                    automationRef.current.completed = true;
                    await refreshVerificationState();
                    return;
                }

                const assetId = await handleMintVnft({ silent: true });
                if (cancelled || !assetId) return;
                await handleOptInVnft(assetId, { silent: true });
                if (cancelled) return;
                await handleClaimVnft(assetId, { silent: true });
                if (cancelled) return;
                automationRef.current.completed = true;
                toast({ title: 'Verification Complete', description: 'Your on-chain verification NFT is ready.' });
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setAutomationError(err?.message || 'Automatic VNFT finalization failed.');
                }
            } finally {
                automationRef.current.running = false;
            }
        };

        finalizeAutomatically();
        return () => {
            cancelled = true;
        };
    }, [accountAddress, automationError, handleConnect, handleMintVnft, handleOptInVnft, handleClaimVnft, refreshVerificationState, setHasVerificationNft, status, toast, user]);

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
                        <Loader2 className="h-16 w-16 text-green-500 animate-spin" />
                        <CardTitle className="mt-6">Finalizing Verification</CardTitle>
                        <CardDescription>
                            Your identity is confirmed. We’ll automatically mint, opt in, and check your verification NFT now.
                            {accountAddress ? ' Please approve the wallet prompts when they appear.' : ' Connect your Algorand wallet to continue.'}
                        </CardDescription>
                        {nftAssetId && (
                            <p className="text-xs text-muted-foreground mt-2">Asset ID: {nftAssetId}</p>
                        )}
                        {automationError && (
                            <div className="mt-6 space-y-3">
                                <p className="text-sm text-destructive">{automationError}</p>
                                <Button onClick={() => {
                                    automationRef.current = { running: false, attemptedConnect: !!accountAddress, completed: false };
                                    setAutomationError(null);
                                    setStatus('verified');
                                }}>
                                    Retry automatic finalization
                                </Button>
                            </div>
                        )}
                    </>
                );
            case 'kyc_failed':
                return (
                    <>
                        <AlertTriangle className="h-16 w-16 text-yellow-500" />
                        <CardTitle className="mt-6">KYC Could Not Be Confirmed</CardTitle>
                        <CardDescription>
                            We couldn’t confirm your identity verification. If you already hold a verification NFT, you can check your wallet manually.
                        </CardDescription>
                        <div className="flex flex-col gap-3 mt-6">
                            <Button onClick={handleCheckWallet} disabled={checkingWallet} variant="outline">
                                {checkingWallet ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                I already have a VNFT — check wallet
                            </Button>
                            <Button onClick={() => navigate('/verification')} variant="secondary">Try KYC Again</Button>
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
                                <>
                                    Asset ID:{' '}
                                    <a
                                        href={`https://${NETWORK === 'testnet' ? 'testnet.' : ''}explorer.perawallet.app/asset/${nftAssetId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                    >
                                        {nftAssetId}
                                    </a>.{' '}
                                </>
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

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto" />
                    <p className="text-muted-foreground">Checking verification session…</p>
                </div>
            </div>
        );
    }

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
