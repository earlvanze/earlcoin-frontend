import React, { createContext, useState, useEffect, useContext } from 'react';
    import { useToast } from '@/components/ui/use-toast';
    import { createClient } from '@supabase/supabase-js';

    const AuthContext = createContext();

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    let supabase;
    if (supabaseUrl && supabaseAnonKey) {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    }

    export const AuthProvider = ({ children }) => {
        const { toast } = useToast();
        const [session, setSession] = useState(null);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            if (!supabase) {
                console.warn("Supabase credentials not found. Skipping Supabase initialization.");
                setLoading(false);
                return;
            }

            const getSession = async () => {
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session);
                setLoading(false);
            };

            getSession();

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                setSession(session);
            });

            return () => subscription.unsubscribe();
        }, []);

        const login = async () => {
            if (!supabase) {
                toast({
                    variant: 'destructive',
                    title: "Supabase Not Connected",
                    description: "Please complete the Supabase integration setup first.",
                });
                return;
            }
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
            });
            if (error) {
                toast({
                    variant: 'destructive',
                    title: 'Login Error',
                    description: error.message,
                });
            }
        };

        const logout = async () => {
            if (!supabase) return;
            await supabase.auth.signOut();
            setSession(null);
        };

        const value = {
            session,
            login,
            logout,
            loading,
            user: session?.user ?? null,
        };

        return (
            <AuthContext.Provider value={value}>
                {!loading && children}
            </AuthContext.Provider>
        );
    };

    export const useAuth = () => {
        return useContext(AuthContext);
    };