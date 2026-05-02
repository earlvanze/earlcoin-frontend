import React, { useState } from 'react';
    import { NavLink, useNavigate } from 'react-router-dom';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { LayoutDashboard, FileText, Briefcase, Repeat, LogIn, LogOut, ChevronsRight, HeartHandshake as Handshake, ShieldCheck, Bot, MoreHorizontal } from 'lucide-react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';

    const navItems = [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/proposals', icon: FileText, label: 'Proposals' },
      { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
      { to: '/trade', icon: Repeat, label: 'Trade' },
      { to: '/delegate', icon: Handshake, label: 'Delegate' },
      { to: '/lofty-deals', icon: Bot, label: 'Lofty Deals' },
      { to: '/verification', icon: ShieldCheck, label: 'Verification' },
    ];

    const Sidebar = () => {
      const { session, signOut } = useAuth();
      const [isExpanded, setIsExpanded] = useState(true);
      const [isMoreOpen, setIsMoreOpen] = useState(false);
      const navigate = useNavigate();
      const primaryMobileItems = navItems.slice(0, 4);
      const overflowMobileItems = navItems.slice(4);

      const handleLogin = () => navigate('/login');

      return (
        <>
          <aside className={`hidden md:flex flex-col ${isExpanded ? 'w-64' : 'w-20'} bg-card/40 backdrop-blur-lg border-r border-border/20 p-4 transition-all duration-300 ease-in-out shrink-0`}>
            <div className="flex items-center justify-between mb-10">
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2"
                  >
                    <img  alt="EarlCoin Logo" class="h-8 w-8" src="https://images.unsplash.com/photo-1589779137147-3d388746b765" />
                    <span className="text-xl font-bold text-white">EarlCoin DAO</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="text-muted-foreground hover:text-foreground">
                <ChevronsRight className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
              </Button>
            </div>
            <nav className="flex-1 flex flex-col gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-4 p-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/20 text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    } ${!isExpanded ? 'justify-center' : ''}`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="font-medium whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto">
              <Button onClick={session ? signOut : handleLogin} className={`w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold ${!isExpanded ? 'p-0 justify-center' : 'justify-start'}`}>
                {session ? <LogOut className={`h-5 w-5 ${isExpanded ? 'mr-4' : ''}`} /> : <LogIn className={`h-5 w-5 ${isExpanded ? 'mr-4' : ''}`} />}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="whitespace-nowrap"
                    >
                      {session ? 'Logout' : 'Login'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </aside>
          
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-lg border-t border-border/20 z-50 pb-[env(safe-area-inset-bottom)]">
            <div className="grid grid-cols-5">
              {primaryMobileItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex min-w-0 flex-col items-center px-1 py-2 transition-colors ${
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  <item.icon className="h-6 w-6 mb-1 shrink-0" />
                  <span className="max-w-full truncate text-[10px] leading-tight">{item.label}</span>
                </NavLink>
              ))}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMoreOpen((open) => !open)}
                  className={`flex h-full w-full min-w-0 flex-col items-center px-1 py-2 transition-colors ${
                    isMoreOpen
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-expanded={isMoreOpen}
                  aria-label="More navigation items"
                >
                  <MoreHorizontal className="h-6 w-6 mb-1 shrink-0" />
                  <span className="max-w-full truncate text-[10px] leading-tight">More</span>
                </button>

                <AnimatePresence>
                  {isMoreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.18 }}
                      className="absolute bottom-full right-2 mb-2 w-48 overflow-hidden rounded-xl border border-border/30 bg-card/95 p-2 shadow-2xl backdrop-blur-lg"
                    >
                      {overflowMobileItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMoreOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? 'bg-primary/20 text-primary'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                            }`
                          }
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </nav>
        </>
      );
    };

    export default Sidebar;