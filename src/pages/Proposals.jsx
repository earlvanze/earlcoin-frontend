import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Users, TrendingUp, Shield, DollarSign, FileText, Clock, CheckCircle2, XCircle, Hand, Vote } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const statusConfig = {
  draft: { color: 'bg-yellow-500', label: 'Draft - Needs Second', icon: FileText },
  seconded: { color: 'bg-blue-500', label: 'Seconded - Ready for Vote', icon: Hand },
  active: { color: 'bg-green-500', label: 'Voting', icon: Vote },
  voting: { color: 'bg-green-500', label: 'Voting', icon: Vote },
  passed: { color: 'bg-emerald-500', label: 'Passed', icon: CheckCircle2 },
  failed: { color: 'bg-red-500', label: 'Failed', icon: XCircle },
  closed: { color: 'bg-gray-500', label: 'Closed', icon: Clock },
};

const Proposals = () => {
  const [proposals, setProposals] = useState([]);
  const [votes, setVotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { session, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      
      // Fetch proposals with author info
      const { data: proposalsData, error: proposalsError } = await supabase
        .from('proposals')
        .select(`
          *,
          author:profiles!author_id(username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (proposalsError) throw proposalsError;

      // Fetch all votes for these proposals
      const proposalIds = proposalsData.map(p => p.id);
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('proposal_id, ranked_choices')
        .in('proposal_id', proposalIds);

      if (votesError) throw votesError;

      // Aggregate votes by proposal and option
      const votesByProposal = {};
      votesData?.forEach(vote => {
        if (!votesByProposal[vote.proposal_id]) {
          votesByProposal[vote.proposal_id] = {};
        }
        // ranked_choices is an array of option ids in preference order
        // For simple voting, first choice gets the vote
        const choices = vote.ranked_choices || [];
        if (choices.length > 0) {
          const optionId = choices[0];
          votesByProposal[vote.proposal_id][optionId] = (votesByProposal[vote.proposal_id][optionId] || 0) + 1;
        }
      });

      setVotes(votesByProposal);
      setProposals(proposalsData || []);
    } catch (err) {
      console.error('Error fetching proposals:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSecond = async (proposalId) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not logged in', description: 'You must be logged in to second a proposal.' });
      return;
    }

    try {
      const { error } = await supabase
        .from('proposals')
        .update({ 
          seconded_by: user.id, 
          seconded_at: new Date().toISOString(),
          status: 'seconded'
        })
        .eq('id', proposalId);

      if (error) throw error;

      toast({ title: 'Proposal Seconded!', description: 'The proposal can now proceed to voting.' });
      fetchProposals();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleStartVoting = async (proposalId) => {
    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'voting' })
        .eq('id', proposalId);

      if (error) throw error;

      toast({ title: 'Voting Started', description: 'The proposal is now open for voting.' });
      fetchProposals();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const getVoteCount = (proposalId, optionId) => {
    return votes[proposalId]?.[optionId] || 0;
  };

  const getTotalVotes = (proposal) => {
    const proposalVotes = votes[proposal.id] || {};
    return Object.values(proposalVotes).reduce((sum, count) => sum + count, 0);
  };

  const getIcon = (title) => {
    if (title?.includes('Reserve') || title?.includes('Treasury')) return <DollarSign className="h-4 w-4" />;
    if (title?.includes('Property') || title?.includes('Acquire')) return <TrendingUp className="h-4 w-4" />;
    if (title?.includes('Automated') || title?.includes('smart')) return <Shield className="h-4 w-4" />;
    return <Users className="h-4 w-4" />;
  };

  const isExpired = (proposal) => {
    if (!proposal.vote_end_ts) return false;
    return Math.floor(Date.now() / 1000) > Number(proposal.vote_end_ts);
  };

  const canSecond = (proposal) => {
    // Can second if: logged in, status is draft, and user is not the author
    return user && proposal.status === 'draft' && proposal.author_id !== user.id;
  };

  const canVote = (proposal) => {
    const status = proposal.status;
    return user && (status === 'voting' || status === 'active') && !isExpired(proposal);
  };

  const filterByStatus = (statusFilter) => {
    if (statusFilter === 'all') return proposals;
    if (statusFilter === 'needs-second') return proposals.filter(p => p.status === 'draft');
    if (statusFilter === 'active') return proposals.filter(p => p.status === 'voting' || p.status === 'active' || p.status === 'seconded');
    if (statusFilter === 'closed') return proposals.filter(p => p.status === 'passed' || p.status === 'failed' || p.status === 'closed');
    return proposals;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-400">Error loading proposals: {error}</p>
        <Button onClick={fetchProposals}>Retry</Button>
      </div>
    );
  }

  const renderProposalCard = (proposal) => {
    const totalVotes = getTotalVotes(proposal);
    const expired = isExpired(proposal);
    const status = statusConfig[proposal.status] || statusConfig.draft;
    const StatusIcon = status.icon;

    return (
      <motion.div key={proposal.id} variants={itemVariants}>
        <Card className="hover:border-purple-500/30 transition-colors">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getIcon(proposal.title)}
                  <CardTitle className="text-xl">{proposal.title}</CardTitle>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span>Proposed by {proposal.author?.username || 'anonymous'}</span>
                  <span>•</span>
                  <span>{new Date(proposal.created_at).toLocaleDateString()}</span>
                  {proposal.property_id && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="text-xs">Property: {proposal.property_id}</Badge>
                    </>
                  )}
                </CardDescription>
              </div>
              <Badge className={`${status.color} text-white flex items-center gap-1`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{proposal.description}</p>
            
            {/* Show voting options if voting is active or closed */}
            {(proposal.status === 'voting' || proposal.status === 'active' || proposal.status === 'passed' || proposal.status === 'failed' || proposal.status === 'closed') && proposal.options && (
              <div className="space-y-3">
                {proposal.options.map(option => {
                  const voteCount = getVoteCount(proposal.id, option.id);
                  const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                  return (
                    <div key={option.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{option.text}</span>
                        <span className="text-muted-foreground">{percentage.toFixed(1)}% ({voteCount} votes)</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Show seconding info for draft proposals */}
            {proposal.status === 'draft' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <Hand className="h-4 w-4" />
                  <span className="font-medium">Awaiting Second</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  This proposal needs to be seconded by another token holder before it can proceed to voting.
                </p>
              </div>
            )}

            {/* Show seconded info */}
            {proposal.status === 'seconded' && proposal.seconded_at && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Seconded</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  This proposal was seconded on {new Date(proposal.seconded_at).toLocaleDateString()} and is ready for voting.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="text-sm text-muted-foreground">
              {totalVotes > 0 && (
                <span className="font-semibold">{totalVotes} votes</span>
              )}
              {proposal.vote_end_ts && (proposal.status === 'voting' || proposal.status === 'active') && (
                <span className="ml-2">
                  • {expired ? 'Voting ended' : `Ends ${new Date(proposal.vote_end_ts * 1000).toLocaleDateString()}`}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {canSecond(proposal) && (
                <Button size="sm" variant="secondary" onClick={() => handleSecond(proposal.id)}>
                  <Hand className="h-4 w-4 mr-1" /> Second
                </Button>
              )}
              {proposal.status === 'seconded' && user && proposal.author_id === user.id && (
                <Button size="sm" variant="secondary" onClick={() => handleStartVoting(proposal.id)}>
                  <Vote className="h-4 w-4 mr-1" /> Start Voting
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to={`/proposals/${proposal.id}`}>
                  {canVote(proposal) ? 'View & Vote' : 'View Details'}
                </Link>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    );
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <div className="flex justify-between items-center mb-6">
        <PageTitle title="DAO Proposals" description="Vote on the future of EarlCoin DAO using Robert's Rules of Order." />
        {session && (
          <Button asChild>
            <Link to="/proposals/new">New Proposal</Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="mb-6">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="all">All ({proposals.length})</TabsTrigger>
          <TabsTrigger value="needs-second">
            Needs Second ({filterByStatus('needs-second').length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({filterByStatus('active').length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed ({filterByStatus('closed').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {proposals.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Proposals Yet</h3>
              <p className="text-muted-foreground mb-4">Be the first to create a proposal for the DAO.</p>
              {session && (
                <Button asChild>
                  <Link to="/proposals/new">Create First Proposal</Link>
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid gap-6">
              {proposals.map(renderProposalCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="needs-second">
          <div className="grid gap-6">
            {filterByStatus('needs-second').length === 0 ? (
              <Card className="p-8 text-center">
                <Hand className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No proposals awaiting second.</p>
              </Card>
            ) : (
              filterByStatus('needs-second').map(renderProposalCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-6">
            {filterByStatus('active').length === 0 ? (
              <Card className="p-8 text-center">
                <Vote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active proposals.</p>
              </Card>
            ) : (
              filterByStatus('active').map(renderProposalCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="closed">
          <div className="grid gap-6">
            {filterByStatus('closed').length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No closed proposals.</p>
              </Card>
            ) : (
              filterByStatus('closed').map(renderProposalCard)
            )}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default Proposals;
