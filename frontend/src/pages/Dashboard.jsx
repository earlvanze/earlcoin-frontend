import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { DollarSign, Users, BarChart, Landmark } from 'lucide-react';
    import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

    const kpiData = [
      { title: 'Treasury Value', value: '$1,250,630.78', icon: DollarSign, change: '+2.1%' },
      { title: 'DAO Members', value: '142', icon: Users, change: '+5 this month' },
      { title: 'Properties Owned', value: '8', icon: Landmark, change: '+1' },
      { title: 'Avg. ROI', value: '12.4%', icon: BarChart, change: '-0.2%' },
    ];

    const chartData = [
      { name: 'Jan', value: 800000 },
      { name: 'Feb', value: 850000 },
      { name: 'Mar', value: 950000 },
      { name: 'Apr', value: 930000 },
      { name: 'May', value: 1100000 },
      { name: 'Jun', value: 1150000 },
      { name: 'Jul', value: 1250630 },
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
          <PageTitle title="Dashboard" description="Welcome back! Here's an overview of the EarlCoin DAO." />
          
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
                  <CardTitle>Treasury Growth</CardTitle>
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
                      <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(value) => `$${(value/1000)}k`} />
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(20, 20, 40, 0.8)',
                          borderColor: 'rgba(136, 132, 216, 0.5)',
                          color: '#fff'
                        }}
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
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-green-500/20 p-2 rounded-full"><DollarSign className="h-4 w-4 text-green-400" /></div>
                    <div>
                      <p className="text-sm font-medium">Lofty Property Purchase</p>
                      <p className="text-xs text-muted-foreground">Proposal #12 passed. 123 Main St acquired.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-500/20 p-2 rounded-full"><Users className="h-4 w-4 text-blue-400" /></div>
                    <div>
                      <p className="text-sm font-medium">New Member Joined</p>
                      <p className="text-xs text-muted-foreground">Wallet 0x...a4b2 joined the DAO.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-purple-500/20 p-2 rounded-full"><BarChart className="h-4 w-4 text-purple-400" /></div>
                    <div>
                      <p className="text-sm font-medium">Q2 Report Published</p>
                      <p className="text-xs text-muted-foreground">Financials and performance updated.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </motion.div>
      );
    };

    export default Dashboard;