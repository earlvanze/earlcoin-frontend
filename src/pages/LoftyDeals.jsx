import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TrendingUp, DollarSign, Bot, FilePlus, Loader2, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Target, BarChart3, Sparkles, Activity, PieChart, Percent } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const AlphaCard = ({ deal }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isDraftOpen, setIsDraftOpen] = useState(false);
    
    const alphaPercent = deal.nav_per_token && deal.market_price 
        ? ((deal.nav_per_token - deal.market_price) / deal.market_price * 100).toFixed(1)
        : 0;
    
    const handleCreateProposal = () => {
        const params = new URLSearchParams({
            type: 'alpha',
            property_id: deal.property_id || '',
            address: deal.address || '',
            city: deal.city || '',
            state: deal.state || '',
            token_price: deal.market_price || '',
            nav_per_token: deal.nav_per_token || '',
            alpha_percent: alphaPercent,
            proposal_draft: deal.proposal_draft || '',
        });
        
        navigate(`/proposals/new?${params.toString()}`);
        
        toast({
            title: "Creating Proposal",
            description: `Drafting proposal for ${deal.address}`,
        });
    };

    const loftyUrl = deal.property_id ? `https://www.lofty.ai/property/${deal.property_id}` : null;
    
    const getAlphaColor = (alpha) => {
        if (alpha >= 200) return 'text-green-400';
        if (alpha >= 100) return 'text-emerald-400';
        if (alpha >= 50) return 'text-yellow-400';
        return 'text-orange-400';
    };

    return (
        <motion.div variants={itemVariants}>
            <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30">
                {/* Compact header with image and title */}
                <div className="flex">
                    <div className="w-28 h-28 shrink-0 relative">
                        <img 
                            src={deal.image_url || `https://images.lofty.ai/images/${deal.property_id}/thumb-min.webp`} 
                            alt={deal.address}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&q=80';
                            }}
                        />
                        {deal.proposal_rank && (
                            <span className="absolute top-1 left-1 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                #{deal.proposal_rank}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 p-3 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                                <h3 className="font-semibold text-sm truncate">{deal.address}</h3>
                                <p className="text-xs text-muted-foreground">{deal.city}, {deal.state}</p>
                            </div>
                            {loftyUrl && (
                                <a href={loftyUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            )}
                        </div>
                        
                        {/* Alpha badge */}
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xl font-bold ${getAlphaColor(parseFloat(alphaPercent))}`}>
                                +{alphaPercent}%
                            </span>
                            <span className="text-xs text-muted-foreground">alpha</span>
                        </div>
                        
                        {/* NAV vs Market */}
                        <div className="flex gap-3 mt-1.5 text-xs">
                            <div>
                                <span className="text-muted-foreground">NAV:</span>
                                <span className="ml-1 font-semibold text-green-400">${deal.nav_per_token?.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Market:</span>
                                <span className="ml-1 font-semibold">${deal.market_price?.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        {/* Cap rate if available */}
                        {deal.cap_rate && (
                            <div className="text-xs text-muted-foreground mt-1">
                                Cap: {(deal.cap_rate * 100).toFixed(1)}%
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Upside and action */}
                <div className="flex items-center justify-between px-3 py-2 bg-secondary/20 border-t">
                    <span className="text-sm">
                        <span className="text-muted-foreground">Upside:</span>
                        <span className="ml-1 font-bold text-green-400">+${((deal.nav_per_token || 0) - (deal.market_price || 0)).toFixed(2)}</span>
                    </span>
                    <Button size="sm" onClick={handleCreateProposal} className="h-7 text-xs bg-gradient-to-r from-purple-600 to-indigo-600">
                        <FilePlus className="mr-1 h-3 w-3" /> Proposal
                    </Button>
                </div>
                
                {/* Expandable thesis */}
                {deal.proposal_draft && (
                    <Collapsible open={isDraftOpen} onOpenChange={setIsDraftOpen}>
                        <CollapsibleTrigger asChild>
                            <button className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors flex items-center justify-center gap-1">
                                <span>Investment Thesis</span>
                                {isDraftOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-3 py-2 text-xs bg-secondary/30 max-h-40 overflow-y-auto">
                                <pre className="whitespace-pre-wrap font-sans">{deal.proposal_draft}</pre>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </Card>
        </motion.div>
    );
};

const StrategyCard = ({ scenario }) => {
    const winner = scenario.winner || 'Hybrid LP';
    const quoteReturn = scenario.quote_return || 0;
    const baseReturn = scenario.base_return || 0;
    const hybridReturn = scenario.hybrid_return || 0;
    
    const getWinnerBadge = (w) => {
        if (w === 'Quote LP') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        if (w === 'Base LP') return 'bg-green-500/20 text-green-400 border-green-500/30';
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    };
    
    const formatReturn = (val) => {
        if (val === null || val === undefined) return '—';
        const formatted = (val * 100).toFixed(1);
        return val >= 0 ? `+${formatted}%` : `${formatted}%`;
    };
    
    const getReturnColor = (val) => {
        if (val === null || val === undefined) return 'text-muted-foreground';
        return val >= 0 ? 'text-green-400' : 'text-red-400';
    };

    return (
        <motion.div variants={itemVariants}>
            <Card className="p-3 transition-all duration-200 hover:shadow-lg">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-sm">{scenario.scenario}</h3>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${getWinnerBadge(winner)}`}>
                        {winner}
                    </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-secondary/30 rounded p-2">
                        <div className="text-xs text-muted-foreground mb-0.5">Quote</div>
                        <div className={`text-sm font-bold ${getReturnColor(quoteReturn)}`}>
                            {formatReturn(quoteReturn)}
                        </div>
                    </div>
                    <div className="bg-secondary/30 rounded p-2">
                        <div className="text-xs text-muted-foreground mb-0.5">Base</div>
                        <div className={`text-sm font-bold ${getReturnColor(baseReturn)}`}>
                            {formatReturn(baseReturn)}
                        </div>
                    </div>
                    <div className="bg-secondary/30 rounded p-2">
                        <div className="text-xs text-muted-foreground mb-0.5">Hybrid</div>
                        <div className={`text-sm font-bold ${getReturnColor(hybridReturn)}`}>
                            {formatReturn(hybridReturn)}
                        </div>
                    </div>
                </div>
                
                {scenario.notes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{scenario.notes}</p>
                )}
            </Card>
        </motion.div>
    );
};

const CashflowCard = ({ deal }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const coc = deal.coc || 0;
    const loftyUrl = deal.property_id ? `https://www.lofty.ai/property/${deal.property_id}` : null;

    const handleCreateProposal = () => {
        const params = new URLSearchParams({
            type: 'cashflow',
            property_id: deal.property_id || '',
            address: deal.address || '',
            city: deal.city || '',
            state: deal.state || '',
            coc: coc.toString(),
        });
        navigate(`/proposals/new?${params.toString()}`);
        toast({ title: "Creating Proposal", description: `Drafting proposal for ${deal.address}` });
    };

    return (
        <motion.div variants={itemVariants}>
            <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30">
                <div className="flex">
                    <div className="w-24 h-24 shrink-0 relative">
                        <img 
                            src={deal.image_url || `https://images.lofty.ai/images/${deal.property_id}/thumb-min.webp`}
                            alt={deal.address}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&q=80';
                            }}
                        />
                    </div>
                    <div className="flex-1 p-3 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{deal.address}</h3>
                        <p className="text-xs text-muted-foreground">{deal.city}, {deal.state}</p>
                        
                        <div className="flex items-center gap-2 mt-2">
                            <Percent className="h-4 w-4 text-green-400" />
                            <span className="text-lg font-bold text-green-400">{(coc * 100).toFixed(1)}%</span>
                            <span className="text-xs text-muted-foreground">CoC</span>
                        </div>
                        
                        {deal.cap_rate && (
                            <div className="text-xs text-muted-foreground mt-1">
                                Cap Rate: {(deal.cap_rate * 100).toFixed(1)}%
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center justify-between px-3 py-2 bg-secondary/20 border-t">
                    <span className="text-xs text-muted-foreground">
                        Market: ${deal.market_price?.toFixed(2) || '—'}
                    </span>
                    <Button size="sm" onClick={handleCreateProposal} className="h-7 text-xs">
                        <FilePlus className="mr-1 h-3 w-3" /> Proposal
                    </Button>
                </div>
            </Card>
        </motion.div>
    );
};

const LoftyDeals = () => {
    const [alphaDeals, setAlphaDeals] = useState([]);
    const [strategyData, setStrategyData] = useState([]);
    const [cashflowDeals, setCashflowDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDeals = async () => {
            try {
                // Fetch alpha opportunities (with proposal_rank)
                const { data: alphaData, error: alphaErr } = await supabase
                    .from('lofty_alpha_opportunities')
                    .select('*')
                    .not('proposal_rank', 'is', null)
                    .order('proposal_rank', { ascending: true });
                
                if (alphaErr) throw alphaErr;

                // Fetch LP strategy backtest
                const { data: strategyData, error: strategyErr } = await supabase
                    .from('lofty_lp_strategy')
                    .select('*')
                    .order('scenario', { ascending: true });
                
                if (!strategyErr) {
                    setStrategyData(strategyData || []);
                }

                // Fetch cashflow opportunities (high CoC, ordered by CoC)
                const { data: cashflowData, error: cashflowErr } = await supabase
                    .from('lofty_alpha_opportunities')
                    .select('*')
                    .gt('coc', 0.1)  // CoC > 10%
                    .order('coc', { ascending: false })
                    .limit(20);
                
                if (!cashflowErr) {
                    setCashflowDeals(cashflowData || []);
                }

                setAlphaDeals(alphaData || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDeals();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto" />
                    <p className="text-muted-foreground">Loading investment deals...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
                    <p className="text-red-400">Error: {error}</p>
                    <Button onClick={() => window.location.reload()}>Retry</Button>
                </div>
            </div>
        );
    }

    const hasDeals = alphaDeals.length > 0 || strategyData.length > 0 || cashflowDeals.length > 0;

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle 
            title="Lofty.ai Investment Deals" 
            description="Alpha opportunities and LP strategy analysis by Compass Yield." 
            icon={<Bot className="h-8 w-8 text-primary" />}
          />
          
          {!hasDeals ? (
            <Card className="p-8 text-center">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Deals Available</h3>
              <p className="text-muted-foreground">
                Compass Yield analysis is pending. Check back later for investment opportunities.
              </p>
            </Card>
          ) : (
            <Tabs defaultValue="equity" className="space-y-4">
              <motion.div variants={itemVariants}>
                  <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto mb-4">
                      <TabsTrigger value="equity">
                          <TrendingUp className="mr-2 h-4 w-4" /> 
                          Equity ({alphaDeals.length})
                      </TabsTrigger>
                      <TabsTrigger value="strategy">
                          <PieChart className="mr-2 h-4 w-4" /> 
                          LP Strategy ({strategyData.length})
                      </TabsTrigger>
                      <TabsTrigger value="cashflow">
                          <DollarSign className="mr-2 h-4 w-4" /> 
                          Cashflow ({cashflowDeals.length})
                      </TabsTrigger>
                  </TabsList>
              </motion.div>

              <TabsContent value="equity">
                  {alphaDeals.length === 0 ? (
                      <Card className="p-8 text-center">
                          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No equity opportunities identified currently.</p>
                      </Card>
                  ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {alphaDeals.map(deal => <AlphaCard key={deal.property_id || deal.id} deal={deal} />)}
                      </div>
                  )}
              </TabsContent>
              
              <TabsContent value="strategy">
                  {strategyData.length === 0 ? (
                      <Card className="p-8 text-center">
                          <PieChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No LP strategy backtest data available.</p>
                      </Card>
                  ) : (
                      <>
                      <div className="mb-4 p-3 bg-secondary/30 rounded-lg flex items-center justify-between">
                          <div>
                              <h3 className="font-semibold text-sm">LP Strategy Backtest Results</h3>
                              <p className="text-xs text-muted-foreground">Quote LP = fee capture • Base LP = price upside • Hybrid = balanced</p>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {strategyData.map((s, i) => <StrategyCard key={s.id || i} scenario={s} />)}
                      </div>
                      </>
                  )}
              </TabsContent>
              
              <TabsContent value="cashflow">
                  {cashflowDeals.length === 0 ? (
                      <Card className="p-8 text-center">
                          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No high cashflow opportunities identified currently.</p>
                      </Card>
                  ) : (
                      <>
                      <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
                          <h3 className="font-semibold text-sm">High Cash-on-Cash Return Properties</h3>
                          <p className="text-xs text-muted-foreground">Properties with CoC &gt; 10%, ordered by cash yield</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {cashflowDeals.map(deal => <CashflowCard key={deal.property_id || deal.id} deal={deal} />)}
                      </div>
                      </>
                  )}
              </TabsContent>
            </Tabs>
          )}
        </motion.div>
    );
};

export default LoftyDeals;
