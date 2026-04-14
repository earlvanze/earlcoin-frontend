import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { PeraWalletConnect } from '@perawallet/connect';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { getVnftAssetId } from '@/lib/algorand';

const AppContext = createContext();

const peraWallet = new PeraWalletConnect();

export const AppProvider = ({ children }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [verificationStatus, setVerificationStatus] = useState('Unverified');
    const [isConnected, setIsConnected] = useState(false);
    const [accountAddress, setAccountAddress] = useState(null);
    const [walletProvider, setWalletProvider] = useState(null);
    const [hasVerificationNft, setHasVerificationNft] = useState(false);
    const [kycVerified, setKycVerified] = useState(false);
    const [hasMembership, setHasMembership] = useState(false);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        peraWallet.reconnectSession().then((accounts) => {
            if (accounts.length) {
                setIsConnected(true);
                setAccountAddress(accounts[0]);
                setWalletProvider('pera');
            }
        }).catch(console.error);

        return () => {
            peraWallet.disconnect().catch(console.error);
        }
    }, []);

    const refreshVerificationState = useCallback(async () => {
        if (!user) {
            setKycVerified(false);
            setHasVerificationNft(false);
            return { kycVerified: false, hasVerificationNft: false };
        }

        let nextKycVerified = false;
        let nextHasVerificationNft = false;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('kyc_verified')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error fetching KYC status in context:', error);
            } else if (data) {
                nextKycVerified = !!data.kyc_verified;
            }
        } catch (error) {
            console.error('Unexpected KYC refresh failure:', error);
        }

        if (accountAddress) {
            try {
                const assetId = await getVnftAssetId(accountAddress);
                nextHasVerificationNft = !!assetId;
                if (assetId && user?.id) {
                    localStorage.setItem(`vnft_asset_id_${user.id}`, String(assetId));
                }
            } catch (error) {
                console.error('Error checking VNFT status in context:', error);
            }
        }

        // Auto-verify via EARL token ownership if not already KYC verified
        if (!nextKycVerified && accountAddress) {
            try {
                const { data: membershipData } = await supabase.functions.invoke('check-membership', {
                    body: JSON.stringify({ wallet_address: accountAddress }),
                });
                if (membershipData?.has_membership) {
                    nextKycVerified = true;
                }
            } catch (e) {
                // Silently fail — user can still do Stripe KYC manually
            }
        }

        setKycVerified(nextKycVerified);
        setHasVerificationNft(nextHasVerificationNft);
        return { kycVerified: nextKycVerified, hasVerificationNft: nextHasVerificationNft };
    }, [accountAddress, user]);

    const checkMembership = useCallback(async () => {
        if (!user || !accountAddress) {
            setHasMembership(false);
            return false;
        }

        try {
            const { data, error } = await supabase.functions.invoke('check-membership', {
                body: JSON.stringify({ wallet_address: accountAddress }),
            });

            if (error || data?.error) {
                console.error('check-membership error:', error || data?.error);
                return false;
            }

            const isMember = !!data?.has_membership;
            setHasMembership(isMember);
            return isMember;
        } catch (e) {
            console.error('check-membership failed:', e);
            return false;
        }
    }, [user, accountAddress]);

    useEffect(() => {
        refreshVerificationState();
        checkMembership();

        if (!user) {
            return undefined;
        }

        const channel = supabase.channel(`profiles-changes-${user.id}`).on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
            () => {
                refreshVerificationState();
            }
          ).subscribe();

          return () => {
            supabase.removeChannel(channel);
          }

    }, [refreshVerificationState, checkMembership, user]);

    const handleConnect = async () => {
        try {
            const newAccounts = await peraWallet.connect();
            setIsConnected(true);
            setAccountAddress(newAccounts[0]);
            setWalletProvider('pera');
            toast({
                title: "Wallet Connected",
                description: "Algorand wallet connected via WalletConnect.",
            });
            checkMembership();
        } catch (error) {
            if (error?.data?.type !== "CONNECT_MODAL_CLOSED") {
                toast({
                    variant: "destructive",
                    title: "Connection Failed",
                    description: "Could not connect wallet. Make sure you have Pera, Defly, or another WalletConnect-compatible Algorand wallet.",
                });
            }
        }
    };

    const handleDisconnect = async () => {
        await peraWallet.disconnect();
        setIsConnected(false);
        setAccountAddress(null);
        setWalletProvider(null);
        setHasVerificationNft(false);
        setHasMembership(false);
        toast({
            title: "Wallet Disconnected",
            description: "Your Algorand wallet has been disconnected.",
        });
    };

    const signTransactions = useCallback(async (transactionGroups) => {
        if (!accountAddress) {
            throw new Error('Connect an Algorand wallet before signing transactions.');
        }

        return peraWallet.signTransaction(transactionGroups, accountAddress);
    }, [accountAddress]);

    const startVerification = () => {
        setVerificationStatus('Pending');
        toast({
            title: "Verification Started",
            description: "Please follow the steps in the new window to complete KYC/AML.",
        });

        setTimeout(() => {
            setVerificationStatus('Verified');
            toast({
                title: "Verification Complete!",
                description: "You are now a verified DAO member.",
            });
        }, 5000);
    };

    const value = useMemo(() => ({
        verificationStatus,
        startVerification,
        hasVerificationNft,
        setHasVerificationNft,
        kycVerified,
        hasMembership,
        checkMembership,
        notifications,
        isConnected,
        accountAddress,
        walletProvider,
        handleConnect,
        handleDisconnect,
        peraWallet,
        signTransactions,
        refreshVerificationState,
    }), [verificationStatus, hasVerificationNft, kycVerified, hasMembership, notifications, isConnected, accountAddress, walletProvider, signTransactions, refreshVerificationState, checkMembership]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};