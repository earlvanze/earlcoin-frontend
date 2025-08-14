import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { useToast } from '@/components/ui/use-toast';
    import { HeartHandshake as Handshake, UserCheck } from 'lucide-react';

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    const itemVariants = {
      hidden: { y: 20, opacity: 0 },
      visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
    };

    const Delegate = () => {
      const { toast } = useToast();

      const handleDelegation = (e) => {
        e.preventDefault();
        const address = e.target.elements.address.value;
        if (!address) {
          toast({ variant: 'destructive', title: 'Address is required' });
          return;
        }
        toast({
          title: 'Delegating Vote...',
          description: `Your voting power will be delegated to ${address.substring(0, 6)}...${address.substring(address.length - 4)}.`,
        });
      };

      const handleRevoke = () => {
        toast({
          title: 'Revoking Delegation...',
          description: 'Your voting power is being returned to your wallet.',
        });
      };

      const currentDelegation = 'ALGO...ADVISOR';

      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <PageTitle title="Delegate Voting Power" description="Delegate your vote to a trusted member or advisor." />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Handshake /> New Delegation</CardTitle>
                  <CardDescription>Enter the Algorand address of the wallet you wish to delegate your voting power to.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleDelegation} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Delegate Address</Label>
                      <Input id="address" placeholder="Enter Algorand wallet address..." />
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600">Delegate Vote</Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserCheck /> Current Delegation</CardTitle>
                  <CardDescription>Your voting power is currently delegated. You can revoke this at any time.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentDelegation ? (
                    <>
                      <div className="p-4 rounded-lg bg-secondary/50 text-center">
                        <p className="text-muted-foreground">Delegated to:</p>
                        <p className="font-mono text-lg font-bold">{currentDelegation}</p>
                      </div>
                      <Button onClick={handleRevoke} variant="destructive" className="w-full">Revoke Delegation</Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">You have not delegated your vote.</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      );
    };

    export default Delegate;