import React, { useState } from 'react';
import { Loader2, Wallet, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    <path d="M1 1h22v22H1z" fill="none" />
  </svg>
);

const DiscordIcon = () => (
  <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4464.8257-.618 1.2243a18.1162 18.1162 0 00-5.4852 0c-.1716-.3986-.407-.8491-.618-1.2243a.0741.0741 0 00-.0785-.0371A19.7913 19.7913 0 003.683 4.3698a.0741.0741 0 00-.0596.099c.1423.4379.2936.8758.4641 1.3137-.6664.959-.9997 1.6653-1.1613 2.2725a.0741.0741 0 00.0268.0844c1.33.8889 2.6382 1.4355 4.0103 1.7585a.0741.0741 0 00.0882-.043c.1423-.3665.2654-.733.3885-1.0995a.0741.0741 0 00-.043-.0844c-.6856-.2482-1.3617-.5682-1.9985-.9875a.0741.0741 0 01-.0172-.1089c.0371-.0563.0882-.1125.1393-.1688a13.7814 13.7814 0 012.94.9875.0741.0741 0 00.0785-.0094c.9118-.457 1.8952-.8491 2.822-.1125a.0741.0741 0 00.0785.0094c.9212.7375 1.9047 1.1295 2.822 1.125a.0741.0741 0 00.0785-.0094c.0511-.0281.1022-.0563.1487-.0938a.0741.0741 0 01-.0172.1089c-.6368.4193-1.3129.7393-1.9985.9875a.0741.0741 0 00-.043.0844c.1231.3665.2462.733.3885 1.0995a.0741.0741 0 00.0882.043c1.3721-.323 2.6803-.8696 4.0103-1.7585a.0741.0741 0 00.0268-.0844c-.1616-.6072-.4949-1.3137-1.1613-2.2725.1705-.4379.3218-.8758.4641-1.3137a.0741.0741 0 00-.0596-.099zM8.02 15.3312c-.9997 0-1.8191-.8194-1.8191-1.8191s.8194-1.8191 1.8191-1.8191 1.8191.8194 1.8191 1.8191-.8194 1.8191-1.8191 1.8191zm7.9748 0c-.9997 0-1.8191-.8194-1.8191-1.8191s.8194-1.8191 1.8191-1.8191 1.8191.8194 1.8191 1.8191-.8194 1.8191-1.8191 1.8191z" />
  </svg>
);

const SocialLogins = ({ type = 'login' }) => {
  const { signInWithOAuth, signInWithWeb3, consumeAuthRedirect } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(null);

  const redirectPath = (() => {
    const params = new URLSearchParams(location.search || '');
    const requested = params.get('redirect');
    if (requested && requested.startsWith('/') && !requested.startsWith('//')) return requested;
    const current = `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
    if (current === '/login' || current === '/signup') return '/';
    return current;
  })();

  const handleOAuthLogin = async (provider) => {
    setPending(provider);
    try {
      const { error } = await signInWithOAuth(provider, redirectPath);
      if (!error) {
        toast({
          title: 'Redirecting…',
          description: `Continue ${type} with ${provider}.`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'OAuth Login Failed',
        description: error.message || 'Unable to start OAuth sign-in.',
      });
    } finally {
      setPending(null);
    }
  };

  const handleWeb3Login = async (chain) => {
    setPending(chain);
    try {
      const { error } = await signInWithWeb3(chain, undefined, redirectPath);
      if (error) return;

      const storedRedirect = consumeAuthRedirect();
      const target = redirectPath || storedRedirect || '/';
      toast({
        title: 'Wallet connected',
        description: `Signed in with your ${chain === 'ethereum' ? 'Ethereum' : 'Solana'} wallet.`,
      });
      navigate(target, { replace: true });
    } finally {
      setPending(null);
    }
  };

  const isBusy = (name) => pending === name;

  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" type="button" onClick={() => handleOAuthLogin('google')} disabled={pending !== null}>
          {isBusy('google') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Google
        </Button>
        <Button variant="outline" type="button" onClick={() => handleOAuthLogin('discord')} disabled={pending !== null}>
          {isBusy('discord') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DiscordIcon />}
          Discord
        </Button>
        <Button variant="outline" type="button" onClick={() => handleWeb3Login('ethereum')} disabled={pending !== null}>
          {isBusy('ethereum') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
          Ethereum
        </Button>
        <Button variant="outline" type="button" onClick={() => handleWeb3Login('solana')} disabled={pending !== null}>
          {isBusy('solana') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}
          Solana
        </Button>
      </div>
      <p className="mt-3 text-xs text-center text-muted-foreground">
        Wallet sign-in uses Supabase web3 auth with an injected browser wallet. If a wallet button fails, install or unlock the matching wallet extension first.
      </p>
    </>
  );
};

export default SocialLogins;
