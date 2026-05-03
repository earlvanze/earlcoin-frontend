import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent } from '@/components/ui/card';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useAppContext } from '@/contexts/AppContext';
    import { ShieldCheck, ShieldAlert, Loader2, LogIn, FlaskConical, Gift } from 'lucide-react';
    import { Link, useNavigate } from 'react-router-dom';
    import SocialLogins from '@/components/SocialLogins';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { loadStripe } from '@stripe/stripe-js';
    import { STRIPE_PUBLISHABLE_KEY } from '@/lib/config';

    const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' } } };

    const Verification = () => {
        const { toast } = useToast();
        const { session, loading: authLoading, user } = useAuth();
        const { kycVerified, hasVerificationNft } = useAppContext();
        const [loading, setLoading] = useState(false);
        const navigate = useNavigate();
        const canBypassVerification = import.meta.env.DEV && typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

        const startVerification = async () => {
            if (!user) {
                toast({ variant: 'destructive', title: 'Not Logged In', description: 'Please log in to start verification.' });
                return;
            }
            setLoading(true);
            try {
                if (!stripePromise) {
                    throw new Error('Stripe Identity is not configured for verification yet.');
                }

                const { data, error } = await supabase.functions.invoke('stripe-identity-session', {
                    body: JSON.stringify({ user_id: user.id }),
                });

                if (error || data.error) throw new Error(error?.message || data.error);

                const { client_secret, session_id } = data;
                if (session_id) {
                    localStorage.setItem('stripe_kyc_session_id', session_id);
                }
                const stripe = await stripePromise;
                const result = await stripe.verifyIdentity(client_secret);

                if (result.error) {
                    throw result.error;
                } else {
                    navigate('/verification-complete');
                }

            } catch (error) {
                localStorage.removeItem('stripe_kyc_session_id');
                toast({ variant: 'destructive', title: 'Verification Failed', description: error.message });
            } finally {
                setLoading(false);
            }
        };

        const handleBypassVerification = async () => {
            if (!canBypassVerification) {
                toast({ variant: 'destructive', title: 'Bypass disabled', description: 'Client-side KYC bypass is blocked outside local development.' });
                return;
            }
            if (!user) {
                toast({ variant: 'destructive', title: 'Not Logged In', description: 'Please log in to bypass verification.' });
                return;
            }
            setLoading(true);
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ kyc_verified: true, updated_at: new Date().toISOString() })
                    .eq('id', user.id);

                if (error) throw error;

                toast({
                    title: "Verification Bypassed!",
                    description: "Proceeding to NFT minting for local testing.",
                });
                navigate('/verification-complete');
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Bypass Failed",
                    description: error.message,
                });
            } finally {
                setLoading(false);
            }
        };

        const getStatusContent = () => {
            if (authLoading || loading) {
                 return { icon: <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />, title: "Loading...", description: "Please wait while we check your verification status.", button: <Button disabled>Loading...</Button> };
            }
            if (!session) {
                 return { icon: <LogIn className="h-12 w-12 text-yellow-400" />, title: "Please Log In", description: "Log in with your account to begin the DAO verification process.", button: <div className="w-full max-w-xs"><SocialLogins /><p className="mt-4 text-xs text-center text-muted-foreground">or <Link to="/login" className="underline underline-offset-4 hover:text-primary">login with email</Link></p></div> };
            }
            if (kycVerified && hasVerificationNft) {
                return { 
                    icon: <ShieldCheck className="h-12 w-12 text-green-400" />, 
                    title: "You are Fully Verified!", 
                    description: `Your identity is confirmed and your verification NFT is in your wallet.`, 
                    button: <Button onClick={() => navigate('/trade')}>Start Trading</Button> 
                };
            }
             if (kycVerified && !hasVerificationNft) {
                return { 
                    icon: <Gift className="h-12 w-12 text-purple-400" />, 
                    title: "Mint Your NFT", 
                    description: `You are KYC verified! The final step is to mint your verification NFT to get full trading access.`, 
                    button: <Button onClick={() => navigate('/verification-complete')}>Mint Verification NFT</Button> 
                };
            }
            return { 
                icon: <ShieldAlert className="h-12 w-12 text-red-400" />, 
                title: "Verification Required", 
                description: "To participate in governance and trading, you must complete a one-time KYC/AML check. This ensures our DAO's compliance and security.", 
                button: (
                    <div className="flex flex-col space-y-2 w-full max-w-xs">
                        {STRIPE_PUBLISHABLE_KEY ? (
                            <Button onClick={startVerification} className="bg-gradient-to-r from-purple-600 to-indigo-600" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Start Verification"}</Button>
                        ) : (
                            <div className="text-center space-y-2">
                                <Button disabled className="bg-gradient-to-r from-purple-600 to-indigo-600 opacity-50">Start Verification</Button>
                                <p className="text-xs text-muted-foreground">Identity verification is being configured. Please check back soon or contact support.</p>
                            </div>
                        )}
                        {canBypassVerification ? (
                            <Button onClick={handleBypassVerification} variant="outline" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FlaskConical className="mr-2 h-4 w-4" />}
                                Bypass (Dev Mode)
                            </Button>
                        ) : null}
                    </div>
                )
            };
        }

        const { icon, title, description, button } = getStatusContent();

        return (
            <motion.div initial="hidden" animate="visible" variants={containerVariants}>
              <PageTitle title="DAO Verification" description="Complete your one-time identity verification to secure your membership." />
              <motion.div variants={itemVariants} className="max-w-2xl mx-auto">
                <Card>
                  <CardContent className="p-10 flex flex-col items-center text-center">
                    <div className="mb-6">{icon}</div>
                    <h2 className="text-2xl font-bold mb-2">{title}</h2>
                    <p className="text-muted-foreground mb-8 max-w-md">{description}</p>
                    {button}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
        );
    }

    export default Verification;