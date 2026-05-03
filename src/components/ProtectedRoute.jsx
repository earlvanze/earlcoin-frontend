import React from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const getSafeRedirect = (location) => {
  const target = `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
  if (!target.startsWith('/') || target.startsWith('//')) return '/';
  return target;
};

const AuthLoadingScreen = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto" />
      <p className="text-muted-foreground">Checking session…</p>
    </div>
  </div>
);

export const ProtectedRoute = ({ children }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoadingScreen />;
  if (!session) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(getSafeRedirect(location))}`} replace />;
  }

  return children;
};

export const PublicOnlyRoute = ({ children }) => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search || '');
  const redirect = params.get('redirect');
  const safeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';

  if (loading) return <AuthLoadingScreen />;
  if (session) {
    return <Navigate to={safeRedirect} replace />;
  }

  return children;
};
