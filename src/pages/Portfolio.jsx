import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Landmark, MapPin, AlertTriangle, Home, Calendar, DollarSign, Loader2 } from 'lucide-react';
    import { usePortfolioData } from '@/hooks/usePortfolioData';

    // Off-chain assets (not on Algorand — static until we find an on-chain source)
    const offChainAssets = [
      {
        name: '110 N Saddle Dr, Idaho Springs, CO 80452',
        aka: 'Luna Dome (thelunadome.com)',
        type: 'LLC Membership — 5.207% of 110 Saddle LLC',
        propertyValue: 3350000,
        mortgage: 457003,
        propertyEquity: 2892997,
        ownershipPct: 5.207,
        equityShare: 150558,
        details: '5BR/5BA geodesic dome · 5,320 sqft · 5.16 acres · 8,700ft elev · Income valuation: L12M dist-implied NOI $167.5k ÷ 5% cap (luxury STR)',
        monthlyPayment: 2477,
        state: 'CO',
        str: {
          totalRevenue: 2433855,
          l12mRevenue: 800112,
          l12mBookings: 559,
          l12mNights: 2153,
          l12mADR: 372,
          allTimeBookings: 2125,
          allTimeNights: 8032,
          allTimeADR: 303,
          avgGuests: 4.1,
          avgStay: 3.78,
          occupancy: 55,
          yearlyRevenue: [
            { year: '2022', rev: 270273 },
            { year: '2023', rev: 334402 },
            { year: '2024', rev: 556621 },
            { year: '2025', rev: 617213 },
            { year: '2026 YTD', rev: 335291 },
          ],
          platforms: { airbnb: 96.7, vrbo: 2.1, direct: 1.3 },
        },
        distributions: {
          total: 7737.90,
          annualized: 7174,
          count: 13,
          period: 'Feb 2025 — Mar 2026',
          avgMonthly: 598,
          yieldOnCost: 9.2,
          history: [
            { date: '2025-02-07', amount: 1753.46, source: 'LLC' },
            { date: '2025-02-08', amount: 364.00, source: 'LLC' },
            { date: '2025-03-06', amount: 468.63, source: 'Chad' },
            { date: '2025-04-08', amount: 338.00, source: 'Chad' },
            { date: '2025-06-06', amount: 572.77, source: 'Chad' },
            { date: '2025-07-09', amount: 312.42, source: 'Chad' },
            { date: '2025-08-12', amount: 260.35, source: 'Chad' },
            { date: '2025-10-09', amount: 442.56, source: 'Chad' },
            { date: '2025-11-05', amount: 468.63, source: 'Chad' },
            { date: '2025-12-07', amount: 666.21, source: 'LLC' },
            { date: '2026-01-07', amount: 1145.54, source: 'LLC' },
            { date: '2026-02-10', amount: 476.70, source: 'Chad' },
            { date: '2026-03-08', amount: 468.63, source: 'LLC' },
          ],
        },
      },
    ];

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
    const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' } } };
    const formatUSD = (val) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    const Portfolio = () => {
      const { data, loading, error, lastUpdated } = usePortfolioData();

      if (loading) {
        return (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto" />
              <p className="text-muted-foreground">Loading on-chain portfolio data...</p>
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
            </div>
          </div>
        );
      }

      const { properties, coolwood, totalGross, stateCount } = data;
      const allProperties = coolwood ? [coolwood, ...properties] : properties;
      const llcEquityShare = offChainAssets[0].equityShare;
      const str = offChainAssets[0].str;

      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle title="DAO Portfolio" description="On-chain tokenized properties + off-chain real estate interests." />

          {/* Summary KPIs — on-chain only */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">On-Chain Value</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUSD(totalGross)}</div>
                <p className="text-xs text-muted-foreground">Lofty tokens (live from blockchain)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tokenized Properties</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allProperties.length}</div>
                <p className="text-xs text-muted-foreground">Across {stateCount} states</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Off-Chain Equity</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-400">{formatUSD(llcEquityShare)}</div>
                <p className="text-xs text-muted-foreground">Luna Dome LLC (5.207%)</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-400">Total Portfolio</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{formatUSD(totalGross + llcEquityShare)}</div>
                <p className="text-xs text-muted-foreground">On-chain + off-chain</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tokenized Properties */}
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Landmark /> Lofty Tokenized Properties ({allProperties.length})</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {allProperties.map((asset, index) => (
                    <div key={index} className={`flex items-center justify-between p-4 hover:bg-accent/50 transition-colors ${asset.isCoolwood ? 'bg-yellow-500/5 border-l-2 border-yellow-500/40' : ''}`}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`p-2 rounded-full shrink-0 ${asset.isCoolwood ? 'bg-yellow-500/20' : 'bg-secondary'}`}>
                          <MapPin className={`h-4 w-4 ${asset.isCoolwood ? 'text-yellow-400' : 'text-blue-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{asset.address}</p>
                          <p className="text-xs text-muted-foreground">
                            {asset.tokens.toLocaleString()} tokens @ ${asset.lpPrice?.toFixed(2) || '?'}
                            {asset.wallet && <span className="ml-2 text-purple-400/60">[{asset.wallet}]</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-muted-foreground">APY (7d)</p>
                          <p className={`text-sm font-medium ${(asset.apy7d || 0) > 10 ? 'text-green-400' : ''}`}>
                            {asset.apy7d != null ? `${asset.apy7d.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-muted-foreground">Cap Rate</p>
                          <p className="text-sm font-medium">
                            {asset.capRate != null ? `${asset.capRate.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="font-semibold">{formatUSD(asset.value)}</p>
                          <p className="text-xs text-muted-foreground">{(asset.value / totalGross * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Off-chain Real Estate */}
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Home /> Other Property</h2>
            {offChainAssets.map((asset, index) => (
              <Card key={index} className="border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-purple-400" />{asset.name}</CardTitle>
                  <CardDescription>{asset.aka} — {asset.type}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-sm text-muted-foreground">{asset.details}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Property Value</p>
                      <p className="text-lg font-bold">{formatUSD(asset.propertyValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mortgage Balance</p>
                      <p className="text-lg font-bold text-red-400">-{formatUSD(asset.mortgage)}</p>
                      <p className="text-xs text-muted-foreground">${asset.monthlyPayment.toLocaleString()}/mo</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Property Equity</p>
                      <p className="text-lg font-bold">{formatUSD(asset.propertyEquity)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Your Share ({asset.ownershipPct}%)</p>
                      <p className="text-lg font-bold text-green-400">{formatUSD(asset.equityShare)}</p>
                    </div>
                  </div>

                  {/* STR Performance */}
                  <div className="border-t border-border/20 pt-4">
                    <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> Short-Term Rental Performance</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">All-Time Revenue</p>
                        <p className="text-lg font-bold">{formatUSD(str.totalRevenue)}</p>
                        <p className="text-xs text-muted-foreground">{str.allTimeBookings.toLocaleString()} bookings</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last 12 Months</p>
                        <p className="text-lg font-bold text-green-400">{formatUSD(str.l12mRevenue)}</p>
                        <p className="text-xs text-muted-foreground">{str.l12mBookings} bookings</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">L12M ADR</p>
                        <p className="text-lg font-bold">${str.l12mADR}</p>
                        <p className="text-xs text-muted-foreground">{str.avgStay} nights avg stay</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Occupancy</p>
                        <p className="text-lg font-bold">{str.occupancy}%</p>
                        <p className="text-xs text-muted-foreground">Airbnb {str.platforms.airbnb}%</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {str.yearlyRevenue.map((yr, i) => (
                        <div key={i} className="bg-accent/40 rounded px-3 py-1 text-center">
                          <p className="text-xs text-muted-foreground">{yr.year}</p>
                          <p className="text-sm font-semibold">${(yr.rev/1000).toFixed(0)}k</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Distributions */}
                  <div className="border-t border-border/20 pt-4">
                    <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Distributions ({asset.distributions.yieldOnCost}% yield on cost)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Received</p>
                        <p className="text-lg font-bold text-green-400">{formatUSD(asset.distributions.total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Annualized</p>
                        <p className="text-lg font-bold">{formatUSD(asset.distributions.annualized)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Monthly</p>
                        <p className="text-lg font-bold">${asset.distributions.avgMonthly}/mo</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Period</p>
                        <p className="text-sm font-medium">{asset.distributions.period}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1">
                      {asset.distributions.history.map((d, i) => (
                        <div key={i} className={`text-center rounded px-1 py-1 text-xs ${d.source === 'LLC' ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                          <p className="text-muted-foreground">{d.date.slice(5)}</p>
                          <p className="font-medium">${d.amount.toFixed(0)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          <motion.div variants={itemVariants}>
            <p className="text-xs text-muted-foreground text-center">
              On-chain: Algorand Indexer + LoftyAssist (W1 + Treasury) · Off-chain: Hospitable
              {lastUpdated && ` · Fetched ${lastUpdated.toLocaleTimeString()}`}
            </p>
          </motion.div>
        </motion.div>
      );
    };

    export default Portfolio;
