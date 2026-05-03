import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

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
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const { toast } = useToast();
  const [votes, setVotes] = useState({});
  const [finalizeLoading, setFinalizeLoading] = useState({});

  useEffect(() => {
    const fetchProposals = async () => {
      setLoading(true);
      const { data: proposalsData, error: proposalsError } = await supabase
        .from('proposals')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          options,
          author_id,
          vote_end_ts,
          onchain_proposal_id,
          snapshot_hash,
          profiles (
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (proposalsError) {
        console.error('Error fetching proposals:', proposalsError);
      } else {
        setProposals(proposalsData);
        
        if (proposalsData.length > 0) {
          const proposalIds = proposalsData.map(p => p.id);
          const { data: votesData, error: votesError } = await supabase
              .from('votes')
              .select('proposal_id, ranked_choices')
              .in('proposal_id', proposalIds);

          if (votesError) {
              console.error('Error fetching votes:', votesError);
          } else {
              const voteCounts = {};
              proposalsData.forEach(p => {
                  voteCounts[p.id] = p.options.map(o => ({ ...o, votes: 0}));
              });

              votesData.forEach(vote => {
                  if (voteCounts[vote.proposal_id]) {
                    vote.ranked_choices.forEach((choice) => {
                        const optionIndex = voteCounts[vote.proposal_id].findIndex(o => o.id === choice);
                        if (optionIndex !== -1) {
                          voteCounts[vote.proposal_id][optionIndex].votes += 1;
                        }
                    });
                  }
              });
              
              setVotes(voteCounts);
          }
        }
      }
      setLoading(false);
    };
    fetchProposals();
  }, []);
  
  const getTotalVotes = (proposalId) => {
    if (!votes[proposalId]) return 0;
    return votes[proposalId].reduce((total, option) => total + option.votes, 0);
  }

  const handleFinalize = async (proposalId) => {
    try {
      setFinalizeLoading((prev) => ({ ...prev, [proposalId]: true }));
      const { data, error } = await supabase.functions.invoke('finalize-proposal', {
        body: { proposal_id: proposalId }
      });

      if (error) {
        throw error;
      }

      setProposals((prev) => prev.map((proposal) => (
        proposal.id === proposalId
          ? { ...proposal, status: 'closed', snapshot_hash: data?.snapshot_hash ?? proposal.snapshot_hash }
          : proposal
      )));

      toast({ title: 'Proposal finalized', description: 'Snapshot uploaded and on-chain finalize complete.' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Finalize failed',
        description: err?.message || 'Unable to finalize proposal.'
      });
    } finally {
      setFinalizeLoading((prev) => ({ ...prev, [proposalId]: false }));
    }
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
        <PageTitle title="Proposals" description="Vote on the future of EarlCoin DAO." />
        {session && (
          <Button asChild>
            <Link to="/proposals/new">New Proposal</Link>
          </Button>
        )}
      </div>
      <div className="grid gap-6">
        {proposals.map(proposal => {
          const totalVotes = getTotalVotes(proposal.id);
          return (
            <motion.div key={proposal.id} variants={itemVariants}>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="mb-1">{proposal.title}</CardTitle>
                      <CardDescription>
                        Proposed by {proposal.profiles?.username || 'anonymous'} on {new Date(proposal.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge className={`${statusColors[proposal.status]}`}>
                      {proposal.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{proposal.description.substring(0, 150)}...</p>
                  <div className="space-y-2">
                    {votes[proposal.id]?.map(option => {
                      const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                      return (
                        <div key={option.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{option.text}</span>
                            <span>{percentage.toFixed(0)}%</span>
                          </div>
                          <Progress value={percentage} />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                   <span className="text-sm text-muted-foreground">{totalVotes} votes</span>
                  <div className="flex gap-2">
                    {session && proposal.status === 'active' && proposal.vote_end_ts && Math.floor(Date.now() / 1000) > Number(proposal.vote_end_ts) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleFinalize(proposal.id)}
                        disabled={finalizeLoading[proposal.id]}
                      >
                        {finalizeLoading[proposal.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Finalize'}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/proposals/${proposal.id}`}>View & Vote</Link>
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