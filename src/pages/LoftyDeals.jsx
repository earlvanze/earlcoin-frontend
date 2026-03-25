import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TrendingUp, DollarSign, Bot, FilePlus, Loader2, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Target, BarChart3, Sparkles, Percent, Activity } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
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
            <Card className="overflow-hidden transition-all duration-300 hover:shadow-primary/20 hover:shadow-lg">
                <CardHeader className="p-0">
                    <img 
                        src={deal.image_url || `https://images.lofty.ai/images/${deal.property_id}/thumb-min.webp`} 
                        alt={`Property at ${deal.address}`} 
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80';
                        }}
                    />
                    <div className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    {deal.proposal_rank && (
                                        <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded">
                                            #{deal.proposal_rank}
                                        </span>
                                    )}
                                    {deal.featured && (
                                        <Sparkles className="h-4 w-4 text-yellow-400" />
                                    )}
                                </div>
                                <CardTitle className="flex-1">{deal.address}</CardTitle>
                            </div>
                            {loftyUrl && (
                                <a 
                                    href={loftyUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{deal.city}, {deal.state}</p>
                    </div>
                </CardHeader>
                
                <CardContent className="px-6 space-y-4">
                    {/* Alpha Badge */}
                    <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Target className="h-5 w-5 text-green-400" />
                            <span className="text-sm text-muted-foreground">Alpha Potential</span>
                        </div>
                        <p className={`text-3xl font-bold ${getAlphaColor(parseFloat(alphaPercent))}`}>
                            +{alphaPercent}%
                        </p>
                    </div>
                    
                    {/* NAV vs market */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">NAV / Token</p>
                            <p className="text-xl font-bold text-green-400">${deal.nav_per_token?.toFixed(2) || '—'}</p>
                            <p className="text-xs text-muted-foreground">Intrinsic value</p>
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Market Price</p>
                            <p className="text-xl font-bold">${deal.market_price?.toFixed(2) || '—'}</p>
                            <p className="text-xs text-muted-foreground">Current LP price</p>
                        </div>
                    </div>
                    
                    {/* Additional metrics */}
                    {deal.cap_rate && (
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Cap Rate:</span>
                                <span className="font-medium">{(deal.cap_rate * 100).toFixed(1)}%</span>
                            </div>
                            {deal.coc && (
                                <div className="flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">CoC:</span>
                                    <span className="font-medium">{(deal.coc * 100).toFixed(1)}%</span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Proposal Draft Expandable */}
                    {deal.proposal_draft && (
                        <Collapsible open={isDraftOpen} onOpenChange={setIsDraftOpen}>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <FilePlus className="h-4 w-4" />
                                        Investment Thesis
                                    </span>
                                    {isDraftOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="mt-2 p-4 bg-secondary/20 rounded-lg text-sm prose prose-invert prose-sm max-w-none">
                                    <pre className="whitespace-pre-wrap font-sans">{deal.proposal_draft}</pre>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </CardContent>
                
                <CardFooter className="bg-secondary/30 p-4 flex justify-between items-center">
                    <div>
                        <p className="text-sm text-muted-foreground">Upside</p>
                        <p className="font-bold text-green-400">
                            +${((deal.nav_per_token || 0) - (deal.market_price || 0)).toFixed(2)}/token
                        </p>
                    </div>
                    <Button onClick={handleCreateProposal} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                        <FilePlus className="mr-2 h-4 w-4" /> Create Proposal
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

const LoftyDeals = () => {
    const [alphaDeals, setAlphaDeals] = useState([]);
    const [equityDeals, setEquityDeals] = useState([]);
    const [cashflowDeals, setCashflowDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDeals = async () => {
            try {
                // Fetch alpha opportunities (featured)
                const { data: alphaData, error: alphaErr } = await supabase
                    .from('lofty_alpha_opportunities')
                    .select('*')
                    .eq('featured', true)
                    .order('proposal_rank', { ascending: true });
                
                if (alphaErr) throw alphaErr;

                // Also try to fetch legacy tables (may not exist)
                const [equityRes, cashflowRes] = await Promise.all([
                    supabase.from('lofty_equity_picks').select('*').order('last_updated', { ascending: false }),
                    supabase.from('lofty_cashflow_picks').select('*').order('last_updated', { ascending: false }),
                ]);

                setAlphaDeals(alphaData || []);
                setEquityDeals(equityRes.data || []);
                setCashflowDeals(cashflowRes.data || []);
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

    const hasDeals = alphaDeals.length > 0 || equityDeals.length > 0 || cashflowDeals.length > 0;

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle 
            title="Lofty.ai Investment Deals" 
            description="Alpha opportunities analyzed by Compass Yield. NAV vs market price analysis with investment thesis drafts." 
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
            <Tabs defaultValue="alpha" className="space-y-6">
              <motion.div variants={itemVariants}>
                  <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto mb-8">
                      <TabsTrigger value="alpha">
                          <Sparkles className="mr-2 h-4 w-4" /> 
                          Alpha ({alphaDeals.length})
                      </TabsTrigger>
                      <TabsTrigger value="equity">
                          <TrendingUp className="mr-2 h-4 w-4" /> 
                          Equity ({equityDeals.length})
                      </TabsTrigger>
                      <TabsTrigger value="cashflow">
                          <DollarSign className="mr-2 h-4 w-4" /> 
                          Cashflow ({cashflowDeals.length})
                      </TabsTrigger>
                  </TabsList>
              </motion.div>

              <TabsContent value="alpha">
                  {alphaDeals.length === 0 ? (
                      <Card className="p-8 text-center">
                          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No alpha opportunities identified currently.</p>
                      </Card>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {alphaDeals.map(deal => <AlphaCard key={deal.property_id || deal.id} deal={deal} />)}
                      </div>
                  )}
              </TabsContent>
              
              <TabsContent value="equity">
                  {equityDeals.length === 0 ? (
                      <Card className="p-8 text-center">
                          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No equity plays identified currently.</p>
                      </Card>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {equityDeals.map(deal => (
                              <Card key={deal.id} className="p-6">
                                  <h3 className="font-bold">{deal.address}</h3>
                                  <p className="text-sm text-muted-foreground">{deal.city}, {deal.state}</p>
                                  <p className="mt-2">Discount: {deal.discount_to_nav?.toFixed(1)}%</p>
                              </Card>
                          ))}
                      </div>
                  )}
              </TabsContent>
              
              <TabsContent value="cashflow">
                  {cashflowDeals.length === 0 ? (
                      <Card className="p-8 text-center">
                          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No cashflow plays identified currently.</p>
                      </Card>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {cashflowDeals.map(deal => (
                              <Card key={deal.id} className="p-6">
                                  <h3 className="font-bold">{deal.address}</h3>
                                  <p className="text-sm text-muted-foreground">{deal.city}, {deal.state}</p>
                                  <p className="mt-2">CoC: {(deal.cash_on_cash * 100)?.toFixed(1)}%</p>
                              </Card>
                          ))}
                      </div>
                  )}
              </TabsContent>
            </Tabs>
          )}
        </motion.div>
    );
};

export default LoftyDeals;
