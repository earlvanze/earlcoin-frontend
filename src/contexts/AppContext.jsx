import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { connectWallet, disconnectWallet, reconnectWallet, resetWalletConnectStorage, signTransactions as wcSignTransactions } from '@/lib/walletconnectV2';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { EARL_ASA_ID } from '@/lib/config';
import { hasAsset, hasVnft } from '@/lib/algorand';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [verificationStatus, setVerificationStatus] = useState('Unverified');
    const [isConnected, setIsConnected] = useState(false);
    const [accountAddress, setAccountAddress] = useState(null);
    const [walletType, setWalletType] = useState(null); // 'wc' | 'pera'
    const [hasVerificationNft, setHasVerificationNft] = useState(false);
    const [hasEarlCoin, setHasEarlCoin] = useState(false);
    const [kycVerified, setKycVerified] = useState(false);
    const [profileVnftWallet, setProfileVnftWallet] = useState(null);
    const [notifications, setNotifications] = useState([
        { id: 1, title: 'Proposal #12 Passed', description: 'The proposal to increase liquidity rewards has been approved.', read: false },
        { id: 2, title: 'New Lofty.ai Deal', description: 'A new property in Miami, FL is available for investment.', read: false },
        { id: 3, title: 'Vote Reminder', description: 'Voting for Proposal #14 ends in 24 hours.', read: true },
    ]);

    const peraWalletRef = useRef(null);
    const peraConnectPromiseRef = useRef(null);
    const wcConnectPromiseRef = useRef(null);

    const getPeraWallet = async () => {
        if (!peraWalletRef.current) {
            const { PeraWalletConnect } = await import('@perawallet/connect');
            peraWalletRef.current = new PeraWalletConnect({ chainId: 416002 }); // Algorand Testnet
        }
        return peraWalletRef.current;
    };

    useEffect(() => {
        const attemptReconnect = async () => {
            try {
                const tryReconnectPera = async () => {
                    if (!localStorage.getItem('pera-wallet-connect-session')) return false;
                    const peraWallet = await getPeraWallet();
                    const peraAccounts = await peraWallet.reconnectSession();
                    if (peraAccounts.length) {
                        setIsConnected(true);
                        setAccountAddress(peraAccounts[0]);
                        setWalletType('pera');
                        return true;
                    }
                    return false;
                };

                const tryReconnectWC = async () => {
                    const accounts = await reconnectWallet();
                    if (accounts.length) {
                        setIsConnected(true);
                        setAccountAddress(accounts[0]);
                        setWalletType('wc');
                        return true;
                    }
                    return false;
                };

                const preferred = localStorage.getItem('preferred_wallet_type');
                if (preferred === 'pera') {
                    if (await tryReconnectPera()) return;
                    if (await tryReconnectWC()) return;
                } else if (preferred === 'wc') {
                    if (await tryReconnectWC()) return;
                    if (await tryReconnectPera()) return;
                } else {
                    if (await tryReconnectPera()) return;
                    if (await tryReconnectWC()) return;
                }
            } catch (err) {
                console.error('Reconnect error:', err);
            }
        };

        attemptReconnect();

        return () => {
            disconnectWallet().catch(console.error);
            if (peraWalletRef.current) {
                peraWalletRef.current.disconnect().catch(console.error);
            }
        };
    }, []);

    useEffect(() => {
        const checkAssets = async () => {
            if (!accountAddress) {
                setHasVerificationNft(false);
                setHasEarlCoin(false);
                return;
            }
            const [vnft, earl] = await Promise.all([
                hasVnft(accountAddress),
                hasAsset(accountAddress, EARL_ASA_ID)
            ]);
            const profileMatch = profileVnftWallet && profileVnftWallet === accountAddress;
            const verifiedByProfile = kycVerified && profileMatch;
            setHasVerificationNft(vnft || verifiedByProfile);
            setHasEarlCoin(earl);
        };
        checkAssets().catch(console.error);
    }, [accountAddress, profileVnftWallet, kycVerified]);

    useEffect(() => {
        const checkKycStatus = async () => {
            if (user) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('kyc_verified, vnft_wallet')
                    .eq('id', user.id)
                    .single();
                
                if (error) console.error('Error fetching KYC status in context:', error);
                else if (data) {
                    setKycVerified(data.kyc_verified);
                    setProfileVnftWallet(data.vnft_wallet || null);
                }
            } else {
                setKycVerified(false);
                setProfileVnftWallet(null);
            }
        };
        checkKycStatus();
        
        const channel = supabase.channel('profiles-changes').on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user?.id}` },
            (payload) => {
              if(payload.new.kyc_verified !== undefined) {
                  setKycVerified(payload.new.kyc_verified);
              }
              if (payload.new.vnft_wallet !== undefined) {
                  setProfileVnftWallet(payload.new.vnft_wallet || null);
              }
            }
          ).subscribe();

          return () => {
            supabase.removeChannel(channel);
          }

    }, [user]);

    const normalizeAddress = (addr) => (typeof addr === 'string' ? addr.trim() : null);

    const shortAddress = (addr) => {
        if (!addr || typeof addr !== 'string') return 'unknown';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const extractRequiredSender = (txnGroups = []) => {
        for (const group of txnGroups) {
            for (const txnObj of group || []) {
                const signer = normalizeAddress(txnObj?.signers?.[0]);
                if (signer) return signer;
            }
        }
        return null;
    };

    const handleConnect = async () => {
        if (peraConnectPromiseRef.current) return peraConnectPromiseRef.current;

        peraConnectPromiseRef.current = (async () => {
            try {
                const peraWallet = await getPeraWallet();
                const newAccounts = await peraWallet.connect();
                if (!newAccounts?.length) throw new Error('No accounts returned');
                setIsConnected(true);
                setAccountAddress(newAccounts[0]);
                setWalletType('pera');
                try { localStorage.setItem('preferred_wallet_type', 'pera'); } catch {}
                toast({
                    title: "Wallet Connected",
                    description: "Connected via Pera Wallet.",
                });
                return newAccounts[0];
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Connection Failed",
                    description: error?.message || "Could not connect via Pera Wallet. Please try again.",
                });
                return null;
            } finally {
                peraConnectPromiseRef.current = null;
            }
        })();

        return peraConnectPromiseRef.current;
    };

    const handleConnectWC = async () => {
        if (wcConnectPromiseRef.current) return wcConnectPromiseRef.current;

        wcConnectPromiseRef.current = (async () => {
            try {
                const newAccounts = await connectWallet();
                if (!newAccounts?.length) throw new Error('No accounts returned');
                setIsConnected(true);
                setAccountAddress(newAccounts[0]);
                setWalletType('wc');
                try { localStorage.setItem('preferred_wallet_type', 'wc'); } catch {}
                toast({
                    title: "Wallet Connected",
                    description: "Connected via WalletConnect.",
                });
                return newAccounts[0];
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Connection Failed",
                    description: error?.message || "Could not connect via WalletConnect. Please try again.",
                });
                return null;
            } finally {
                wcConnectPromiseRef.current = null;
            }
        })();

        return wcConnectPromiseRef.current;
    };

    const handleDisconnect = async () => {
        if (walletType === 'pera') {
            const peraWallet = await getPeraWallet();
            await peraWallet.disconnect();
        } else {
            await disconnectWallet();
        }
        setIsConnected(false);
        setAccountAddress(null);
        setWalletType(null);
        setHasVerificationNft(false);
        setHasEarlCoin(false);
        setProfileVnftWallet(null);
        try { localStorage.removeItem('preferred_wallet_type'); } catch {}
        toast({
            title: "Wallet Disconnected",
            description: "Your wallet has been disconnected.",
        });
    };

    const resetWalletSession = async () => {
        resetWalletConnectStorage();
        try {
            const peraWallet = await getPeraWallet();
            await peraWallet.disconnect();
        } catch {}
        setIsConnected(false);
        setAccountAddress(null);
        setWalletType(null);
        setHasVerificationNft(false);
        setHasEarlCoin(false);
        setProfileVnftWallet(null);
        try { localStorage.removeItem('preferred_wallet_type'); } catch {}
        toast({
            title: "Wallet Session Reset",
            description: "Cleared local wallet session. Try connecting again.",
        });
    };

    const signTransactions = async (txnGroups = [], options = {}) => {
        const requiredSender = normalizeAddress(options?.requiredSender || extractRequiredSender(txnGroups));

        if (walletType === 'pera') {
            const peraWallet = await getPeraWallet();
            let currentAccounts = [];

            try {
                currentAccounts = await peraWallet.reconnectSession();
            } catch {
                currentAccounts = [];
            }

            const normalizedAccounts = currentAccounts.map(normalizeAddress).filter(Boolean);

            if (requiredSender && normalizedAccounts.length && !normalizedAccounts.includes(requiredSender)) {
                try { await peraWallet.disconnect(); } catch {}
                currentAccounts = await peraWallet.connect();
            } else if (!currentAccounts.length) {
                currentAccounts = await peraWallet.connect();
            }

            const finalAccounts = (currentAccounts || []).map(normalizeAddress).filter(Boolean);
            if (!finalAccounts.length) {
                throw new Error('No Pera account selected.');
            }

            if (requiredSender && !finalAccounts.includes(requiredSender)) {
                const active = finalAccounts[0];
                setIsConnected(true);
                setAccountAddress(active);
                setWalletType('pera');
                try { localStorage.setItem('preferred_wallet_type', 'pera'); } catch {}
                throw new Error(`Connected Pera account ${shortAddress(active)} does not match transaction sender ${shortAddress(requiredSender)}. Switch account and retry.`);
            }

            const active = requiredSender || finalAccounts[0];
            if (active && normalizeAddress(accountAddress) !== active) {
                setIsConnected(true);
                setAccountAddress(active);
                setWalletType('pera');
                try { localStorage.setItem('preferred_wallet_type', 'pera'); } catch {}
            }

            return peraWallet.signTransaction(txnGroups);
        }

        if (requiredSender && normalizeAddress(accountAddress) && normalizeAddress(accountAddress) !== requiredSender) {
            throw new Error(`Connected wallet ${shortAddress(accountAddress)} does not match transaction sender ${shortAddress(requiredSender)}.`);
        }

        return wcSignTransactions(txnGroups);
    };

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

    const value = {
        verificationStatus,
        startVerification,
        hasVerificationNft,
        hasEarlCoin,
        setHasVerificationNft,
        kycVerified,
        notifications,
        isConnected,
        accountAddress,
        walletType,
        handleConnect,
        handleConnectWC,
        handleDisconnect,
        resetWalletSession,
        signTransactions,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};