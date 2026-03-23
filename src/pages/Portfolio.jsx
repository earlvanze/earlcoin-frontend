import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Landmark, Bitcoin, HelpCircle, Coins, TrendingUp, MapPin, AlertTriangle, Sun, Home, Zap, Calendar, DollarSign } from 'lucide-react';

    const realEstateAssets = [
      { name: '1 Coolwood Dr, Little Rock, AR 72202', tokens: 23255, price: 50.00, value: 1162750, capRate: '—', apy: '—', state: 'AR', note: '$750k mortgage (unseparated)', wallet: 'W3' },
      { name: '9 Country Club Ln N, Briarcliff Manor, NY', tokens: 690, price: 21.02, value: 14504.86, capRate: '2.4%', apy: '12.5%', state: 'NY', wallet: 'W1' },
      { name: '85-104 Alawa Pl, Waianae, HI 96792', tokens: 406, price: 35.27, value: 14319.54, capRate: '-0.7%', apy: '19.0%', state: 'HI', wallet: 'W1' },
      { name: '22164 Umland Cir, Jenner, CA 95450', tokens: 569, price: 14.32, value: 8145.76, capRate: '2.0%', apy: '5.3%', state: 'CA', wallet: 'W1' },
      { name: '84 Madison Ave, Albany, NY 12202', tokens: 120, price: 61.54, value: 7384.87, capRate: '4.6%', apy: '0.0%', state: 'NY', wallet: 'W1' },
      { name: '88 Madison Ave, Albany, NY 12202', tokens: 105, price: 42.85, value: 4499.59, capRate: '5.4%', apy: '8.5%', state: 'NY', wallet: 'W1' },
      { name: '3878 Windermere Rd, Memphis, TN 38128', tokens: 252, price: 21.35, value: 5380.91, capRate: '0.0%', apy: '0.0%', state: 'TN', wallet: 'W1' },
      { name: '724 3rd Ave, Watervliet, NY 12189', tokens: 82, price: 41.43, value: 3397.40, capRate: '4.8%', apy: '4.1%', state: 'NY', wallet: 'W1' },
      { name: '90 Madison Ave, Albany, NY 12202', tokens: 66, price: 44.36, value: 2927.96, capRate: '5.7%', apy: '4.1%', state: 'NY', wallet: 'W1' },
      { name: '86 Madison Ave, Albany, NY 12202', tokens: 89, price: 32.85, value: 2923.56, capRate: '4.7%', apy: '5.4%', state: 'NY', wallet: 'W1' },
      { name: '14018 Arcadia Rd NE, Albuquerque, NM', tokens: 50, price: 38.36, value: 1917.80, capRate: '4.0%', apy: '34.4%', state: 'NM', wallet: 'W1' },
      { name: 'Ohio 3 Property Package', tokens: 80, price: 17.97, value: 1437.83, capRate: '1.2%', apy: '28.5%', state: 'OH', wallet: 'W1' },
      { name: '6601 E Hearn Rd, Scottsdale, AZ 85254', tokens: 18, price: 40.43, value: 727.65, capRate: '3.5%', apy: '183.4%', state: 'AZ', wallet: 'W1' },
      { name: '110 Gardengate Dr, Harvest, AL 35749', tokens: 11, price: 38.58, value: 424.34, capRate: '1.4%', apy: '2.8%', state: 'AL', wallet: 'W1' },
      { name: '8143 S Sangamon St, Chicago, IL 60620', tokens: 18, price: 23.08, value: 415.36, capRate: '3.4%', apy: '0.8%', state: 'IL', wallet: 'W1' },
      { name: '918 Frederick Blvd, Akron, OH 44320', tokens: 16, price: 25.74, value: 411.84, capRate: '0.0%', apy: '0.0%', state: 'OH', wallet: 'W1' },
      { name: '26931 Shoreview Ave, Euclid, OH 44132', tokens: 8, price: 17.80, value: 142.43, capRate: '0.0%', apy: '0.0%', state: 'OH', wallet: 'W1' },
      { name: '5604 Brownfield Dr (32 Units), Lubbock, TX', tokens: 8, price: 12.88, value: 103.02, capRate: '0.6%', apy: '8.7%', state: 'TX', wallet: 'W1' },
      { name: '326-332 S Alcott St, Denver, CO 80219', tokens: 2, price: 51.02, value: 102.04, capRate: '4.2%', apy: '0.0%', state: 'CO', wallet: 'W1' },
      { name: '7542 & 7656 S Colfax Ave, Chicago, IL', tokens: 4, price: 24.21, value: 96.86, capRate: '2.6%', apy: '1.4%', state: 'IL', wallet: 'W1' },
      { name: '9634 S Green St, Chicago, IL 60643', tokens: 3, price: 24.83, value: 74.48, capRate: '0.0%', apy: '0.0%', state: 'IL', wallet: 'W1' },
      { name: '25 Circle Dr, Dixmoor, IL 60426', tokens: 3, price: 22.73, value: 68.18, capRate: '9.4%', apy: '1.1%', state: 'IL', wallet: 'W1' },
      { name: '254 Bowmanville St, Akron, OH 44305', tokens: 3, price: 16.96, value: 50.87, capRate: '4.7%', apy: '0.0%', state: 'OH', wallet: 'W1' },
      { name: '3850 W 17th St, Cleveland, OH 44109', tokens: 2, price: 23.32, value: 46.63, capRate: '0.0%', apy: '0.0%', state: 'OH', wallet: 'W1' },
      { name: '122 Florida Park Dr, Palm Coast, FL 32137', tokens: 2, price: 15.66, value: 31.31, capRate: '5.5%', apy: '0.0%', state: 'FL', wallet: 'W1' },
      { name: '783 Leonard St, Akron, OH 44307', tokens: 1, price: 23.58, value: 23.58, capRate: '0.0%', apy: '2.8%', state: 'OH', wallet: 'W1' },
      { name: '4183 E 146th St, Cleveland, OH 44128', tokens: 1, price: 19.54, value: 19.54, capRate: '0.0%', apy: '0.0%', state: 'OH', wallet: 'W1' },
      { name: '2094 W 34th Place, Cleveland, OH 44113', tokens: 1, price: 17.95, value: 17.95, capRate: '8.4%', apy: '15.8%', state: 'OH', wallet: 'W1' },
      { name: '10724 Gooding Ave, Cleveland, OH 44108', tokens: 1, price: 15.10, value: 15.10, capRate: '0.0%', apy: '0.0%', state: 'OH', wallet: 'W1' },
    ];

    const offChainAssets = [
      {
        name: '110 N Saddle Dr, Idaho Springs, CO 80452',
        aka: 'Luna Dome (thelunadome.com)',
        type: 'LLC Membership — 5.207% of 110 Saddle LLC',
        propertyValue: 809000,
        mortgage: 457003,
        propertyEquity: 351997,
        ownershipPct: 5.207,
        equityShare: 18329,
        details: '5BR/5BA geodesic dome · 5,320 sqft · 5.16 acres · 8,700ft elev · Remodeled 2024',
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
      },
    ];

    const solarAsset = {
      name: '24.15 kW Solar System — 110 N Saddle Dr',
      note: 'Personal asset (not LLC-owned). Tesla Powerwall owned by LLC.',
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

    const totalLoftyGross = realEstateAssets.reduce((sum, a) => sum + a.value, 0);
    const loftyMortgage = 750000;
    const llcEquityShare = offChainAssets[0].equityShare;
    const debtShareLuna = Math.round(offChainAssets[0].mortgage * offChainAssets[0].ownershipPct / 100);
    const totalDebt = loftyMortgage + debtShareLuna + solarAsset.loanBalance;
    const grossAssets = totalLoftyGross + Math.round(offChainAssets[0].propertyValue * offChainAssets[0].ownershipPct / 100) + solarAsset.cost + 3910;
    const netWorth = grossAssets - totalDebt;

    const cryptoAssets = [
      { name: 'USDC', symbol: 'USDC', value: '$909.71' },
      { name: 'goBTC', symbol: 'goBTC', value: '~$3,000' },
      { name: 'EARLDAO', symbol: 'EARL', value: '146 tokens' },
      { name: 'ALPHA', symbol: 'ALPHA', value: '3,003 tokens' },
    ];

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
    const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' } } };
    const formatUSD = (val) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    const Portfolio = () => {
      const str = offChainAssets[0].str;
      const solar = solarAsset.production;

      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle title="DAO Portfolio" description="Complete portfolio across tokenized properties, LLC interests, and personal assets." />

          {/* Summary KPIs */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Gross Assets</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUSD(grossAssets)}</div>
                <p className="text-xs text-muted-foreground">Lofty + LLC share + solar + crypto</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Total Debt</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">-{formatUSD(totalDebt)}</div>
                <p className="text-xs text-muted-foreground">Coolwood $750k + Luna share ${(debtShareLuna/1000).toFixed(0)}k + solar $96k</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-400">Net Equity</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{formatUSD(netWorth)}</div>
                <p className="text-xs text-muted-foreground">All assets minus all debt</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Monthly Debt Service</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">~$387</div>
                <p className="text-xs text-muted-foreground">Luna $129 + solar $129 + Coolwood TBD</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tokenized Properties */}
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Landmark /> Lofty Tokenized Properties ({realEstateAssets.length})</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {realEstateAssets.map((asset, index) => (
                    <div key={index} className={`flex items-center justify-between p-4 hover:bg-accent/50 transition-colors ${asset.note ? 'bg-yellow-500/5 border-l-2 border-yellow-500/40' : ''}`}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`p-2 rounded-full shrink-0 ${asset.note ? 'bg-yellow-500/20' : 'bg-secondary'}`}>
                          <MapPin className={`h-4 w-4 ${asset.note ? 'text-yellow-400' : 'text-blue-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {asset.tokens.toLocaleString()} tokens @ ${asset.price.toFixed(2)}
                            {asset.note && <span className="text-yellow-400 ml-2">⚠ {asset.note}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-muted-foreground">APY (7d)</p>
                          <p className={`text-sm font-medium ${parseFloat(asset.apy) > 10 ? 'text-green-400' : ''}`}>{asset.apy}</p>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="font-semibold">{formatUSD(asset.value)}</p>
                          <p className="text-xs text-muted-foreground">{(asset.value / totalLoftyGross * 100).toFixed(1)}%</p>
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
                      <p className="text-xs text-muted-foreground">Mortgage Balance</p>
                      <p className="text-lg font-bold text-red-400">-{formatUSD(asset.mortgage)}</p>
                      <p className="text-xs text-muted-foreground">${asset.monthlyPayment.toLocaleString()}/mo · {asset.loanTermMonths/12}yr · Orig ${(asset.origBalance/1000).toFixed(0)}k</p>
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
                    <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> Short-Term Rental Performance (Hospitable)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">All-Time Revenue</p>
                        <p className="text-lg font-bold">{formatUSD(str.totalRevenue)}</p>
                        <p className="text-xs text-muted-foreground">{str.allTimeBookings.toLocaleString()} bookings · {str.allTimeNights.toLocaleString()} nights</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last 12 Months</p>
                        <p className="text-lg font-bold text-green-400">{formatUSD(str.l12mRevenue)}</p>
                        <p className="text-xs text-muted-foreground">{str.l12mBookings} bookings · {str.l12mNights.toLocaleString()} nights</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">L12M ADR / Avg Stay</p>
                        <p className="text-lg font-bold">${str.l12mADR}</p>
                        <p className="text-xs text-muted-foreground">{str.avgStay} nights · {str.avgGuests} guests avg</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Occupancy (avail nights)</p>
                        <p className="text-lg font-bold">{str.occupancy}%</p>
                        <p className="text-xs text-muted-foreground">Airbnb {str.platforms.airbnb}% · VRBO {str.platforms.vrbo}%</p>
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
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Solar System */}
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Sun className="text-yellow-400" /> Personal Assets</h2>
            <Card className="border-yellow-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sun className="h-5 w-5 text-yellow-400" />{solarAsset.name}</CardTitle>
                <CardDescription>{solarAsset.note}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">System Cost</p>
                    <p className="text-lg font-bold">{formatUSD(solarAsset.cost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Loan Balance</p>
                    <p className="text-lg font-bold text-red-400">-{formatUSD(solarAsset.loanBalance)}</p>
                    <p className="text-xs text-muted-foreground">${solarAsset.monthlyPayment}/mo ({solarAsset.paymentType})</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Equity</p>
                    <p className="text-lg font-bold text-green-400">{formatUSD(solarAsset.equity)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Monthly Benefit</p>
                    <p className="text-lg font-bold text-green-400">${solar.netMonthlySavings}/mo</p>
                    <p className="text-xs text-muted-foreground">${solar.monthlyAvgValue} savings - ${solarAsset.monthlyPayment} loan</p>
                  </div>
                </div>

                <div className="border-t border-border/20 pt-4">
                  <h4 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2"><Zap className="h-4 w-4" /> Production & Usage (Xcel Energy)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Production</p>
                      <p className="text-lg font-bold">{solar.annualKwh.toLocaleString()} kWh</p>
                      <p className="text-xs text-muted-foreground">{solar.monthlyAvgKwh.toLocaleString()} kWh/mo avg</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Value</p>
                      <p className="text-lg font-bold">{formatUSD(solar.annualValue)}</p>
                      <p className="text-xs text-muted-foreground">${solar.monthlyAvgValue}/mo avg</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Grid Usage</p>
                      <p className="text-lg font-bold">{solar.gridUsageMonthly.toLocaleString()} kWh/mo</p>
                      <p className="text-xs text-muted-foreground">${solar.gridCostMonthly}/mo without solar</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Solar Coverage</p>
                      <p className="text-lg font-bold text-yellow-400">{solar.coveragePercent}%</p>
                      <p className="text-xs text-muted-foreground">of grid usage offset</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Crypto */}
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Coins /> Crypto Treasury</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {cryptoAssets.map((asset, index) => (
                    <div key={index} className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="bg-secondary p-3 rounded-full">
                          {asset.symbol === 'goBTC' ? <Bitcoin className="h-5 w-5 text-orange-400" /> : asset.symbol === 'USDC' ? <DollarSign className="h-5 w-5 text-green-400" /> : <Coins className="h-5 w-5 text-purple-400" />}
                        </div>
                        <p className="font-bold">{asset.name} ({asset.symbol})</p>
                      </div>
                      <p className="font-semibold text-lg">{asset.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <p className="text-xs text-muted-foreground text-center">
              On-chain: Algorand Indexer + LoftyAssist (3 wallets) · STR: Hospitable · Solar: Xcel Energy · Updated: 2026-03-23
            </p>
          </motion.div>
        </motion.div>
      );
    };

    export default Portfolio;
