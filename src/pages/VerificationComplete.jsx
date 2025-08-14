import React, { useEffect, useState, useRef } from 'react';
    import { motion } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import { useToast } from '@/components/ui/use-toast';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useAppContext } from '@/contexts/AppContext';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { CheckCircle, Loader2, AlertTriangle, Gift, FlaskConical } from 'lucide-react';
    import PageTitle from '@/components/PageTitle';
    import algosdk from 'algosdk';

    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

    const VerificationComplete = () => {
        const { toast } = useToast();
        const { user } = useAuth();
        const { accountAddress, handleConnect, peraWallet, setHasVerificationNft } = useAppContext();
        const [status, setStatus] = useState('verifying');
        const [minting, setMinting] = useState(false);
        const [nftAssetId, setNftAssetId] = useState(null);
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

        const handleMintNFT = async () => {
            if (!accountAddress) {
                toast({ variant: 'destructive', title: 'Wallet Not Connected', description: 'Please connect your Pera Wallet to mint the NFT.' });
                handleConnect();
                return;
            }
            setMinting(true);
            try {
                const params = await algodClient.getTransactionParams().do();
                
                const defaultFrozen = false;
                const unitName = 'VNFT';
                const assetName = `EarlCoin Verification #${user.id.substring(0, 6)}`;
                const url = 'https://earlcoin.com/nft/verified';
                
                const assetCreateTxn = algosdk.makeAssetCreateTxnWithSuggestedParams(
                    accountAddress,
                    undefined,
                    1,
                    0,
                    defaultFrozen,
                    accountAddress,
                    accountAddress,
                    accountAddress,
                    accountAddress,
                    unitName,
                    assetName,
                    url,
                    undefined,
                    params
                );

                const txnsToSign = [{ txn: assetCreateTxn, signers: [accountAddress] }];
                
                toast({ title: 'Please Sign Transaction', description: 'Confirm the NFT creation in your Pera Wallet.' });

                const signedTxn = await peraWallet.signTransaction([txnsToSign]);
                const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
                
                const result = await algosdk.waitForConfirmation(algodClient, txId, 4);
                const assetId = result['asset-index'];
                
                setNftAssetId(assetId);
                setStatus('minted');
                setHasVerificationNft(true);

                toast({ title: 'NFT Minted!', description: `Asset ID: ${assetId}. You are now a verified member!` });

            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'NFT Minting Failed', description: 'There was an error minting your verification NFT. Please try again.' });
            } finally {
                setMinting(false);
            }
        };

        const handleSkipMinting = () => {
            setHasVerificationNft(true);
            toast({
                title: "NFT Step Skipped!",
                description: "Proceeding with full access for testing.",
            });
            navigate('/trade');
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
                            <CardDescription>Your identity has been confirmed. Mint your on-chain verification NFT to complete the process.</CardDescription>
                            <div className="flex flex-col space-y-2 w-full max-w-xs mt-6">
                                <Button onClick={handleMintNFT} disabled={minting} className="bg-gradient-to-r from-green-500 to-teal-500">
                                    {minting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                                    Mint Verification NFT
                                </Button>
                                <Button onClick={handleSkipMinting} variant="outline">
                                    <FlaskConical className="mr-2 h-4 w-4" />
                                    Skip Minting (Dev Mode)
                                </Button>
                            </div>
                        </>
                    );
                case 'minted':
                     return (
                        <>
                            <Gift className="h-16 w-16 text-primary" />
                            <CardTitle className="mt-6">NFT Minted Successfully!</CardTitle>
                            <CardDescription>Asset ID: <a href={`https://testnet.explorer.perawallet.app/asset/${nftAssetId}`} target="_blank" rel="noopener noreferrer" className="underline">{nftAssetId}</a>. Welcome to the DAO!</CardDescription>
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