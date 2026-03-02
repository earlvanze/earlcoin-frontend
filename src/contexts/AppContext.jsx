import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { PeraWalletConnect } from '@perawallet/connect';
import { connectWallet, disconnectWallet, reconnectWallet, resetWalletConnectStorage, signTransactions as wcSignTransactions } from '@/lib/walletconnectV2';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { EARL_ASA_ID } from '@/lib/config';
import { hasAsset, hasVnft } from '@/lib/algorand';

const AppContext = createContext();

const peraWallet = new PeraWalletConnect({ chainId: 416002 }); // Algorand Testnet

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
    const [notifications, setNotifications] = useState([
        { id: 1, title: 'Proposal #12 Passed', description: 'The proposal to increase liquidity rewards has been approved.', read: false },
        { id: 2, title: 'New Lofty.ai Deal', description: 'A new property in Miami, FL is available for investment.', read: false },
        { id: 3, title: 'Vote Reminder', description: 'Voting for Proposal #14 ends in 24 hours.', read: true },
    ]);

    useEffect(() => {
        reconnectWallet().then((accounts) => {
            if (accounts.length) {
                setIsConnected(true);
                setAccountAddress(accounts[0]);
                setWalletType('wc');
                return;
            }
            return peraWallet.reconnectSession().then((peraAccounts) => {
                if (peraAccounts.length) {
                    setIsConnected(true);
                    setAccountAddress(peraAccounts[0]);
                    setWalletType('pera');
                }
            });
        }).catch(console.error);

        return () => {
            disconnectWallet().catch(console.error);
            peraWallet.disconnect().catch(console.error);
        }
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
            setHasVerificationNft(vnft);
            setHasEarlCoin(earl);
        };
        checkAssets().catch(console.error);
    }, [accountAddress]);

    useEffect(() => {
        const checkKycStatus = async () => {
            if (user) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('kyc_verified')
                    .eq('id', user.id)
                    .single();
                
                if (error) console.error('Error fetching KYC status in context:', error);
                else if (data) {
                    setKycVerified(data.kyc_verified);
                }
            } else {
                setKycVerified(false);
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
            }
          ).subscribe();

          return () => {
            supabase.removeChannel(channel);
          }

    }, [user]);

    const handleConnect = async () => {
        try {
            const newAccounts = await peraWallet.connect();
            if (!newAccounts?.length) throw new Error('No accounts returned');
            setIsConnected(true);
            setAccountAddress(newAccounts[0]);
            setWalletType('pera');
            toast({
                title: "Wallet Connected",
                description: "Connected via Pera Wallet.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Connection Failed",
                description: error?.message || "Could not connect via Pera Wallet. Please try again.",
            });
        }
    };

    const handleConnectWC = async () => {
        try {
            const newAccounts = await connectWallet();
            if (!newAccounts?.length) throw new Error('No accounts returned');
            setIsConnected(true);
            setAccountAddress(newAccounts[0]);
            setWalletType('wc');
            toast({
                title: "Wallet Connected",
                description: "Connected via WalletConnect.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Connection Failed",
                description: error?.message || "Could not connect via WalletConnect. Please try again.",
            });
        }
    };

    const handleDisconnect = async () => {
        if (walletType === 'pera') {
            await peraWallet.disconnect();
        } else {
            await disconnectWallet();
        }
        setIsConnected(false);
        setAccountAddress(null);
        setWalletType(null);
        setHasVerificationNft(false);
        setHasEarlCoin(false);
        toast({
            title: "Wallet Disconnected",
            description: "Your wallet has been disconnected.",
        });
    };

    const resetWalletSession = async () => {
        resetWalletConnectStorage();
        try { await peraWallet.disconnect(); } catch {}
        setIsConnected(false);
        setAccountAddress(null);
        setWalletType(null);
        setHasVerificationNft(false);
        setHasEarlCoin(false);
        toast({
            title: "Wallet Session Reset",
            description: "Cleared local wallet session. Try connecting again.",
        });
    };

    const signTransactions = async (txnGroups = []) => {
        if (walletType === 'pera') {
            return peraWallet.signTransaction(txnGroups);
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