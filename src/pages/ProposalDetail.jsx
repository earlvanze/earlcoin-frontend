import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import algosdk from 'algosdk';
import PageTitle from '@/components/PageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { useToast } from '@/components/ui/use-toast';
import { ALGOD_URL, GOV_APP_ID } from '@/lib/config';
import { normalizeTxId } from '@/lib/algorand';

const decodeGlobalState = (state = []) => {
  const decoded = {};
  state.forEach(({ key, value }) => {
    const k = atob(key);
    decoded[k] = value.type === 1 ? atob(value.bytes) : value.uint;
  });
  return decoded;
};

const boxNameFor = (prefix, id, sender = null) => {
  const prefixBytes = new TextEncoder().encode(prefix);
  const idBytes = algosdk.encodeUint64(id);
  const senderBytes = sender ? algosdk.decodeAddress(sender).publicKey : new Uint8Array(0);
  const out = new Uint8Array(prefixBytes.length + idBytes.length + senderBytes.length);
  out.set(prefixBytes, 0);
  out.set(idBytes, prefixBytes.length);
  out.set(senderBytes, prefixBytes.length + idBytes.length);
  return out;
};

const ProposalDetail = () => {
  const { proposalId } = useParams();
  const { user, session } = useAuth();
  const { isConnected, accountAddress, handleConnect, signTransactions, walletType } = useAppContext();
  const { toast } = useToast();

  const [proposal, setProposal] = useState(null);
  const [votes, setVotes] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmittedVote, setHasSubmittedVote] = useState(false);

  const totalVotes = useMemo(() => votes.reduce((sum, v) => sum + (v.votes || 0), 0), [votes]);
  const nowTs = Math.floor(Date.now() / 1000);
  const voteStarted = !proposal?.vote_start_ts || nowTs >= Number(proposal.vote_start_ts);
  const voteEnded = !!proposal?.vote_end_ts && nowTs > Number(proposal.vote_end_ts);
  const votingOpen = proposal?.status === 'active' && voteStarted && !voteEnded;

  const load = async () => {
    if (!proposalId) return;

    setLoading(true);
    try {
      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select('id, title, description, status, options, vote_start_ts, vote_end_ts, onchain_proposal_id, snapshot_hash, file_path, file_hash, author_id, created_at')
        .eq('id', proposalId)
        .single();

      if (proposalError) throw proposalError;
      setProposal(proposalData);

      const { data: voteRows, error: voteError } = await supabase
        .from('votes')
        .select('user_id, ranked_choices')
        .eq('proposal_id', proposalId);

      if (voteError) throw voteError;

      const options = Array.isArray(proposalData.options) ? proposalData.options : [];
      const counts = options.map((opt) => ({ ...opt, votes: 0 }));

      (voteRows || []).forEach((row) => {
        const choices = Array.isArray(row.ranked_choices) ? row.ranked_choices : [];
        choices.forEach((choice) => {
          const idx = counts.findIndex((o) => String(o.id) === String(choice));
          if (idx >= 0) counts[idx].votes += 1;
        });
      });

      setVotes(counts);

      if (user?.id) {
        const { data: myVote } = await supabase
          .from('votes')
          .select('ranked_choices')
          .eq('proposal_id', proposalId)
          .eq('user_id', user.id)
          .maybeSingle();

        const currentChoice = Array.isArray(myVote?.ranked_choices) ? myVote.ranked_choices[0] : null;
        setSelectedOptionId(currentChoice ?? null);
        setHasSubmittedVote(Boolean(currentChoice));
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to load proposal',
        description: err?.message || 'Unable to fetch proposal details.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, user?.id]);

  const submitVote = async () => {
    if (!session || !user) {
      toast({ variant: 'destructive', title: 'Not logged in', description: 'Please sign in to vote.' });
      return;
    }

    if (!proposal || !selectedOptionId) {
      toast({ variant: 'destructive', title: 'No option selected', description: 'Please select an option.' });
      return;
    }

    if (!votingOpen) {
      toast({ variant: 'destructive', title: 'Voting closed', description: 'This proposal is not in an active voting window.' });
      return;
    }

    setSubmitting(true);
    try {
      // On-chain vote (if proposal is mapped on-chain)
      if (GOV_APP_ID && proposal.onchain_proposal_id) {
        let wallet = accountAddress;
        if (!wallet) {
          wallet = await handleConnect();
        }
        if (!wallet) {
          throw new Error('Connect wallet to submit an on-chain vote.');
        }

        const options = Array.isArray(proposal.options) ? proposal.options : [];
        const choiceIndex = options.findIndex((o) => String(o.id) === String(selectedOptionId));
        if (choiceIndex < 0) {
          throw new Error('Invalid option selection.');
        }

        const algod = new algosdk.Algodv2('', ALGOD_URL, '');
        const appInfo = await algod.getApplicationByID(GOV_APP_ID).do();
        const state = decodeGlobalState(appInfo?.params?.['global-state'] || []);
        const earlAsa = Number(state.earl_asa || 0);

        const suggestedParams = await algod.getTransactionParams().do();
        const encoder = new TextEncoder();

        if (hasSubmittedVote) {
          throw new Error('This governance contract currently allows one on-chain vote per wallet. Re-voting is disabled.');
        }

        const voteTxn = algosdk.makeApplicationNoOpTxnFromObject({
          sender: wallet,
          appIndex: GOV_APP_ID,
          appArgs: [
            encoder.encode('vote'),
            algosdk.encodeUint64(Number(proposal.onchain_proposal_id)),
            algosdk.encodeUint64(choiceIndex),
          ],
          ...(earlAsa ? { foreignAssets: [earlAsa] } : {}),
          boxes: [
            { appIndex: GOV_APP_ID, name: boxNameFor('p', Number(proposal.onchain_proposal_id)) },
            { appIndex: GOV_APP_ID, name: boxNameFor('v', Number(proposal.onchain_proposal_id), wallet) },
          ],
          suggestedParams,
        });

        if (walletType === 'pera') {
          toast({ title: 'Open Pera Wallet', description: 'Approve the vote transaction in Pera.' });
        }

        const signed = await signTransactions([[{ txn: voteTxn, signers: [wallet] }]], { requiredSender: wallet });
        const sendResult = await algod.sendRawTransaction(signed).do();
        const txId = normalizeTxId(sendResult);
        if (!txId) {
          throw new Error('Vote transaction submission failed.');
        }
        await algosdk.waitForConfirmation(algod, txId, 4);
      }

      const { data: existingVote } = await supabase
        .from('votes')
        .select('proposal_id, user_id')
        .eq('proposal_id', proposal.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingVote) {
        if (proposal.onchain_proposal_id) {
          throw new Error('Vote already submitted for this on-chain proposal.');
        }
        const { error: updateErr } = await supabase
          .from('votes')
          .update({ ranked_choices: [selectedOptionId] })
          .eq('proposal_id', proposal.id)
          .eq('user_id', user.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('votes')
          .insert({
            proposal_id: proposal.id,
            user_id: user.id,
            ranked_choices: [selectedOptionId],
          });
        if (insertErr) throw insertErr;
      }

      toast({ title: 'Vote submitted', description: 'Your vote has been recorded.' });
      setHasSubmittedVote(true);
      await load();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Vote failed',
        description: err?.message || 'Unable to submit vote.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!proposal) {
    return <PageTitle title="Proposal not found" description="The requested proposal does not exist." />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageTitle
        title={proposal.title}
        description={`Status: ${proposal.status} • Created ${new Date(proposal.created_at).toLocaleString()}`}
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
            <CardDescription>
              Voting window: {proposal.vote_start_ts ? new Date(Number(proposal.vote_start_ts) * 1000).toLocaleString() : 'now'} → {proposal.vote_end_ts ? new Date(Number(proposal.vote_end_ts) * 1000).toLocaleString() : 'open'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{proposal.description}</p>
            {proposal.snapshot_hash && (
              <p className="text-xs text-muted-foreground mt-3 break-all">Snapshot hash: {proposal.snapshot_hash}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vote</CardTitle>
            <CardDescription>
              {votingOpen
                ? 'Select one option and submit your vote.'
                : 'Voting is currently closed or not yet started.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {votes.map((option) => {
              const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
              const isSelected = String(selectedOptionId) === String(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedOptionId(option.id)}
                  disabled={!votingOpen || submitting || (proposal.onchain_proposal_id && hasSubmittedVote)}
                  className={`w-full text-left rounded-md border p-3 transition ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span>{option.text}</span>
                    <span>{option.votes} votes ({percentage.toFixed(0)}%)</span>
                  </div>
                  <Progress value={percentage} />
                </button>
              );
            })}

            <div className="flex justify-between items-center pt-2">
              <div>
                <p className="text-sm text-muted-foreground">Total votes: {totalVotes}</p>
                {proposal.onchain_proposal_id && hasSubmittedVote && (
                  <p className="text-xs text-muted-foreground">On-chain vote already submitted for this wallet.</p>
                )}
              </div>
              <Button onClick={submitVote} disabled={!votingOpen || !selectedOptionId || submitting || (proposal.onchain_proposal_id && hasSubmittedVote)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Vote'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default ProposalDetail;
