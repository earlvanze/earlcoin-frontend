import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, DollarSign, Bot, FilePlus, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
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

const DealCard = ({ deal, type }) => {
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleCreateProposal = () => {
        // Navigate to create proposal with deal data as query params
        const params = new URLSearchParams({
            type: type,
            property_id: deal.property_id || '',
            address: deal.address || '',
            city: deal.city || '',
            state: deal.state || '',
            token_price: deal.token_price || '',
            recommendation: deal.recommendation || '',
            thesis: deal.thesis_summary || '',
        });

        if (type === 'equity') {
            params.set('equity_potential', deal.equityPotential || '');
            params.set('nav_upside', deal.navUpside || '');
            params.set('discount_to_nav', deal.discount_to_nav || '');
            params.set('market_cap', deal.market_cap || '');
        } else {
            params.set('coc', deal.coc || '');
            params.set('monthly_rent', deal.monthlyRent || '');
            params.set('net_yield', deal.net_yield || '');
        }

        params.set('shares', deal.sharesToBuy || '');
        
        navigate(`/proposals/new?${params.toString()}`);
        
        toast({
            title: "Creating Proposal",
            description: `Drafting proposal for ${deal.address}`,
        });
    };

    const loftyUrl = deal.property_id ? `https://www.lofty.ai/property/${deal.property_id}` : null;

    return (
        <motion.div variants={itemVariants}>
            <Card className="overflow-hidden transition-all duration-300 hover:shadow-primary/20 hover:shadow-lg">
                <CardHeader className="p-0">
                    <img 
                        src={deal.imageUrl} 
                        alt={`Property at ${deal.address}`} 
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80';
                        }}
                    />
                    <div className="p-6">
                        <div className="flex justify-between items-start">
                            <CardTitle className="flex-1">{deal.address}</CardTitle>
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
                        <CardDescription className={`mt-2 font-bold ${deal.recommendation?.includes('High') || deal.recommendation?.includes('Strong') ? 'text-green-400' : 'text-yellow-400'}`}>
                            {deal.recommendation}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 px-6">
                    {type === 'equity' ? (
                        <>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Equity Potential</p>
                                    <p className="font-bold text-lg">${deal.equityPotential?.toLocaleString() || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">If NAV Converges</p>
                                    <p className="font-bold text-lg">{deal.navUpside > 0 ? "+" : ""}${deal.navUpside?.toLocaleString() || '—'}</p>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm text-muted-foreground">Discount to NAV</p>
                                <p className="font-bold">{deal.discount_to_nav?.toFixed(1) || '—'}%</p>
                            </div>
                        </>
                    ) : (
                         <>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Cash on Cash</p>
                                    <p className="font-bold text-lg">{deal.coc?.toFixed(1) || '—'}%</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Monthly Rent</p>
                                    <p className="font-bold text-lg">${deal.monthlyRent?.toLocaleString() || '—'}</p>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm text-muted-foreground">Net Yield</p>
                                <p className="font-bold">{deal.net_yield?.toFixed(1) || '—'}%</p>
                            </div>
                        </>
                    )}
                </CardContent>
                {deal.thesis_summary && (
                    <CardContent className="px-6 pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2">{deal.thesis_summary}</p>
                    </CardContent>
                )}
                <CardFooter className="bg-secondary/30 p-4 flex justify-between items-center">
                    <div>
                        <p className="text-sm text-muted-foreground">Recommended</p>
                        <p className="font-bold">{deal.sharesToBuy} Shares</p>
                        <p className="text-xs text-muted-foreground">
                            ~${((deal.sharesToBuy || 0) * (deal.token_price || 50)).toLocaleString()}
                        </p>
                    </div>
                    <Button onClick={handleCreateProposal}>
                        <FilePlus className="mr-2 h-4 w-4" /> Create Proposal
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    )
}

const LoftyDeals = () => {
    const [equityDeals, setEquityDeals] = useState([]);
    const [cashflowDeals, setCashflowDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDeals = async () => {
            try {
                const [{ data: equityRaw, error: eqErr }, { data: cashflowRaw, error: cfErr }] = await Promise.all([
                    supabase.from('lofty_equity_picks').select('*').order('last_updated', { ascending: false }),
                    supabase.from('lofty_cashflow_picks').select('*').order('last_updated', { ascending: false }),
                ]);

                if (eqErr) throw eqErr;
                if (cfErr) throw cfErr;

                const equity = (equityRaw || []).map(d => ({
                    ...d,
                    equityPotential: d.discount_to_nav && d.market_cap
                        ? Math.round(Math.abs((d.discount_to_nav / 100) * d.market_cap))
                        : 0,
                    navUpside: d.total_investment && d.market_cap
                        ? Math.round(d.total_investment - d.market_cap)
                        : 0,
                    discountToNav: d.discount_to_nav || 0,
                    listingPrice: d.market_cap || 0,
                    imageUrl: d.cover_image_url || `https://images.lofty.ai/images/${d.property_id}/thumb-min.webp`,
                    sharesToBuy: d.total_tokens ? Math.round(d.total_tokens * 0.01) : 100,
                    deal_type: 'equity',
                }));

                const cashflow = (cashflowRaw || []).map(d => ({
                    ...d,
                    coc: d.cash_on_cash || 0,
                    monthlyRent: d.monthly_rent || 0,
                    netYield: d.net_yield || 0,
                    grossYield: d.gross_yield || 0,
                    cashOnCash: d.cash_on_cash || 0,
                    imageUrl: d.cover_image_url || `https://images.lofty.ai/images/${d.property_id}/thumb-min.webp`,
                    sharesToBuy: d.total_investment ? Math.round(d.total_investment * 0.01 / (d.token_price || 1)) : 100,
                    deal_type: 'cashflow',
                }));

                setEquityDeals(equity);
                setCashflowDeals(cashflow);
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

    const hasDeals = equityDeals.length > 0 || cashflowDeals.length > 0;

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle 
            title="Lofty.ai Investment Deals" 
            description="Investment opportunities analyzed by Compass Yield. Click 'Create Proposal' to draft a DAO proposal." 
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
            <Tabs defaultValue="equity">
              <motion.div variants={itemVariants}>
                  <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
                      <TabsTrigger value="equity"><TrendingUp className="mr-2 h-4 w-4" /> Equity Plays ({equityDeals.length})</TabsTrigger>
                      <TabsTrigger value="cashflow"><DollarSign className="mr-2 h-4 w-4" /> Cashflow Plays ({cashflowDeals.length})</TabsTrigger>
                  </TabsList>
              </motion.div>

              <TabsContent value="equity">
                  {equityDeals.length === 0 ? (
                      <Card className="p-8 text-center">
                          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No equity plays identified currently.</p>
                      </Card>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {equityDeals.map(deal => <DealCard key={deal.id} deal={deal} type="equity" />)}
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
                          {cashflowDeals.map(deal => <DealCard key={deal.id} deal={deal} type="cashflow" />)}
                      </div>
                  )}
              </TabsContent>
            </Tabs>
          )}
        </motion.div>
    );
};

export default LoftyDeals;
