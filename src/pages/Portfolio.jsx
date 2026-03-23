import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Landmark, Bitcoin, HelpCircle, Coins, TrendingUp, MapPin } from 'lucide-react';

    const realEstateAssets = [
      { name: '9 Country Club Ln N, Briarcliff Manor, NY', tokens: 690, price: 21.02, value: 14504.86, capRate: '2.4%', apy: '12.5%', state: 'NY' },
      { name: '85-104 Alawa Pl, Waianae, HI 96792', tokens: 406, price: 35.27, value: 14319.54, capRate: '-0.7%', apy: '19.0%', state: 'HI' },
      { name: '22164 Umland Cir, Jenner, CA 95450', tokens: 569, price: 14.32, value: 8145.76, capRate: '2.0%', apy: '5.3%', state: 'CA' },
      { name: '84 Madison Ave, Albany, NY 12202', tokens: 120, price: 61.54, value: 7384.87, capRate: '4.6%', apy: '0.0%', state: 'NY' },
      { name: '88 Madison Ave, Albany, NY 12202', tokens: 105, price: 42.85, value: 4499.59, capRate: '5.4%', apy: '8.5%', state: 'NY' },
      { name: '3878 Windermere Rd, Memphis, TN 38128', tokens: 252, price: 21.35, value: 5380.91, capRate: '0.0%', apy: '0.0%', state: 'TN' },
      { name: '724 3rd Ave, Watervliet, NY 12189', tokens: 82, price: 41.43, value: 3397.40, capRate: '4.8%', apy: '4.1%', state: 'NY' },
      { name: '90 Madison Ave, Albany, NY 12202', tokens: 66, price: 44.36, value: 2927.96, capRate: '5.7%', apy: '4.1%', state: 'NY' },
      { name: '86 Madison Ave, Albany, NY 12202', tokens: 89, price: 32.85, value: 2923.56, capRate: '4.7%', apy: '5.4%', state: 'NY' },
      { name: '14018 Arcadia Rd NE, Albuquerque, NM', tokens: 50, price: 38.36, value: 1917.80, capRate: '4.0%', apy: '34.4%', state: 'NM' },
      { name: 'Ohio 3 Property Package', tokens: 80, price: 17.97, value: 1437.83, capRate: '1.2%', apy: '28.5%', state: 'OH' },
      { name: '6601 E Hearn Rd, Scottsdale, AZ 85254', tokens: 18, price: 40.43, value: 727.65, capRate: '3.5%', apy: '183.4%', state: 'AZ' },
      { name: '110 Gardengate Dr, Harvest, AL 35749', tokens: 11, price: 38.58, value: 424.34, capRate: '1.4%', apy: '2.8%', state: 'AL' },
      { name: '8143 S Sangamon St, Chicago, IL 60620', tokens: 18, price: 23.08, value: 415.36, capRate: '3.4%', apy: '0.8%', state: 'IL' },
      { name: '918 Frederick Blvd, Akron, OH 44320', tokens: 16, price: 25.74, value: 411.84, capRate: '0.0%', apy: '0.0%', state: 'OH' },
      { name: '26931 Shoreview Ave, Euclid, OH 44132', tokens: 8, price: 17.80, value: 142.43, capRate: '0.0%', apy: '0.0%', state: 'OH' },
      { name: '5604 Brownfield Dr (32 Units), Lubbock, TX', tokens: 8, price: 12.88, value: 103.02, capRate: '0.6%', apy: '8.7%', state: 'TX' },
      { name: '326-332 S Alcott St, Denver, CO 80219', tokens: 2, price: 51.02, value: 102.04, capRate: '4.2%', apy: '0.0%', state: 'CO' },
      { name: '7542 & 7656 S Colfax Ave, Chicago, IL', tokens: 4, price: 24.21, value: 96.86, capRate: '2.6%', apy: '1.4%', state: 'IL' },
      { name: '9634 S Green St, Chicago, IL 60643', tokens: 3, price: 24.83, value: 74.48, capRate: '0.0%', apy: '0.0%', state: 'IL' },
      { name: '25 Circle Dr, Dixmoor, IL 60426', tokens: 3, price: 22.73, value: 68.18, capRate: '9.4%', apy: '1.1%', state: 'IL' },
      { name: '254 Bowmanville St, Akron, OH 44305', tokens: 3, price: 16.96, value: 50.87, capRate: '4.7%', apy: '0.0%', state: 'OH' },
      { name: '3850 W 17th St, Cleveland, OH 44109', tokens: 2, price: 23.32, value: 46.63, capRate: '0.0%', apy: '0.0%', state: 'OH' },
      { name: '122 Florida Park Dr, Palm Coast, FL 32137', tokens: 2, price: 15.66, value: 31.31, capRate: '5.5%', apy: '0.0%', state: 'FL' },
      { name: '783 Leonard St, Akron, OH 44307', tokens: 1, price: 23.58, value: 23.58, capRate: '0.0%', apy: '2.8%', state: 'OH' },
      { name: '4183 E 146th St, Cleveland, OH 44128', tokens: 1, price: 19.54, value: 19.54, capRate: '0.0%', apy: '0.0%', state: 'OH' },
      { name: '2094 W 34th Place, Cleveland, OH 44113', tokens: 1, price: 17.95, value: 17.95, capRate: '8.4%', apy: '15.8%', state: 'OH' },
      { name: '10724 Gooding Ave, Cleveland, OH 44108', tokens: 1, price: 15.10, value: 15.10, capRate: '0.0%', apy: '0.0%', state: 'OH' },
    ];

    const totalPropertyValue = realEstateAssets.reduce((sum, a) => sum + a.value, 0);

    const cryptoAssets = [
      { name: 'USDC', symbol: 'USDC', value: '$909.71', allocation: '1.2%' },
      { name: 'goBTC', symbol: 'goBTC', value: '~$3,000', allocation: '4.0%' },
      { name: 'EARLDAO', symbol: 'EARL', value: '146 tokens', allocation: '—' },
      { name: 'ALPHA', symbol: 'ALPHA', value: '3,003 tokens', allocation: '—' },
    ];

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
    };

    const itemVariants = {
      hidden: { y: 20, opacity: 0 },
      visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
    };

    const formatUSD = (val) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    const Portfolio = () => {
      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle title="DAO Portfolio" description="Real portfolio data from on-chain Algorand holdings + LoftyAssist." />

          {/* Summary KPIs */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Property Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUSD(totalPropertyValue)}</div>
                <p className="text-xs text-muted-foreground">29 properties</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">~$73,500</div>
                <p className="text-xs text-muted-foreground">Properties + crypto</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Concentration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">25.5%</div>
                <p className="text-xs text-muted-foreground">Madison Ave cluster (4 props)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">States Represented</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">NY, HI, CA, TN, OH, IL, NM, AZ, AL, TX, CO, FL</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Landmark /> Real Estate Holdings ({realEstateAssets.length} properties)</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {realEstateAssets.map((asset, index) => (
                    <div key={index} className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="bg-secondary p-2 rounded-full shrink-0">
                          <MapPin className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{asset.tokens} tokens @ {formatUSD(asset.price)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-muted-foreground">Cap Rate</p>
                          <p className="text-sm font-medium">{asset.capRate}</p>
                        </div>
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-muted-foreground">APY (7d)</p>
                          <p className={`text-sm font-medium ${parseFloat(asset.apy) > 10 ? 'text-green-400' : ''}`}>{asset.apy}</p>
                        </div>
                        <div className="text-right min-w-[90px]">
                          <p className="font-semibold">{formatUSD(asset.value)}</p>
                          <p className="text-xs text-muted-foreground">{(asset.value / totalPropertyValue * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Coins /> Crypto Treasury</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {cryptoAssets.map((asset, index) => (
                    <div key={index} className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="bg-secondary p-3 rounded-full">
                          {asset.symbol === 'goBTC' ? <Bitcoin className="h-5 w-5 text-orange-400" /> : asset.symbol === 'USDC' ? <HelpCircle className="h-5 w-5 text-green-400" /> : <Coins className="h-5 w-5 text-purple-400" />}
                        </div>
                        <div>
                          <p className="font-bold">{asset.name} ({asset.symbol})</p>
                          <p className="text-sm text-muted-foreground">Allocation: {asset.allocation}</p>
                        </div>
                      </div>
                      <p className="font-semibold text-lg">{asset.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-6">
            <p className="text-xs text-muted-foreground text-center">
              Data sourced from Algorand Indexer + LoftyAssist API — Last updated: 2026-03-23
            </p>
          </motion.div>
        </motion.div>
      );
    };

    export default Portfolio;
