import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { DollarSign, Users, BarChart, Landmark, MapPin, TrendingUp } from 'lucide-react';
    import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

    const kpiData = [
      { title: 'Portfolio Value', value: '~$73,500', icon: DollarSign, change: '29 Lofty properties + crypto' },
      { title: 'Property Holdings', value: '$69,611', icon: Landmark, change: '28 addresses, 12 states' },
      { title: 'Properties Owned', value: '29', icon: MapPin, change: 'Madison Ave cluster: 4' },
      { title: 'Top APY (7d)', value: '183.4%', icon: TrendingUp, change: '6601 E Hearn Rd, Scottsdale' },
    ];

    const chartData = [
      { name: 'NY', value: 32715 },
      { name: 'HI', value: 14320 },
      { name: 'CA', value: 8146 },
      { name: 'TN', value: 5381 },
      { name: 'NM', value: 1918 },
      { name: 'OH', value: 1930 },
      { name: 'AZ', value: 728 },
      { name: 'Other', value: 4473 },
    ];

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.1,
        },
      },
    };

    const itemVariants = {
      hidden: { y: 20, opacity: 0 },
      visible: {
        y: 0,
        opacity: 1,
        transition: {
          type: 'spring',
          stiffness: 100,
        },
      },
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
                    <kpi.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpi.value}</div>
                    <p className="text-xs text-muted-foreground">{kpi.change}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div className="lg:col-span-2" variants={itemVariants}>
              <Card className="h-[400px] p-4">
                <CardHeader>
                  <CardTitle>Portfolio by State</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                      <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(20, 20, 40, 0.8)',
                          borderColor: 'rgba(136, 132, 216, 0.5)',
                          color: '#fff'
                        }}
                        formatter={(value) => [`$${value.toLocaleString()}`, 'Value']}
                      />
                      <Area type="monotone" dataKey="value" stroke="#8884d8" fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Top Holdings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-green-500/20 p-2 rounded-full"><DollarSign className="h-4 w-4 text-green-400" /></div>
                    <div>
                      <p className="text-sm font-medium">9 Country Club Ln N, NY</p>
                      <p className="text-xs text-muted-foreground">$14,505 — 690 tokens — 12.5% APY</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-500/20 p-2 rounded-full"><Landmark className="h-4 w-4 text-blue-400" /></div>
                    <div>
                      <p className="text-sm font-medium">85-104 Alawa Pl, HI</p>
                      <p className="text-xs text-muted-foreground">$14,320 — 406 tokens — 19.0% APY</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-purple-500/20 p-2 rounded-full"><MapPin className="h-4 w-4 text-purple-400" /></div>
                    <div>
                      <p className="text-sm font-medium">22164 Umland Cir, CA</p>
                      <p className="text-xs text-muted-foreground">$8,146 — 569 tokens — 5.3% APY</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-yellow-500/20 p-2 rounded-full"><Landmark className="h-4 w-4 text-yellow-400" /></div>
                    <div>
                      <p className="text-sm font-medium">Madison Ave Cluster (4)</p>
                      <p className="text-xs text-muted-foreground">$17,736 — 25.5% of portfolio</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-6">
            <p className="text-xs text-muted-foreground text-center">
              Data sourced from Algorand Indexer + LoftyAssist API — Last updated: 2026-03-23
            </p>
          </motion.div>
        </motion.div>
      );
    };

    export default Dashboard;
