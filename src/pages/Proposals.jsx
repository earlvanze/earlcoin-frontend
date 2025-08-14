import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { Link, useNavigate } from 'react-router-dom';
    import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
    import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
    import { CSS } from '@dnd-kit/utilities';
    import { supabase } from '@/lib/customSupabaseClient';
    import PageTitle from '@/components/PageTitle';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
    import { Progress } from '@/components/ui/progress';
    import { PlusCircle, CheckCircle, XCircle, Clock, HeartHandshake as Handshake, ShieldAlert, Loader2, GripVertical } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';
    import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { useAppContext } from '@/contexts/AppContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' } } };

    const SortableItem = ({ id, children }) => {
      const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
      const style = { transform: CSS.Transform.toString(transform), transition };
      return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-2 bg-accent/50 p-2 rounded-md">
          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
          {children}
        </div>
      );
    };

    const Proposals = () => {
      const { toast } = useToast();
      const { hasVerificationNft } = useAppContext();
      const { user } = useAuth();
      const navigate = useNavigate();
      const [proposals, setProposals] = useState([]);
      const [loading, setLoading] = useState(true);
      const [isVoteModalOpen, setVoteModalOpen] = useState(false);
      const [selectedProposal, setSelectedProposal] = useState(null);
      const [rankedChoices, setRankedChoices] = useState([]);
      const [voteLoading, setVoteLoading] = useState(false);

      const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

      useEffect(() => {
        const fetchProposals = async () => {
          setLoading(true);
          const { data, error } = await supabase.from('proposals').select('*, votes(*)').order('created_at', { ascending: false });
          if (error) {
            toast({ variant: 'destructive', title: 'Error fetching proposals', description: error.message });
          } else {
            setProposals(data);
          }
          setLoading(false);
        };
        fetchProposals();
      }, [toast]);

      const openVoteModal = (proposal) => {
        if (!user) {
          toast({ variant: 'destructive', title: 'Please log in', description: 'You must be logged in to vote.' });
          return;
        }
        setSelectedProposal(proposal);
        const userVote = proposal.votes.find(v => v.user_id === user.id);
        setRankedChoices(userVote ? userVote.ranked_choices : proposal.options);
        setVoteModalOpen(true);
      };

      const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
          setRankedChoices((items) => {
            const oldIndex = items.indexOf(active.id);
            const newIndex = items.indexOf(over.id);
            return arrayMove(items, oldIndex, newIndex);
          });
        }
      };

      const handleVoteSubmit = async () => {
        setVoteLoading(true);
        try {
          const { error } = await supabase.from('votes').upsert({
            proposal_id: selectedProposal.id,
            user_id: user.id,
            ranked_choices: rankedChoices,
          }, { onConflict: 'proposal_id, user_id' });

          if (error) throw error;

          toast({ title: 'Vote Submitted!', description: 'Your ranked-choice vote has been recorded.' });
          setVoteModalOpen(false);
          // Re-fetch proposals to update vote counts
          const { data } = await supabase.from('proposals').select('*, votes(*)').order('created_at', { ascending: false });
          setProposals(data);
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error submitting vote', description: error.message });
        } finally {
          setVoteLoading(false);
        }
      };

      const NotVerifiedCover = () => (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
          <ShieldAlert className="h-16 w-16 text-primary mb-4" />
          <h3 className="text-xl font-bold">Verification Required</h3>
          <p className="text-muted-foreground mb-4">You need the DAO Verification NFT to interact with proposals.</p>
          <Button asChild><Link to="/verification">Get Verified</Link></Button>
        </div>
      );

      const getStatusInfo = (status) => {
        switch (status) {
          case 'active': return { icon: <Clock className="h-5 w-5 text-yellow-400" />, text: 'Active' };
          case 'passed': return { icon: <CheckCircle className="h-5 w-5 text-green-400" />, text: 'Passed' };
          case 'failed': return { icon: <XCircle className="h-5 w-5 text-red-400" />, text: 'Failed' };
          default: return { icon: <Clock className="h-5 w-5 text-muted-foreground" />, text: 'Unknown' };
        }
      };

      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
            <PageTitle title="Proposals" description="Vote on the future of the DAO." />
            <motion.div variants={itemVariants}>
              <Button onClick={() => navigate('/proposals/new')} disabled={!hasVerificationNft} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Proposal
              </Button>
            </motion.div>
          </div>

          <div className="space-y-6 relative">
            {!hasVerificationNft && <NotVerifiedCover />}
            {loading ? (
              <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : proposals.length === 0 ? (
              <motion.div variants={itemVariants} className="text-center text-muted-foreground py-10">No proposals found. Be the first to create one!</motion.div>
            ) : (
              proposals.map((p) => {
                const statusInfo = getStatusInfo(p.status);
                const voteCount = p.votes.length;
                const userHasVoted = user && p.votes.some(v => v.user_id === user.id);

                return (
                  <motion.div key={p.id} variants={itemVariants}>
                    <Card className={`hover:border-primary/50 transition-colors duration-300 ${!hasVerificationNft ? 'blur-sm' : ''}`}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-muted-foreground">Proposal #{p.id.substring(0, 4)}...</p>
                            <CardTitle className="mt-1 text-lg">{p.title}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            {statusInfo.icon}
                            <span>{statusInfo.text}</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground line-clamp-2">{p.description}</p>
                      </CardContent>
                      <CardFooter className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">{voteCount} {voteCount === 1 ? 'Vote' : 'Votes'}</p>
                        {p.status === 'active' && (
                          <Button variant={userHasVoted ? "secondary" : "default"} onClick={() => openVoteModal(p)}>
                            {userHasVoted ? 'Update Vote' : 'Vote Now'}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>

          <Dialog open={isVoteModalOpen} onOpenChange={setVoteModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vote on: {selectedProposal?.title}</DialogTitle>
                <DialogDescription>Rank the options by dragging them. Your most preferred option should be at the top.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={rankedChoices} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {rankedChoices.map((option, index) => (
                        <SortableItem key={option} id={option}>
                          <span className="font-bold mr-2">{index + 1}.</span>
                          <span>{option}</span>
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
              <DialogFooter>
                <Button onClick={handleVoteSubmit} disabled={voteLoading}>
                  {voteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Vote'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      );
    };

    export default Proposals;