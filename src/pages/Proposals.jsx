import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Users, TrendingUp, Shield, DollarSign } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const statusColors = {
  active: 'bg-green-500',
  closed: 'bg-red-500',
  pending: 'bg-yellow-500',
};

const Proposals = () => {
  const [proposals] = useState([
    {
      id: 1,
      title: 'Increase Treasury Reserve Ratio',
      description: 'Proposal to increase treasury reserve ratio from 10% to 15% to enhance financial stability and enable more strategic investments during market opportunities.',
      status: 'active',
      created_at: '2026-03-20T10:00:00Z',
      vote_end_ts: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
      author: { username: 'earl.algo' },
      options: [
        { id: 1, text: 'Yes - 15% Reserve', votes: 723 },
        { id: 2, text: 'No - Keep 10%', votes: 214 },
        { id: 3, text: 'Abstain', votes: 45 }
      ]
    },
    {
      id: 2,
      title: 'Acquire 2848 Cleveland St',
      description: 'Proposal to acquire 2848 Cleveland St, a 3BR/2BA property in Denver generating $3,200/mo rent with 7.2% cap rate. Purchase price: $485,000 with 20% DAO financing.',
      status: 'active',
      created_at: '2026-03-18T14:30:00Z',
      vote_end_ts: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      author: { username: 'property.committee' },
      options: [
        { id: 1, text: 'Approve Purchase', votes: 812 },
        { id: 2, text: 'Reject', votes: 167 },
        { id: 3, text: 'Defer to Next Quarter', votes: 94 }
      ]
    },
    {
      id: 3,
      title: 'Q1 2026 Dividend Distribution',
      description: 'Approve Q1 2026 dividend distribution of $125,000 (0.125 USDC per EARL token) from operational income.',
      status: 'closed',
      created_at: '2026-03-01T09:00:00Z',
      vote_end_ts: Math.floor(Date.now() / 1000) - 432000, // 5 days ago
      author: { username: 'treasury.algo' },
      options: [
        { id: 1, text: 'Approve Distribution', votes: 1456 },
        { id: 2, text: 'Reinvest in Properties', votes: 523 },
        { id: 3, text: 'Abstain', votes: 78 }
      ]
    },
    {
      id: 4,
      title: 'Implement Automated Rent Collection',
      description: 'Deploy smart contract for automated rent collection across all DAO properties, reducing manual overhead and ensuring timely payments.',
      status: 'active',
      created_at: '2026-03-22T16:00:00Z',
      vote_end_ts: Math.floor(Date.now() / 1000) + 172800, // 2 days from now
      author: { username: 'tech.committee' },
      options: [
        { id: 1, text: 'Implement System', votes: 567 },
        { id: 2, text: 'Keep Manual Process', votes: 123 },
        { id: 3, text: 'Pilot on 5 Properties', votes: 234 }
      ]
    },
    {
      id: 5,
      title: 'Partner with Lofty.ai for Liquidity Pool',
      description: 'Create EARL/USDC liquidity pool on Lofty.ai marketplace to enable instant token trading and improve liquidity for DAO members.',
      status: 'closed',
      created_at: '2026-02-15T11:00:00Z',
      vote_end_ts: Math.floor(Date.now() / 1000) - 1296000, // 15 days ago
      author: { username: 'defi.committee' },
      options: [
        { id: 1, text: 'Create LP with $500k', votes: 1678 },
        { id: 2, text: 'Create LP with $250k', votes: 432 },
        { id: 3, text: 'No Liquidity Pool', votes: 198 }
      ]
    }
  ]);

  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const { toast } = useToast();

  const getTotalVotes = (proposal) => {
    return proposal.options.reduce((total, option) => total + option.votes, 0);
  };

  const getIcon = (title) => {
    if (title.includes('Reserve') || title.includes('Treasury')) return <DollarSign className="h-4 w-4" />;
    if (title.includes('Property') || title.includes('Acquire')) return <TrendingUp className="h-4 w-4" />;
    if (title.includes('Automated') || title.includes('smart')) return <Shield className="h-4 w-4" />;
    return <Users className="h-4 w-4" />;
  };

  const handleFinalize = async (proposalId) => {
    toast({
      title: 'Finalization in Progress',
      description: 'This feature will be available once governance contracts are deployed.'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <div className="flex justify-between items-center mb-6">
        <PageTitle title="DAO Proposals" description="Vote on the future of EarlCoin DAO." />
        {session && (
          <Button asChild>
            <Link to="/proposals/new">New Proposal</Link>
          </Button>
        )}
      </div>
      <div className="grid gap-6">
        {proposals.map(proposal => {
          const totalVotes = getTotalVotes(proposal);
          const isExpired = Math.floor(Date.now() / 1000) > Number(proposal.vote_end_ts);
          return (
            <motion.div key={proposal.id} variants={itemVariants}>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getIcon(proposal.title)}
                        <CardTitle className="text-xl">{proposal.title}</CardTitle>
                      </div>
                      <CardDescription>
                        Proposed by {proposal.author?.username || 'anonymous'} on {new Date(proposal.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge className={`${statusColors[proposal.status]} text-white`}>
                      {proposal.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{proposal.description}</p>
                  <div className="space-y-3">
                    {proposal.options?.map(option => {
                      const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                      return (
                        <div key={option.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{option.text}</span>
                            <span className="text-muted-foreground">{percentage.toFixed(1)}% ({option.votes.toLocaleString()} votes)</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-semibold">{totalVotes.toLocaleString()}</span> total votes
                    {proposal.status === 'active' && (
                      <span className="ml-2">
                        • {isExpired ? 'Voting ended' : `Ends ${new Date(proposal.vote_end_ts * 1000).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {session && proposal.status === 'active' && isExpired && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleFinalize(proposal.id)}
                      >
                        Finalize
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/proposals/${proposal.id}`}>
                        {proposal.status === 'active' && !isExpired ? 'View & Vote' : 'View Results'}
                      </Link>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  );
};

export default Proposals;
