import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { consumeAuthRedirect } = useAuth();

  useEffect(() => {
    const finishAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error') || hashParams.get('error');
        const errorDescription = url.searchParams.get('error_description') || hashParams.get('error_description');

        if (error) {
          navigate(`/login?auth_error=${encodeURIComponent(errorDescription || error)}`, { replace: true });
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('OAuth callback exchange failed:', exchangeError);
            navigate(`/login?auth_error=${encodeURIComponent(exchangeError.message || 'oauth_exchange_failed')}`, { replace: true });
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login?auth_error=no_session_after_callback', { replace: true });
          return;
        }

        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('error');
        url.searchParams.delete('error_description');
        window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));

        navigate(consumeAuthRedirect(), { replace: true });
      } catch (err) {
        console.error('Auth callback fatal error:', err);
        navigate('/login?auth_error=unexpected_callback_error', { replace: true });
      }
    };

    finishAuth();
  }, [consumeAuthRedirect, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
