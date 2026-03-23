import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { DollarSign, MapPin, TrendingUp, Landmark, AlertTriangle } from 'lucide-react';
    import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
    import USMap from '@/components/USMap';

    const kpiData = [
      { title: 'Gross Property Value', value: '$1.23M', icon: DollarSign, change: '30 Lofty properties, 3 wallets' },
      { title: 'Mortgage Debt', value: '-$750K', icon: AlertTriangle, change: '1 Coolwood Dr (unseparated)', color: 'text-red-400' },
      { title: 'Net Equity', value: '~$486K', icon: Landmark, change: 'Properties + crypto' },
      { title: 'Top APY (7d)', value: '183.4%', icon: TrendingUp, change: '6601 E Hearn Rd, Scottsdale' },
    ];

    const navData = [
      { date: 'Sep 24', nav: 12500 },
      { date: 'Nov 24', nav: 28400 },
      { date: 'Jan 25', nav: 42300 },
      { date: 'Mar 25', nav: 58900 },
      { date: 'Jun 25', nav: 62400 },
      { date: 'Sep 25', nav: 65100 },
      { date: 'Dec 25', nav: 67800 },
      { date: 'Mar 26', nav: 69611 },
    ];

    const stateValues = {
      AR: 1162750,
      NY: 32715,
      HI: 14320,
      CA: 8146,
      TN: 5381,
      NM: 1918,
      OH: 1930,
      IL: 655,
      AZ: 728,
      AL: 424,
      TX: 103,
      CO: 102,
      FL: 31,
    };

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    const itemVariants = {
      hidden: { y: 20, opacity: 0 },
      visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
    };

    const Dashboard = () => {
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
                  <p className="text-xs text-muted-foreground">Excluding 1 Coolwood Dr (pre-tokenization accumulation)</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={navData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
                  <p className="text-xs text-muted-foreground">By gross token value across 13 states</p>
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
                          <p className="text-sm font-semibold">${value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}</p>
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
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="bg-yellow-500/20 p-2 rounded-full shrink-0"><AlertTriangle className="h-4 w-4 text-yellow-400" /></div>
                    <div>
                      <p className="text-sm font-medium">1 Coolwood Dr, AR</p>
                      <p className="text-xs text-muted-foreground">$1.16M gross · 23,255 tokens · $750k mortgage</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
                    <div className="bg-green-500/20 p-2 rounded-full shrink-0"><DollarSign className="h-4 w-4 text-green-400" /></div>
                    <div>
                      <p className="text-sm font-medium">9 Country Club Ln N, NY</p>
                      <p className="text-xs text-muted-foreground">$14,505 · 690 tokens · 12.5% APY</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
                    <div className="bg-blue-500/20 p-2 rounded-full shrink-0"><Landmark className="h-4 w-4 text-blue-400" /></div>
                    <div>
                      <p className="text-sm font-medium">85-104 Alawa Pl, HI</p>
                      <p className="text-xs text-muted-foreground">$14,320 · 406 tokens · 19.0% APY</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
                    <div className="bg-purple-500/20 p-2 rounded-full shrink-0"><Landmark className="h-4 w-4 text-purple-400" /></div>
                    <div>
                      <p className="text-sm font-medium">Madison Ave Cluster (4)</p>
                      <p className="text-xs text-muted-foreground">$17,736 · Albany, NY</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-6">
            <p className="text-xs text-muted-foreground text-center">
              Data sourced from Algorand Indexer + LoftyAssist API — 3 wallets — Last updated: 2026-03-23
            </p>
          </motion.div>
        </motion.div>
      );
    };

    export default Dashboard;
