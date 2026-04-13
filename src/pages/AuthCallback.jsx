import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { consumeAuthRedirect } = useAuth();

  useEffect(() => {
    // Guard against double-invocation (React StrictMode dev, browser quirks)
    let cancelled = false;
    let exchanged = false;

    const finishAuth = async () => {
      if (exchanged) return;
      exchanged = true;

      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error') || hashParams.get('error');
        const errorDescription = url.searchParams.get('error_description') || hashParams.get('error_description');

        if (error) {
          if (!cancelled) navigate(`/login?auth_error=${encodeURIComponent(errorDescription || error)}`, { replace: true });
          return;
        }

        if (code) {
          // Check if we already have a session (e.g. from a previous exchange or onAuthStateChange)
          const { data: { session: existingSession } } = await supabase.auth.getSession();
          if (existingSession) {
            // Already authenticated — skip code exchange, just redirect
          } else {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              console.error('OAuth callback exchange failed:', exchangeError);
              if (!cancelled) navigate(`/login?auth_error=${encodeURIComponent(exchangeError.message || 'oauth_exchange_failed')}`, { replace: true });
              return;
            }
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) navigate('/login?auth_error=no_session_after_callback', { replace: true });
          return;
        }

        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('error');
        url.searchParams.delete('error_description');
        window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));

        if (!cancelled) navigate(consumeAuthRedirect(), { replace: true });
      } catch (err) {
        console.error('Auth callback fatal error:', err);
        if (!cancelled) navigate('/login?auth_error=unexpected_callback_error', { replace: true });
      }
    };

    finishAuth();

    return () => { cancelled = true; };
  }, []);

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
