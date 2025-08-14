import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { loadStripe } from '@stripe/stripe-js';
    import { Elements } from '@stripe/react-stripe-js';
    import PageTitle from '@/components/PageTitle';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { useToast } from '@/components/ui/use-toast';
    import { Gem, CheckCircle, Loader2, PartyPopper } from 'lucide-react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useSearchParams } from 'react-router-dom';

    const stripePromise = loadStripe('pk_live_51RmvAnB1j8uA46lA73UjlFW3ykqG1Y6MPNTww6qfNKSnCbB99pnitadSMLjnhbJH6YdLNmORL8e0waarsuE6Y6Ev00jKURgb6y');

    const Membership = () => {
        const { toast } = useToast();
        const { user } = useAuth();
        const [loading, setLoading] = useState(false);
        const [hasMembership, setHasMembership] = useState(false);
        const [searchParams, setSearchParams] = useSearchParams();

        useEffect(() => {
            const status = searchParams.get('status');
            if (status === 'success') {
                toast({ title: "Payment Successful!", description: "Welcome! You are now a full member of the DAO." });
                setHasMembership(true); // Optimistic update
                searchParams.delete('status');
                setSearchParams(searchParams);
            } else if (status === 'cancelled') {
                toast({ variant: 'destructive', title: "Payment Cancelled", description: "Your membership purchase was cancelled. You can try again anytime." });
                searchParams.delete('status');
                setSearchParams(searchParams);
            }
        }, [searchParams, setSearchParams, toast]);
        
        useEffect(() => {
            const checkMembershipStatus = async () => {
                if (user) {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('has_membership')
                        .eq('id', user.id)
                        .single();
                    if (data) setHasMembership(data.has_membership);
                }
            };
            checkMembershipStatus();
        }, [user]);

        const handleCheckout = async () => {
            if (!user) {
                toast({ variant: 'destructive', title: 'Not logged in', description: 'Please log in to purchase a membership.' });
                return;
            }
            setLoading(true);
            try {
                const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                    body: JSON.stringify({ user_id: user.id }),
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
                toast({ variant: 'destructive', title: "Checkout Error", description: error.message });
            } finally {
                setLoading(false);
            }
        };

        if (hasMembership) {
            return (
                 <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="container mx-auto flex flex-col items-center justify-center text-center"
                >
                    <PartyPopper className="h-24 w-24 text-primary animate-bounce" />
                    <h1 className="text-4xl font-bold mt-6">Welcome, Member!</h1>
                    <p className="text-muted-foreground mt-2">You have full access to the DAO. Let's build the future together.</p>
                </motion.div>
            )
        }

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="container mx-auto"
            >
                <PageTitle title="DAO Membership" description="Unlock full access to the EarlCoin DAO." />
                <div className="flex justify-center">
                    <Card className="w-full max-w-md">
                        <CardHeader className="text-center">
                            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                                <Gem className="h-10 w-10 text-primary" />
                            </div>
                            <CardTitle>DAO Membership</CardTitle>
                            <CardDescription>One-time payment for lifetime access.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="my-6">
                                <p className="text-4xl font-bold text-center">$10.00 <span className="text-base font-normal text-muted-foreground">USD</span></p>
                            </div>
                            <ul className="space-y-3 text-muted-foreground mb-8">
                                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-2" /> <span>Create & Vote on Proposals</span></li>
                                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-2" /> <span>Access to Exclusive Deals</span></li>
                                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-2" /> <span>Verified Member Role</span></li>
                            </ul>
                            <Elements stripe={stripePromise}>
                                <Button onClick={handleCheckout} className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white" disabled={loading || !user}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Purchase Membership'}
                                </Button>
                            </Elements>
                        </CardContent>
                    </Card>
                </div>
            </motion.div>
        );
    };

    export default Membership;