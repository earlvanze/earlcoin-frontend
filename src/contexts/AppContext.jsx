import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { PeraWalletConnect } from '@perawallet/connect';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const AppContext = createContext();

const peraWallet = new PeraWalletConnect();

export const AppProvider = ({ children }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [verificationStatus, setVerificationStatus] = useState('Unverified');
    const [isConnected, setIsConnected] = useState(false);
    const [accountAddress, setAccountAddress] = useState(null);
    const [hasVerificationNft, setHasVerificationNft] = useState(false);
    const [kycVerified, setKycVerified] = useState(false);
    const [notifications, setNotifications] = useState([
        { id: 1, title: 'Proposal #12 Passed', description: 'The proposal to increase liquidity rewards has been approved.', read: false },
        { id: 2, title: 'New Lofty.ai Deal', description: 'A new property in Miami, FL is available for investment.', read: false },
        { id: 3, title: 'Vote Reminder', description: 'Voting for Proposal #14 ends in 24 hours.', read: true },
    ]);

    useEffect(() => {
        peraWallet.reconnectSession().then((accounts) => {
            if (accounts.length) {
                setIsConnected(true);
                setAccountAddress(accounts[0]);
            }
        }).catch(console.error);

        return () => {
            peraWallet.disconnect().catch(console.error);
        }
    }, []);

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
            setIsConnected(true);
            setAccountAddress(newAccounts[0]);
            toast({
                title: "Wallet Connected",
                description: "Your Pera Wallet has been successfully connected.",
            });
        } catch (error) {
            if (error?.data?.type !== "CONNECT_MODAL_CLOSED") {
                toast({
                    variant: "destructive",
                    title: "Connection Failed",
                    description: "Could not connect to Pera Wallet. Please try again.",
                });
            }
        }
    };

    const handleDisconnect = async () => {
        await peraWallet.disconnect();
        setIsConnected(false);
        setAccountAddress(null);
        setHasVerificationNft(false);
        toast({
            title: "Wallet Disconnected",
            description: "Your Pera Wallet has been disconnected.",
        });
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
        setHasVerificationNft,
        kycVerified,
        notifications,
        isConnected,
        accountAddress,
        handleConnect,
        handleDisconnect,
        peraWallet,
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