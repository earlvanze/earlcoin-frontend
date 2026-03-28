import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Landmark, Bitcoin, Coins, TrendingUp, MapPin, AlertTriangle, Sun, Home, Zap, Calendar, DollarSign, Loader2, Lock } from 'lucide-react';
    import { usePortfolioData } from '@/hooks/usePortfolioData';
    import { SOLAR_ASA } from '@/lib/wallets';

    // Off-chain assets (static — not on Algorand)
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
        loanTermMonths: 360,
        origBalance: 514000,
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

      {
        name: '804 S Quitman St, Denver, CO 80219',
        aka: 'Denver SFR — Lofty DAO (pre-tokenization)',
        type: 'DAO Members — Earl Vanze Co (7.495% equity / 3.843% total) + EVCO Holdings (3.180% / 1.630%) = 10.675% equity',
        propertyValue: 800450,
        mortgage: 358500,
        propertyEquity: 441950,
        ownershipPct: 10.675,
        ownershipOfTotal: 5.473,
        memberCapital: 47000,
        profitLoss: 0,
        equityShare: 47000,
        ltv: 44.8,
        details: 'SFR · Denver, CO · Not yet tokenized on Lofty · Rocket Mortgage $358,500 · Total member capital ~$440,298 · Earl: $47k across 2 entities',
        coc: 0,
        monthlyRent: 3500,
        noi: 34650,
        totalInvestment: 800450,
        totalLoans: 358500,
        tokens: null,
        tokenValue: null,
        state: 'CO',
        loftyStatus: 'Pre-tokenization',
        capTable: [
          { name: 'Nathaniel Gipson', capital: 202298.29, ownership: 45.946, ownershipOfTotal: 23.556 },
          { name: 'Wesley Babcock', capital: 70000, ownership: 15.898, ownershipOfTotal: 8.151 },
          { name: 'Ian Haber', capital: 50000, ownership: 11.356, ownershipOfTotal: 5.822 },
          { name: 'Earl Vanze Co', capital: 33000, ownership: 7.495, ownershipOfTotal: 3.843 },
          { name: 'NARWALL Holdings LLC', capital: 22000, ownership: 4.997, ownershipOfTotal: 2.562 },
          { name: 'Thomas A. Austin', capital: 20000, ownership: 4.542, ownershipOfTotal: 2.329 },
          { name: 'EVCO Holdings LLC (Earl)', capital: 14000, ownership: 3.180, ownershipOfTotal: 1.630 },
          { name: 'Daniel Murrey', capital: 10000, ownership: 2.271, ownershipOfTotal: 1.164 },
          { name: 'Brandon McArthur', capital: 10000, ownership: 2.271, ownershipOfTotal: 1.164 },
          { name: 'Kyle McArthur', capital: 9000, ownership: 2.044, ownershipOfTotal: 1.048 },
          { name: 'Rocket Mortgage (lender)', capital: 358500, ownership: 0, ownershipOfTotal: 41.744, isLender: true },
        ],
      },

    ];

    // Static solar data (fallback when ASA not yet created)
    const staticSolarAsset = {
      name: '24.15 kW Solar System — 110 N Saddle Dr',
      note: 'ECSOLAR (ASA 3492895002). Solar system owned by Earl Co, Powerwall by LLC.',
      cost: 100000,
      loanBalance: 96000,
      equity: 4000,
      monthlyPayment: 129,
      paymentType: 'Interest-only',
      production: {
        annualKwh: 31185,
        monthlyAvgKwh: 2599,
        annualValue: 2988,
        monthlyAvgValue: 249,
        gridUsageMonthly: 3159,
        gridCostMonthly: 288,
        coveragePercent: 82,
        netMonthlySavings: 120,
      },
    };

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
    const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' } } };
    const formatUSD = (val) => (val ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

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

      const { properties, coolwood, solarAsset, totalGross, totalFmv, totalMortgage, cryptoAssets = [] } = data;
      const allProperties = coolwood ? [coolwood, ...properties] : properties;
      const offChainEquity = offChainAssets.reduce((sum, a) => sum + (a.equityShare || 0), 0);
      const offChainDebt = offChainAssets.reduce((sum, a) => sum + Math.round((a.mortgage || 0) * (a.ownershipPct || 0) / 100), 0);
      
      // Use dynamic solar data if available, otherwise fallback to static
      const solarCost = solarAsset ? solarAsset.totalValue : staticSolarAsset.cost;
      const solarLoanBalance = solarAsset ? solarAsset.loanBalance : staticSolarAsset.loanBalance;
      const solarEquity = solarAsset ? solarAsset.equity : staticSolarAsset.equity;
      
      const totalDebt = totalMortgage + offChainDebt + solarLoanBalance;
      const onChainFmv = totalFmv || totalGross;
      const grossAssets = onChainFmv + offChainEquity + solarCost + 3910;
      const netWorth = grossAssets - totalDebt;
      const solar = staticSolarAsset.production;

      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle title="DAO Portfolio" description="Complete portfolio across tokenized properties, LLC interests, and personal assets." />

          {/* Summary KPIs */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Gross Assets</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUSD(grossAssets)}</div>
                <p className="text-xs text-muted-foreground">FMV basis + LLC share + solar + crypto</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Total Debt</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">-{formatUSD(totalDebt)}</div>
                <p className="text-xs text-muted-foreground">Coolwood $750k + Off-chain ${(offChainDebt/1000).toFixed(0)}k + Solar ${(solarLoanBalance/1000).toFixed(0)}k</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-400">Net Equity</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{formatUSD(netWorth)}</div>
                <p className="text-xs text-muted-foreground">FMV assets minus all debt</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Lofty Market Price</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUSD(totalGross)}</div>
                <p className="text-xs text-muted-foreground">{allProperties.length} tokenized properties @ market price</p>
                {onChainFmv !== totalGross && (
                  <p className="text-xs text-green-400">FMV basis: {formatUSD(onChainFmv)} ({onChainFmv > totalGross ? '+' : ''}{formatUSD(onChainFmv - totalGross)})</p>
                )}
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
                            {(asset.tokens || 0).toLocaleString()} tokens @ ${asset.lpPrice?.toFixed(2) || asset.tokenValue?.toFixed(2) || '?'}
                            {asset.wallet && <span className="ml-2 text-purple-400/60">[{asset.wallet}]</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-muted-foreground">Cash Yield</p>
                          <p className={`text-sm font-medium ${(asset.coc || 0) > 5 ? 'text-green-400' : (asset.coc || 0) === 0 ? 'text-red-400' : ''}`}>
                            {asset.coc != null ? (asset.coc === 0 ? '0% ⚠' : `${asset.coc.toFixed(1)}%`) : '—'}
                          </p>
                        </div>
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-muted-foreground">Cap Rate</p>
                          <p className="text-sm font-medium">
                            {asset.capRate != null ? `${asset.capRate.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                        <div className="text-right min-w-[120px]">
                          <p className="font-semibold">{formatUSD(asset.value)}</p>
                          <p className="text-xs text-muted-foreground">
                            {((asset.value || 0) / (totalGross || 1) * 100).toFixed(1)}% of portfolio
                          </p>
                        </div>
                        {(asset.fmv && asset.fmv !== asset.value) && (
                          <div className="text-right min-w-[120px]">
                            <p className="text-sm font-medium text-green-400">{formatUSD(asset.fmv)} FMV</p>
                            {(() => {
                              const disc = asset.fmv > 0
                                ? ((asset.value - asset.fmv) / asset.fmv * 100)
                                : null;
                              if (disc == null) return null;
                              return <p className={`text-xs font-medium ${disc < 0 ? 'text-green-400' : disc > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                {disc > 0 ? '+' : ''}{disc.toFixed(1)}% FMV gap
                              </p>;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>


          {/* Solar System */}
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Sun className="text-yellow-400" /> Other Assets</h2>
            <Card className="border-yellow-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-yellow-400" />
                  {staticSolarAsset.name}
                  {SOLAR_ASA && solarAsset && (
                    <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">ON-CHAIN</span>
                  )}
                </CardTitle>
                <CardDescription>{staticSolarAsset.note}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">System Cost</p>
                    <p className="text-lg font-bold">{formatUSD(solarCost)}</p>
                    {solarAsset && (
                      <p className="text-xs text-muted-foreground">
                        {solarAsset.totalShares.toLocaleString()} SOLAR @ $50
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Loan Balance (Escrow)
                    </p>
                    <p className="text-lg font-bold text-red-400">-{formatUSD(solarLoanBalance)}</p>
                    {solarAsset && (
                      <p className="text-xs text-muted-foreground">
                        {solarAsset.escrowShares.toLocaleString()} shares locked in gov admin
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">${staticSolarAsset.monthlyPayment}/mo ({staticSolarAsset.paymentType})</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Equity (Treasury)</p>
                    <p className="text-lg font-bold text-green-400">{formatUSD(solarEquity)}</p>
                    {solarAsset && (
                      <p className="text-xs text-muted-foreground">
                        {solarAsset.treasuryShares.toLocaleString()} shares in treasury
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Monthly Benefit</p>
                    <p className="text-lg font-bold text-green-400">${solar.netMonthlySavings}/mo</p>
                  </div>
                </div>
                <div className="border-t border-border/20 pt-4">
                  <h4 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2"><Zap className="h-4 w-4" /> Production & Usage</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Production</p>
                      <p className="text-lg font-bold">{solar.annualKwh.toLocaleString()} kWh</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Value</p>
                      <p className="text-lg font-bold">{formatUSD(solar.annualValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Grid Usage</p>
                      <p className="text-lg font-bold">{solar.gridUsageMonthly.toLocaleString()} kWh/mo</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Solar Coverage</p>
                      <p className="text-lg font-bold text-yellow-400">{solar.coveragePercent}%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Off-chain Real Estate */}
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Home /> Off-Chain Real Estate</h2>
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
                      <p className="text-xs text-muted-foreground">Mortgage / LTV</p>
                      {asset.mortgage > 0
                        ? <><p className="text-lg font-bold text-red-400">-{formatUSD(asset.mortgage)}</p>
                            <p className="text-xs text-muted-foreground">{((asset.mortgage/asset.propertyValue)*100).toFixed(1)}% LTV</p></>
                        : <><p className="text-lg font-bold text-green-400">None</p>
                            <p className="text-xs text-muted-foreground">0% LTV</p></>
                      }
                    </div>
                    {asset.memberCapital != null && (
                      <div>
                        <p className="text-xs text-muted-foreground">Member Capital</p>
                        <p className="text-lg font-bold">{formatUSD(asset.memberCapital)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {asset.ownershipPct != null ? `Your Equity (${asset.ownershipPct}%)` : 'Your Equity'}
                      </p>
                      <p className="text-lg font-bold text-green-400">
                        {asset.equityShare != null ? formatUSD(asset.equityShare) : <span className="text-yellow-400 text-sm">TBD</span>}
                      </p>
                    </div>
                  </div>
                  {/* P&L and extra DAO metrics */}
                  {(asset.profitLoss != null || asset.coc != null || asset.monthlyRent != null) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-border/20 pt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Profit / Loss</p>
                        <p className={`text-lg font-bold ${asset.profitLoss == null ? 'text-yellow-400' : asset.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {asset.profitLoss != null ? formatUSD(asset.profitLoss) : 'TBD'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">CoC Return</p>
                        <p className="text-lg font-bold">{asset.coc != null ? `${asset.coc}%` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly Rent</p>
                        <p className="text-lg font-bold">{asset.monthlyRent != null ? `$${asset.monthlyRent.toLocaleString()}` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Annual NOI</p>
                        <p className="text-lg font-bold">{asset.noi != null ? formatUSD(asset.noi) : '—'}</p>
                      </div>
                    </div>
                  )}

                  {/* STR Performance */}
                  {asset.str && (
                    <div className="border-t border-border/20 pt-4">
                      <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> Short-Term Rental Performance</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground">All-Time Revenue</p>
                          <p className="text-lg font-bold">{formatUSD(asset.str.totalRevenue)}</p>
                          <p className="text-xs text-muted-foreground">{asset.str.allTimeBookings.toLocaleString()} bookings</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Last 12 Months</p>
                          <p className="text-lg font-bold text-green-400">{formatUSD(asset.str.l12mRevenue)}</p>
                          <p className="text-xs text-muted-foreground">{asset.str.l12mBookings} bookings</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">L12M ADR</p>
                          <p className="text-lg font-bold">${asset.str.l12mADR}</p>
                          <p className="text-xs text-muted-foreground">{asset.str.avgStay} nights avg stay</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Occupancy</p>
                          <p className="text-lg font-bold">{asset.str.occupancy}%</p>
                          <p className="text-xs text-muted-foreground">Airbnb {asset.str.platforms.airbnb}%</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {asset.str.yearlyRevenue.map((yr, i) => (
                          <div key={i} className="bg-accent/40 rounded px-3 py-1 text-center">
                            <p className="text-xs text-muted-foreground">{yr.year}</p>
                            <p className="text-sm font-semibold">${(yr.rev/1000).toFixed(0)}k</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Distributions */}
                  {asset.distributions && (
                    <div className="border-t border-border/20 pt-4">
                      <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Your Distributions ({asset.distributions.yieldOnCost}% yield on cost)</h4>
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
                  )}
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Crypto */}
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Coins /> Crypto Treasury</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {cryptoAssets.length === 0 && (
                    <div className="p-4 text-muted-foreground text-sm">No non-Lofty assets found in wallets.</div>
                  )}
                  {cryptoAssets.map((asset, index) => {
                    const isUSDC = asset.assetId === 31566704;
                    const isBTC = asset.symbol?.toLowerCase().includes('btc');
                    const displayValue = isUSDC
                      ? `$${asset.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${asset.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${asset.symbol}`;
                    return (
                      <div key={index} className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="bg-secondary p-3 rounded-full">
                            {isBTC ? <Bitcoin className="h-5 w-5 text-orange-400" /> : isUSDC ? <DollarSign className="h-5 w-5 text-green-400" /> : <Coins className="h-5 w-5 text-purple-400" />}
                          </div>
                          <p className="font-bold">{asset.name} ({asset.symbol})</p>
                        </div>
                        <p className="font-semibold text-lg">{displayValue}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <p className="text-xs text-muted-foreground text-center">
              On-chain: Algorand Indexer + LoftyAssist (W1 + Treasury) · STR: Hospitable · Solar: Xcel Energy
              {SOLAR_ASA && ' · Solar ASA: ' + SOLAR_ASA}
              {lastUpdated && ` · Fetched ${lastUpdated.toLocaleTimeString()}`}
            </p>
          </motion.div>
        </motion.div>
      );
    };

    export default Portfolio;
