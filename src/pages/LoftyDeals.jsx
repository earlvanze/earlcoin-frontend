import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { TrendingUp, DollarSign, Bot, FilePlus } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    const itemVariants = {
      hidden: { y: 20, opacity: 0 },
      visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
    };

    const equityDeals = [
      {
        id: 1,
        address: '123 Maple Street, Denver, CO',
        oraclePrice: 320000,
        listingPrice: 295000,
        equityPotential: 25000,
        recommendation: 'High Priority Buy',
        sharesToBuy: 50,
        imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914'
      },
      {
        id: 2,
        address: '789 Birch Lane, Austin, TX',
        oraclePrice: 450000,
        listingPrice: 430000,
        equityPotential: 20000,
        recommendation: 'Monitor',
        sharesToBuy: 30,
        imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994'
      },
    ];

    const cashflowDeals = [
      {
        id: 3,
        address: '456 Oak Avenue, Miami, FL',
        coc: 8.2,
        monthlyRent: 2200,
        recommendation: 'Strong Buy for Cashflow',
        sharesToBuy: 75,
        imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c'
      },
      {
        id: 4,
        address: '101 Pine Road, Phoenix, AZ',
        coc: 7.5,
        monthlyRent: 1850,
        recommendation: 'Good Cashflow Opportunity',
        sharesToBuy: 60,
        imageUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be'
      },
    ];

    const DealCard = ({ deal, type }) => {
        const { toast } = useToast();

        const handleCreateProposal = () => {
            toast({
                title: "Proposal Drafted!",
                description: `A new proposal to buy ${deal.sharesToBuy} shares of ${deal.address} is ready for review.`,
            });
        };

        return (
            <motion.div variants={itemVariants}>
                <Card className="overflow-hidden transition-all duration-300 hover:shadow-primary/20 hover:shadow-lg">
                    <CardHeader className="p-0">
                        <img src={deal.imageUrl} alt={`Property at ${deal.address}`} className="w-full h-48 object-cover" />
                        <div className="p-6">
                            <CardTitle>{deal.address}</CardTitle>
                            <CardDescription className={`mt-2 font-bold ${deal.recommendation.includes('High') || deal.recommendation.includes('Strong') ? 'text-green-400' : 'text-yellow-400'}`}>
                                {deal.recommendation}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 px-6">
                        {type === 'equity' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Equity Potential</p>
                                        <p className="font-bold text-lg">${deal.equityPotential.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Listing Price</p>
                                        <p className="font-bold text-lg">${deal.listingPrice.toLocaleString()}</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                             <>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Cash on Cash</p>
                                        <p className="font-bold text-lg">{deal.coc}%</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Monthly Rent</p>
                                        <p className="font-bold text-lg">${deal.monthlyRent.toLocaleString()}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="bg-secondary/30 p-4 flex justify-between items-center">
                        <div>
                            <p className="text-sm text-muted-foreground">Recommended</p>
                            <p className="font-bold">{deal.sharesToBuy} Shares</p>
                        </div>
                        <Button onClick={handleCreateProposal}>
                            <FilePlus className="mr-2 h-4 w-4" /> Create Proposal
                        </Button>
                    </CardFooter>
                </Card>
            </motion.div>
        )
    }

    const LoftyDeals = () => {
      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle 
            title="Lofty.ai Investment Deals" 
            description="Automated investment opportunities identified by our DAO's algorithms." 
            icon={<Bot className="h-8 w-8 text-primary" />}
          />
          
          <Tabs defaultValue="equity">
            <motion.div variants={itemVariants}>
                <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
                    <TabsTrigger value="equity"><TrendingUp className="mr-2 h-4 w-4" /> Equity Plays</TabsTrigger>
                    <TabsTrigger value="cashflow"><DollarSign className="mr-2 h-4 w-4" /> Cashflow Plays</TabsTrigger>
                </TabsList>
            </motion.div>

            <TabsContent value="equity">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {equityDeals.map(deal => <DealCard key={deal.id} deal={deal} type="equity" />)}
                </div>
            </TabsContent>
            <TabsContent value="cashflow">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cashflowDeals.map(deal => <DealCard key={deal.id} deal={deal} type="cashflow" />)}
                </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      );
    };

    export default LoftyDeals;