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
import { LOFTY_API } from '@/lib/wallets';
import { MARKETPLACE_API, attachLoftyPropertyMeta, buildLoftyPropertyLookup, buildMarketplaceIdSet, filterTradableDeals, normalizeCashflowDeal, fetchLpPrices } from '@/lib/loftyDeals';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const NAV_PER_TOKEN_OVERRIDES = {
    // ULD listing page shows NAV per Token = $52.92; LoftyAssist tokenValue currently returns $64.37.
    // Treat the listing NAV as authoritative for NAV-labeled UI until backend ingestion is corrected.
    'Universal Lending DAO (ULD), Sheridan, Wyoming 82801': 52.92,
};

const normalizeAlphaDeal = (deal) => {
    const navOverride = NAV_PER_TOKEN_OVERRIDES[deal.address];
    if (navOverride == null) return deal;
    return {
        ...deal,
        nav_per_token: navOverride,
        navSource: 'listing-nav-override',
    };
};

// Property image URL helper - uses property_id or address-based URL
const buildAvmLookup = (rows = []) => {
    const map = {};
    for (const row of rows) {
        const totalTokens = row.tokens_outstanding || null;
        const avmPerToken = row.avm != null && totalTokens ? row.avm / totalTokens : null;
        map[row.property_id] = {
            ...row,
            avmPerToken,
        };
    }
    return map;
};

const mergeAlphaDealsWithAvm = (deals = [], avmLookup = {}) => {
    return deals.map((deal) => {
        const avm = avmLookup[deal.property_id];
        if (!avm) return normalizeAlphaDeal(deal);

        return normalizeAlphaDeal({
            ...deal,
            nav_per_token: avm.avmPerToken ?? deal.nav_per_token,
            avm: avm.avm,
            market_cap: avm.market_cap,
            avmSource: avm.avm_source || deal.avmSource,
            avmCorrected: avm.avm_corrected || false,
            dataFetchDate: avm.data_fetch_date || null,
        });
    });
};

const getPropertyImage = (deal) => {
    if (deal.property_id) {
        return `https://images.lofty.ai/images/${deal.property_id}/thumb-min.webp`;
    }

    // If a trusted direct image URL exists, use it as a fallback.
    if (deal.image_url && typeof deal.image_url === 'string' && deal.image_url.startsWith('https://')) {
        return deal.image_url;
    }

    return 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&q=80&auto=format&fit=crop';
};

const getDealTitle = (deal) => deal.address || deal.scenario || 'Unknown property';
const getDealLocation = (deal) => [deal.city, deal.state].filter(Boolean).join(', ');

const getBestStrategyReturn = (deal) => {
    const values = [deal.quote_return, deal.base_return, deal.hybrid_return]
        .filter((v) => typeof v === 'number' && !Number.isNaN(v));
    return values.length ? Math.max(...values) : Number.NEGATIVE_INFINITY;
};

const AlphaCard = ({ deal }) => {
    deal = normalizeAlphaDeal(deal);
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isDraftOpen, setIsDraftOpen] = useState(false);
    const [imgError, setImgError] = useState(false);
    
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
            shares: deal.recommended_shares || 100,  // Use position sizing from Compass Yield
            lp_depth: deal.lp_depth_tokens || '',
        });
        
        navigate(`/proposals/new?${params.toString()}`);
        
        toast({
            title: "Creating Proposal",
            description: `Drafting proposal for ${deal.address}`,
        });
    };

    const loftyUrl = deal.property_id ? `https://www.lofty.ai/property_deal/${deal.property_id}` : null;
    
    const getAlphaColor = (alpha) => {
        if (alpha >= 200) return 'text-green-400';
        if (alpha >= 100) return 'text-emerald-400';
        if (alpha >= 50) return 'text-yellow-400';
        return 'text-orange-400';
    };

    const fallbackImg = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&q=80';

    return (
        <motion.div variants={itemVariants}>
            <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30">
                <div className="flex">
                    <div className="w-28 h-28 shrink-0 relative bg-secondary">
                        {!imgError ? (
                            <img 
                                src={getPropertyImage(deal)}
                                alt={deal.address}
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary">
                                <TrendingUp className="h-8 w-8 text-muted-foreground" />
                            </div>
                        )}
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
                        
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xl font-bold ${getAlphaColor(parseFloat(alphaPercent))}`}>
                                +{alphaPercent}%
                            </span>
                            <span className="text-xs text-muted-foreground">alpha</span>
                        </div>
                        
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
                        
                        {deal.cap_rate && (
                            <div className="text-xs text-muted-foreground mt-1">
                                Cap: {(deal.cap_rate * 100).toFixed(1)}%
                            </div>
                        )}
                        {deal.navSource === 'listing-nav-override' && (
                            <div className="text-[10px] text-blue-400 mt-1">
                                NAV synced to Lofty listing page
                            </div>
                        )}
                        {deal.avmSource && deal.navSource !== 'listing-nav-override' && (
                            <div className="text-[10px] text-blue-400 mt-1">
                                AVM source: {deal.avmCorrected ? 'corrected ' : ''}{deal.avmSource}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center justify-between px-3 py-2 bg-secondary/20 border-t">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm">
                            <span className="text-muted-foreground">Upside:</span>
                            <span className="ml-1 font-bold text-green-400">+${((deal.nav_per_token || 0) - (deal.market_price || 0)).toFixed(2)}</span>
                        </span>
                        {deal.recommended_shares && deal.recommended_shares > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                                Position: {deal.recommended_shares} tokens (~${deal.position_size_usd?.toLocaleString() || Math.round(deal.recommended_shares * (deal.market_price || 0)).toLocaleString()})
                            </span>
                        )}
                    </div>
                    <Button size="sm" onClick={handleCreateProposal} className="h-7 text-xs bg-gradient-to-r from-purple-600 to-indigo-600">
                        <FilePlus className="mr-1 h-3 w-3" /> Proposal
                    </Button>
                </div>
                
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

const StrategyCard = ({ deal }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const winner = deal.winner || 'Base LP';
    const quoteReturn = deal.quote_return || 0;
    const baseReturn = deal.base_return || 0;
    const hybridReturn = deal.hybrid_return || 0;
    const proposalDraft = deal.proposal_draft || deal.notes || '';
    const [imgError, setImgError] = useState(false);
    const [isDraftOpen, setIsDraftOpen] = useState(false);
    const displayTitle = getDealTitle(deal);
    const displayLocation = getDealLocation(deal);
    
    const loftyUrl = deal.property_id ? `https://www.lofty.ai/property_deal/${deal.property_id}` : null;
    
    const getWinnerBadge = (w) => {
        if (w === 'Quote LP') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        if (w === 'Base LP') return 'bg-green-500/20 text-green-400 border-green-500/30';
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    };
    
    const formatReturn = (val) => {
        if (val === null || val === undefined || val === 0) return '—';
        const formatted = (val * 100).toFixed(0);
        return val >= 0 ? `+${formatted}%` : `${formatted}%`;
    };
    
    const getReturnColor = (val) => {
        if (val === null || val === undefined || val === 0) return 'text-muted-foreground';
        return val >= 0 ? 'text-green-400' : 'text-red-400';
    };

    const handleCreateProposal = () => {
        const params = new URLSearchParams({
            type: 'lp',
            property_id: deal.property_id || '',
            address: deal.address || deal.scenario || '',
            city: deal.city || '',
            state: deal.state || '',
            winner: winner,
            recommendation: deal.recommendation || '',
            strategy_type: deal.strategy_type || winner,
            quote_return_pct: typeof quoteReturn === 'number' ? (quoteReturn * 100).toFixed(1) : '',
            base_return_pct: typeof baseReturn === 'number' ? (baseReturn * 100).toFixed(1) : '',
            hybrid_return_pct: typeof hybridReturn === 'number' ? (hybridReturn * 100).toFixed(1) : '',
            proposal_draft: proposalDraft,
        });
        navigate(`/proposals/new?${params.toString()}`);
        toast({
            title: 'Creating Proposal',
            description: `Drafting LP strategy proposal for ${deal.address || deal.scenario}`,
        });
    };

    return (
        <motion.div variants={itemVariants}>
            <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30">
                <div className="flex">
                    <div className="w-24 h-24 shrink-0 relative bg-secondary">
                        {!imgError ? (
                            <img 
                                src={getPropertyImage(deal)}
                                alt={deal.address}
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <PieChart className="h-6 w-6 text-muted-foreground" />
                            </div>
                        )}
                        {deal.proposal_rank && (
                            <span className="absolute top-1 left-1 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                #{deal.proposal_rank}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 p-2.5 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                            <div className="min-w-0">
                                <h3 className="font-medium text-xs truncate">{displayTitle}</h3>
                                {displayLocation && <p className="text-[10px] text-muted-foreground">{displayLocation}</p>}
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${getWinnerBadge(winner)}`}>
                                {winner}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1 mt-2 text-center">
                            <div className="bg-secondary/30 rounded p-1.5">
                                <div className="text-[10px] text-muted-foreground">Quote</div>
                                <div className={`text-xs font-bold ${getReturnColor(quoteReturn)}`}>
                                    {formatReturn(quoteReturn)}
                                </div>
                            </div>
                            <div className="bg-secondary/30 rounded p-1.5">
                                <div className="text-[10px] text-muted-foreground">Base</div>
                                <div className={`text-xs font-bold ${getReturnColor(baseReturn)}`}>
                                    {formatReturn(baseReturn)}
                                </div>
                            </div>
                            <div className="bg-secondary/30 rounded p-1.5">
                                <div className="text-[10px] text-muted-foreground">Hybrid</div>
                                <div className={`text-xs font-bold ${getReturnColor(hybridReturn)}`}>
                                    {formatReturn(hybridReturn)}
                                </div>
                            </div>
                        </div>
                        
                        {deal.market_oracle_ratio && (
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                                <span>Mkt/Oracle:</span>
                                <span className="font-mono font-bold">{deal.market_oracle_ratio.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-secondary/20 border-t">
                    <span className="text-[10px] text-muted-foreground">
                        {deal.recommendation || 'LP strategy recommendation'}
                    </span>
                    <Button size="sm" onClick={handleCreateProposal} className="h-6 text-[10px] px-2 bg-gradient-to-r from-purple-600 to-indigo-600">
                        <FilePlus className="mr-1 h-3 w-3" /> Proposal
                    </Button>
                </div>
                {proposalDraft && (
                    <Collapsible open={isDraftOpen} onOpenChange={setIsDraftOpen}>
                        <CollapsibleTrigger asChild>
                            <button className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors flex items-center justify-center gap-1">
                                <span>Proposal Draft</span>
                                {isDraftOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-3 py-2 text-xs bg-secondary/30 max-h-40 overflow-y-auto">
                                <pre className="whitespace-pre-wrap font-sans">{proposalDraft}</pre>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </Card>
        </motion.div>
    );
};

const CashflowCard = ({ deal }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [imgError, setImgError] = useState(false);
    const [isDraftOpen, setIsDraftOpen] = useState(false);

    const capRate = deal.cap_rate ? (deal.cap_rate * 100).toFixed(1) : '—';
    const coc = deal.coc ? (deal.coc * 100).toFixed(1) : '—';
    const loftyUrl = deal.property_id ? `https://www.lofty.ai/property_deal/${deal.property_id}` : null;

    const hasNav = typeof deal.nav_per_token === 'number' && deal.nav_per_token > 0;
    const upside = hasNav && deal.market_price
        ? ((deal.nav_per_token - deal.market_price) / deal.market_price * 100).toFixed(1)
        : null;
    const upsideDollar = hasNav && deal.market_price
        ? (deal.nav_per_token - deal.market_price).toFixed(2)
        : null;

    const investmentThesis = deal.proposal_draft || (
        hasNav && parseFloat(upside) > 10
            ? `Strong cashflow property with ${coc}% T-12 yield and ${upside}% NAV upside. NAV $${deal.nav_per_token?.toFixed(2)} vs market $${deal.market_price?.toFixed(2)} suggests undervaluation. Cap rate ${capRate}%.`
            : null
    );

    const handleCreateProposal = () => {
        const params = new URLSearchParams({
            type: 'cashflow',
            property_id: deal.property_id || '',
            address: deal.address || '',
            city: deal.city || '',
            state: deal.state || '',
            token_price: deal.market_price || '',
            nav_per_token: deal.nav_per_token || '',
            coc: coc,
            cap_rate: capRate,
            proposal_draft: investmentThesis || '',
            shares: deal.recommended_shares || 100,  // Use position sizing from Compass Yield
        });
        navigate(`/proposals/new?${params.toString()}`);
        toast({ title: "Creating Proposal", description: `Drafting proposal for ${deal.address}` });
    };

    const getCocColor = (c) => {
        if (c >= 0.15) return 'text-green-400';
        if (c >= 0.10) return 'text-emerald-400';
        return 'text-yellow-400';
    };

    const fallbackImg = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&q=80';

    return (
        <motion.div variants={itemVariants}>
            <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30">
                <div className="flex">
                    <div className="w-28 h-28 shrink-0 relative bg-secondary">
                        {!imgError ? (
                            <img
                                src={getPropertyImage(deal)}
                                alt={deal.address}
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary">
                                <DollarSign className="h-8 w-8 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 p-3 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                                <h3 className="font-semibold text-sm truncate">{deal.address}</h3>
                                <p className="text-xs text-muted-foreground">{[deal.city, deal.state].filter(Boolean).join(', ')}</p>
                            </div>
                            {loftyUrl && (
                                <a href={loftyUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            )}
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xl font-bold ${getCocColor(deal.coc || 0)}`}>
                                {coc}%
                            </span>
                            <span className="text-xs text-muted-foreground">T-12 yield</span>
                        </div>

                        <div className="flex gap-3 mt-1.5 text-xs">
                            {hasNav && (
                                <div>
                                    <span className="text-muted-foreground">NAV:</span>
                                    <span className="ml-1 font-semibold text-green-400">${deal.nav_per_token?.toFixed(2)}</span>
                                </div>
                            )}
                            <div>
                                <span className="text-muted-foreground">Market:</span>
                                <span className="ml-1 font-semibold">${deal.market_price?.toFixed(2) || '—'}</span>
                            </div>
                        </div>

                        {capRate !== '—' && (
                            <div className="text-xs text-muted-foreground mt-1">
                                Cap: {capRate}%
                            </div>
                        )}
                        {deal.avmSource && (
                            <div className="text-[10px] text-blue-400 mt-1">
                                AVM source: {deal.avmCorrected ? 'corrected ' : ''}{deal.avmSource}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between px-3 py-2 bg-secondary/20 border-t">
                    <span className="text-sm">
                        {upside !== null ? (
                            <>
                                <span className="text-muted-foreground">Upside:</span>
                                <span className={`ml-1 font-bold ${parseFloat(upside) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {parseFloat(upside) >= 0 ? '+' : ''}{upsideDollar} ({upside}%)
                                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">CoC: {coc}%</span>
                        )}
                    </span>
                    <Button size="sm" onClick={handleCreateProposal} className="h-7 text-xs bg-gradient-to-r from-purple-600 to-indigo-600">
                        <FilePlus className="mr-1 h-3 w-3" /> Proposal
                    </Button>
                </div>

                {investmentThesis && (
                    <Collapsible open={isDraftOpen} onOpenChange={setIsDraftOpen}>
                        <CollapsibleTrigger asChild>
                            <button className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors flex items-center justify-center gap-1">
                                <span>Investment Thesis</span>
                                {isDraftOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-3 py-2 text-xs bg-secondary/30 max-h-40 overflow-y-auto">
                                <pre className="whitespace-pre-wrap font-sans">{investmentThesis}</pre>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
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
                // Fetch all alpha opportunities so ranked deals stay first,
                // then backfill with unranked tradable rows up to 20.
                const { data: alphaData, error: alphaErr } = await supabase
                    .from('lofty_alpha_opportunities')
                    .select('*');
                
                if (alphaErr) throw alphaErr;

                // Fetch AVM/FMVs for alpha deal enrichment
                const { data: avmRows, error: avmErr } = await supabase
                    .from('lofty_portfolio_avm')
                    .select('property_id, avm, tokens_outstanding, market_cap, avm_source, avm_corrected, data_fetch_date');

                if (avmErr) throw avmErr;

                const avmLookup = buildAvmLookup(avmRows || []);

                // Fetch LP strategy backtest
                const { data: strategyData, error: strategyErr } = await supabase
                    .from('lofty_lp_strategy')
                    .select('*');

                // Fetch live Lofty property metadata + marketplace whitelist once for all tabs
                // LoftyAssist may be blocked by CORS or proxy misconfiguration — handle gracefully
                let cashflowRaw = [];
                let loftyPropertyLookup = {};
                let marketplaceIds = new Set();

                const [cashflowRes, marketplaceRes] = await Promise.all([
                    fetch(LOFTY_API).catch(() => null),
                    fetch(MARKETPLACE_API).catch(() => null),
                ]);

                if (marketplaceRes?.ok) {
                    const marketplaceRaw = await marketplaceRes.json();
                    marketplaceIds = buildMarketplaceIdSet(marketplaceRaw?.data?.properties || []);
                }

                if (cashflowRes?.ok) {
                    try {
                        cashflowRaw = await cashflowRes.json();
                        loftyPropertyLookup = buildLoftyPropertyLookup(cashflowRaw || []);
                    } catch (e) {
                        console.warn('LoftyAssist JSON parse failed, continuing without cashflow data', e);
                    }
                } else {
                    console.warn('LoftyAssist fetch failed (CORS or proxy), continuing without cashflow data');
                }

                const liveCashflowDeals = filterTradableDeals(
                    (cashflowRaw || []).map(normalizeCashflowDeal),
                    marketplaceIds,
                )
                    .filter((deal) => typeof deal.coc === 'number' && deal.coc > 0)
                    .sort((a, b) => (b.coc || 0) - (a.coc || 0))
                    .slice(0, 20);

                // Enrich cashflow deals with AVM/NAV data (same as alpha deals).
                const enrichedCashflowDeals = liveCashflowDeals.map((deal) => {
                    const avm = avmLookup[deal.property_id];
                    if (!avm) return deal;
                    return {
                        ...deal,
                        nav_per_token: avm.avmPerToken ?? deal.nav_per_token,
                        avm: avm.avm,
                        market_cap: avm.market_cap,
                        avmSource: avm.avm_source || null,
                        avmCorrected: avm.avm_corrected || false,
                    };
                });
                

                // Fetch live LP marketplace prices and apply to cashflow deals
                const lpPrices = await fetchLpPrices();
                const cashflowWithLp = enrichedCashflowDeals.map((deal) => {
                    const lp = deal.assetId ? lpPrices[deal.assetId] : null;
                    if (lp) {
                        return { ...deal, market_price: lp };
                    }
                    return deal;
                });
                setCashflowDeals(cashflowWithLp);

                const tradableAlphaDeals = filterTradableDeals(
                    attachLoftyPropertyMeta(alphaData || [], loftyPropertyLookup),
                    marketplaceIds,
                );

                const enrichedAlphaDeals = tradableAlphaDeals
                    .sort((a, b) => {
                        const rankA = typeof a.proposal_rank === 'number' ? a.proposal_rank : Number.POSITIVE_INFINITY;
                        const rankB = typeof b.proposal_rank === 'number' ? b.proposal_rank : Number.POSITIVE_INFINITY;
                        if (rankA !== rankB) return rankA - rankB;

                        const navA = typeof a.nav_per_token === 'number' ? a.nav_per_token : 0;
                        const navB = typeof b.nav_per_token === 'number' ? b.nav_per_token : 0;
                        const marketA = typeof a.market_price === 'number' ? a.market_price : (typeof a.tokenValue === 'number' ? a.tokenValue : 0);
                        const marketB = typeof b.market_price === 'number' ? b.market_price : (typeof b.tokenValue === 'number' ? b.tokenValue : 0);
                        const alphaA = marketA > 0 ? ((navA - marketA) / marketA) : Number.NEGATIVE_INFINITY;
                        const alphaB = marketB > 0 ? ((navB - marketB) / marketB) : Number.NEGATIVE_INFINITY;
                        return alphaB - alphaA;
                    })
                    .slice(0, 20);
                

                // Apply live LP prices to alpha deals
                const alphaWithLp = enrichedAlphaDeals.map((deal) => {
                    const lp = deal.assetId ? lpPrices[deal.assetId] : null;
                    if (lp && lp > 0) {
                        return { ...deal, market_price: lp };
                    }
                    return deal;
                });
                setAlphaDeals(mergeAlphaDealsWithAvm(alphaWithLp, avmLookup));

                if (strategyErr) throw strategyErr;

                const enrichedStrategyData = attachLoftyPropertyMeta(strategyData || [], loftyPropertyLookup)
                    .sort((a, b) => {
                        const rankA = typeof a.proposal_rank === 'number' ? a.proposal_rank : Number.POSITIVE_INFINITY;
                        const rankB = typeof b.proposal_rank === 'number' ? b.proposal_rank : Number.POSITIVE_INFINITY;
                        if (rankA !== rankB) return rankA - rankB;
                        return getBestStrategyReturn(b) - getBestStrategyReturn(a);
                    })
                    .slice(0, 20);
                setStrategyData(enrichedStrategyData);
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
                  {alphaDeals.length > 0 && (() => {
                      const sizedDeals = alphaDeals.filter(d => d.recommended_shares > 0);
                      const totalAllocation = sizedDeals.reduce((sum, d) => sum + (d.position_size_usd || d.recommended_shares * (d.market_price || 0)), 0);
                      const totalShares = sizedDeals.reduce((sum, d) => sum + d.recommended_shares, 0);
                      return sizedDeals.length > 0 ? (
                          <div className="mb-3 p-3 bg-secondary/30 rounded-lg flex items-center justify-between flex-wrap gap-2">
                              <div>
                                  <h3 className="font-semibold text-sm flex items-center gap-1.5"><Target className="h-4 w-4 text-purple-400" /> Compass Yield Sizing</h3>
                                  <p className="text-xs text-muted-foreground">Half-Kelly • $5k deployable • 5% max per position • min 50% alpha</p>
                              </div>
                              <div className="flex gap-4 text-sm">
                                  <div><span className="text-muted-foreground text-xs">Positions</span><p className="font-bold">{sizedDeals.length}</p></div>
                                  <div><span className="text-muted-foreground text-xs">Total Shares</span><p className="font-bold">{totalShares.toLocaleString()}</p></div>
                                  <div><span className="text-muted-foreground text-xs">Allocated</span><p className="font-bold text-green-400">${totalAllocation.toLocaleString(undefined, {maximumFractionDigits: 0})}</p></div>
                              </div>
                          </div>
                      ) : null;
                  })()}
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
                      <div className="mb-3 p-3 bg-secondary/30 rounded-lg flex items-center justify-between">
                          <div>
                              <h3 className="font-semibold text-sm">LP Strategy Recommendations</h3>
                              <p className="text-xs text-muted-foreground">Quote LP = fee capture • Base LP = price upside • Hybrid = balanced</p>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {strategyData.map((s, i) => <StrategyCard key={s.id || s.property_id || i} deal={s} />)}
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
                      <div className="mb-3 p-3 bg-secondary/30 rounded-lg">
                          <h3 className="font-semibold text-sm">Highest Yielding Properties</h3>
                          <p className="text-xs text-muted-foreground">Ranked by trailing 12-month (T-12) historical yield with NAV upside analysis</p>
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
