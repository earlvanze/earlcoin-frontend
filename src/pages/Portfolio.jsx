import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Landmark, Bitcoin, HelpCircle } from 'lucide-react';

    const realEstateAssets = [
      { name: '123 Main St, Anytown, USA', value: '$350,000', roi: '15%', imageUrl: 'A modern suburban house with a two-car garage' },
      { name: '789 Broadway, Metropolis, USA', value: '$850,000', roi: '9%', imageUrl: 'A sleek, modern apartment building in a city' },
      { name: '456 Oak Avenue, Lofty Token', value: '$12,500', roi: '11%', imageUrl: 'A charming two-story house with a large front porch' },
    ];

    const cryptoAssets = [
      { name: 'Bitcoin', symbol: 'BTC', value: '$150,000', allocation: '12%' },
      { name: 'Ethereum', symbol: 'ETH', value: '$75,000', allocation: '6%' },
      { name: 'USDC', symbol: 'USDC', value: '$250,000', allocation: '20%' },
    ];

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
    };

    const itemVariants = {
      hidden: { y: 20, opacity: 0 },
      visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
    };

    const Portfolio = () => {
      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle title="DAO Portfolio" description="A diversified portfolio of real estate and digital assets." />

          <motion.div variants={itemVariants} className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Landmark /> Real Estate Holdings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {realEstateAssets.map((asset, index) => (
                <Card key={index} className="overflow-hidden group">
                  <div className="relative h-40">
                    <img  alt={asset.name} class="absolute h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" src="https://images.unsplash.com/photo-1595872018818-97555653a011" />
                    <div className="absolute inset-0 bg-black/40"></div>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg">{asset.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <p className="text-xl font-bold">{asset.value}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground text-right">Est. ROI</p>
                      <p className="text-xl font-bold text-green-400">{asset.roi}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Bitcoin /> Crypto Treasury</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {cryptoAssets.map((asset, index) => (
                    <div key={index} className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="bg-secondary p-3 rounded-full">
                          {asset.symbol === 'BTC' ? <Bitcoin className="h-5 w-5 text-orange-400" /> : asset.symbol === 'ETH' ? <HelpCircle className="h-5 w-5 text-blue-400" /> : <HelpCircle className="h-5 w-5 text-green-400" />}
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
        </motion.div>
      );
    };

    export default Portfolio;