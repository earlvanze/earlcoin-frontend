
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
    import Login from '@/pages/Login';
    import Signup from '@/pages/Signup';
    import Profile from '@/pages/Profile';
    import Settings from '@/pages/Settings';
    import Membership from '@/pages/Membership';
    import { AppProvider } from '@/contexts/AppContext';
    import { AuthProvider } from '@/contexts/SupabaseAuthContext';

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
                  <Route path="/proposals/new" element={<CreateProposal />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/trade" element={<Trade />} />
                  <Route path="/delegate" element={<Delegate />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/verification" element={<Verification />} />
                  <Route path="/verification-complete" element={<VerificationComplete />} />
                  <Route path="/lofty-deals" element={<LoftyDeals />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/membership" element={<Membership />} />
                </Routes>
              </AnimatePresence>
            </Layout>
          </AppProvider>
        </AuthProvider>
      );
    }

    export default App;
