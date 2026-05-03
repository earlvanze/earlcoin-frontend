import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

const AUTH_REDIRECT_KEY = 'earlcoin.auth.redirect';

const normalizeRedirectPath = (value) => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
};

const storeAuthRedirect = (value) => {
  if (typeof window === 'undefined') return '/';
  const normalized = normalizeRedirectPath(value);
  if (normalized === '/') window.sessionStorage.removeItem(AUTH_REDIRECT_KEY);
  else window.sessionStorage.setItem(AUTH_REDIRECT_KEY, normalized);
  return normalized;
};

const consumeAuthRedirect = () => {
  if (typeof window === 'undefined') return '/';
  const stored = window.sessionStorage.getItem(AUTH_REDIRECT_KEY);
  window.sessionStorage.removeItem(AUTH_REDIRECT_KEY);
  return normalizeRedirectPath(stored || '/');
};

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback(async (nextSession) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setLoading(false);
  }, []);

  const showAuthError = useCallback((title, error) => {
    if (!error) return;
    toast({
      variant: 'destructive',
      title,
      description: error.message || 'Something went wrong',
    });
  }, [toast]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        handleSession(existingSession);
      } catch (err) {
        console.error('Auth bootstrap failed:', err);
        try {
          const { data: { session: existingSession } } = await supabase.auth.getSession();
          handleSession(existingSession);
        } catch {
          handleSession(null);
        }
      }
    };

    bootstrapAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      handleSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signUp = useCallback(async (email, password, options) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        ...options,
      },
    });
    showAuthError('Sign up Failed', error);
    return { error };
  }, [showAuthError]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    showAuthError('Sign in Failed', error);
    return { error };
  }, [showAuthError]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    showAuthError('Sign out Failed', error);
    return { error };
  }, [showAuthError]);

  const signInWithOAuth = useCallback(async (provider, redirectPath = '/') => {
    storeAuthRedirect(redirectPath);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      consumeAuthRedirect();
    }

    showAuthError('OAuth Sign In Failed', error);
    return { error };
  }, [showAuthError]);

  const signInWithWeb3 = useCallback(async (chain, wallet, redirectPath = '/') => {
    if (typeof supabase.auth.signInWithWeb3 !== 'function') {
      const error = new Error('This app build does not support Supabase web3 auth yet.');
      showAuthError('Wallet Sign In Failed', error);
      return { data: null, error };
    }

    const hasEthereumProvider = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
    const hasSolanaProvider = typeof window !== 'undefined' && typeof window.solana !== 'undefined';

    if (chain === 'ethereum' && !hasEthereumProvider) {
      const error = new Error('No Ethereum browser wallet detected. Install or unlock MetaMask, Rabby, or another injected wallet.');
      showAuthError('Wallet Sign In Failed', error);
      return { data: null, error };
    }

    if (chain === 'solana' && !hasSolanaProvider) {
      const error = new Error('No Solana browser wallet detected. Install or unlock Phantom or another injected wallet.');
      showAuthError('Wallet Sign In Failed', error);
      return { data: null, error };
    }

    storeAuthRedirect(redirectPath);

    const statement = 'Sign in to EARLCoin DAO';
    const payload = wallet ? { chain, wallet, statement } : { chain, statement };
    const { data, error } = await supabase.auth.signInWithWeb3(payload);

    if (error) {
      consumeAuthRedirect();
    }

    showAuthError('Wallet Sign In Failed', error);
    return { data, error };
  }, [showAuthError]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    signInWithOAuth,
    signInWithWeb3,
    consumeAuthRedirect,
  }), [user, session, loading, signUp, signIn, signOut, signInWithOAuth, signInWithWeb3]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
