
import React from 'react';
    import { Routes, Route, useLocation } from 'react-router-dom';
    import { AnimatePresence } from 'framer-motion';
    import Layout from '@/components/Layout';
    import Dashboard from '@/pages/Dashboard';
    import Proposals from '@/pages/Proposals';
    import CreateProposal from '@/pages/CreateProposal';
    import Portfolio from '@/pages/Portfolio';
    import Trade from '@/pages/Trade';
    import Delegate from '@/pages/Delegate';
    import Notifications from '@/pages/Notifications';
    import Verification from '@/pages/Verification';
    import VerificationComplete from '@/pages/VerificationComplete';
    import LoftyDeals from '@/pages/LoftyDeals';
import LoftySwap from '@/pages/LoftySwap';
    import Login from '@/pages/Login';
    import Signup from '@/pages/Signup';
    import Profile from '@/pages/Profile';
    import Settings from '@/pages/Settings';
    import Membership from '@/pages/Membership';
    import AuthCallback from '@/pages/AuthCallback';
    import { AppProvider } from '@/contexts/AppContext';
    import { AuthProvider } from '@/contexts/SupabaseAuthContext';
    import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute';

    function App() {
      const location = useLocation();

      return (
        <AuthProvider>
          <AppProvider>
            <Layout>
              <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                  <Route index element={<Dashboard />} />
                  <Route path="/proposals" element={<Proposals />} />
                  <Route path="/proposals/new" element={<ProtectedRoute><CreateProposal /></ProtectedRoute>} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/trade" element={<Trade />} />
                  <Route path="/delegate" element={<Delegate />} />
                  <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  <Route path="/verification" element={<ProtectedRoute><Verification /></ProtectedRoute>} />
                  <Route path="/verification-complete" element={<ProtectedRoute><VerificationComplete /></ProtectedRoute>} />
                  <Route path="/lofty-deals" element={<LoftyDeals />} />
                  <Route path="/lofty-swap" element={<LoftySwap />} />
                  <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                  <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/membership" element={<ProtectedRoute><Membership /></ProtectedRoute>} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                </Routes>
              </AnimatePresence>
            </Layout>
          </AppProvider>
        </AuthProvider>
      );
    }

    export default App;
// Tue Mar 24 17:02:46 CET 2026
