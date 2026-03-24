import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { DollarSign, MapPin, TrendingUp, Landmark, AlertTriangle, Loader2 } from 'lucide-react';
    import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
    import USMap from '@/components/USMap';
    import { usePortfolioData } from '@/hooks/usePortfolioData';

    const navData = [
      { date: 'Sep 24', nav: 12500 },
      { date: 'Nov 24', nav: 28400 },
      { date: 'Jan 25', nav: 42300 },
      { date: 'Mar 25', nav: 58900 },
      { date: 'Jun 25', nav: 62400 },
      { date: 'Sep 25', nav: 65100 },
      { date: 'Dec 25', nav: 67800 },
    ];

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    const itemVariants = {
      hidden: { y: 20, opacity: 0 },
      visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
    };

    const formatUSD = (val) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
      return `$${val.toFixed(0)}`;
    };

    const Dashboard = () => {
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
              <p className="text-red-400">Error loading data: {error}</p>
            </div>
          </div>
        );
      }

      const { totalGross, totalMortgage, stateValues, properties, coolwood, propertyCount, stateCount, topApy } = data;
      const netEquity = totalGross - totalMortgage;

      // Add current NAV point
      const currentNav = [...navData, { date: 'Now', nav: Math.round(data.loftyGross) }];

      const kpiData = [
        { title: 'Gross Property Value', value: formatUSD(totalGross), icon: DollarSign, change: `${propertyCount} properties across ${stateCount} states` },
        { title: 'Mortgage Debt', value: `-${formatUSD(totalMortgage)}`, icon: AlertTriangle, change: '1 Coolwood Dr (unseparated)', color: 'text-red-400' },
        { title: 'Net Equity', value: `~${formatUSD(netEquity)}`, icon: Landmark, change: 'Properties (on-chain)' },
        { title: 'Top APY (7d)', value: `${topApy.apy7d?.toFixed(1) || '0'}%`, icon: TrendingUp, change: topApy.address?.split(',')[0] || 'N/A' },
      ];

      // Top 4 holdings for cards
      const topHoldings = [];
      if (coolwood) topHoldings.push(coolwood);
      topHoldings.push(...properties.slice(0, coolwood ? 3 : 4));

      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle title="Dashboard" description="EarlCoin DAO — Real portfolio overview from on-chain data." />
          
          <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8" variants={containerVariants}>
            {kpiData.map((kpi, index) => (
              <motion.div key={index} variants={itemVariants}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                    <kpi.icon className={`h-4 w-4 ${kpi.color || 'text-muted-foreground'}`} />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${kpi.color || ''}`}>{kpi.value}</div>
                    <p className="text-xs text-muted-foreground">{kpi.change}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <motion.div variants={itemVariants}>
              <Card className="p-4">
                <CardHeader>
                  <CardTitle>Portfolio NAV Over Time</CardTitle>
                  <p className="text-xs text-muted-foreground">Lofty tokens (excl. 1 Coolwood) — current from live data</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={currentNav} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                      <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(20, 20, 40, 0.9)', borderColor: 'rgba(139, 92, 246, 0.5)', color: '#fff', borderRadius: '8px' }}
                        formatter={(value) => [`$${value.toLocaleString()}`, 'NAV']}
                      />
                      <Line type="monotone" dataKey="nav" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-4">
                <CardHeader>
                  <CardTitle>Geographic Distribution</CardTitle>
                  <p className="text-xs text-muted-foreground">By gross token value across {stateCount} states</p>
                </CardHeader>
                <CardContent>
                  <USMap stateValues={stateValues} />
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {Object.entries(stateValues)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([state, value]) => (
                        <div key={state} className="text-center">
                          <p className="text-xs text-muted-foreground">{state}</p>
                          <p className="text-sm font-semibold">{formatUSD(value)}</p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Top Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {topHoldings.map((h, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${h.isCoolwood ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-accent/30'}`}>
                      <div className={`p-2 rounded-full shrink-0 ${h.isCoolwood ? 'bg-yellow-500/20' : i === 1 ? 'bg-green-500/20' : i === 2 ? 'bg-blue-500/20' : 'bg-purple-500/20'}`}>
                        {h.isCoolwood ? <AlertTriangle className="h-4 w-4 text-yellow-400" /> :
                         i === 1 ? <DollarSign className="h-4 w-4 text-green-400" /> :
                         <Landmark className={`h-4 w-4 ${i === 2 ? 'text-blue-400' : 'text-purple-400'}`} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{h.address.split(',').slice(0, 2).join(',')}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatUSD(h.value)} · {h.tokens.toLocaleString()} tokens
                          {h.isCoolwood && ` · $750k mortgage`}
                          {h.apy7d > 0 && ` · ${h.apy7d.toFixed(1)}% APY`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-6">
            <p className="text-xs text-muted-foreground text-center">
              Live on-chain data — Algorand Indexer + LoftyAssist API — W1 + Treasury wallets
              {lastUpdated && ` — Fetched ${lastUpdated.toLocaleTimeString()}`}
            </p>
          </motion.div>
        </motion.div>
      );
    };

    export default Dashboard;
