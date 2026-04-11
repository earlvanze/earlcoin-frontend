import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import algosdk from 'algosdk';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { HeartHandshake as Handshake, UserCheck, Loader2, AlertCircle, Shield } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { algodClient } from '@/lib/algorand';
import { VOTE_DELEGATION_APP_ID } from '@/lib/config';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const truncateAddr = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';

// Read delegation from on-chain local state.
async function readDelegation(accountAddr) {
  if (!accountAddr || !VOTE_DELEGATION_APP_ID) return null;
  try {
    const info = await algodClient.accountInformation(accountAddr).do();
    const localStates = info?.['apps-local-state'] || [];
    const appState = localStates.find(
      (s) => Number(s.id) === VOTE_DELEGATION_APP_ID
    );
    if (!appState) return null;

    const kvs = appState['key-value'] || [];
    let delegate = null;
    let delegatedAt = null;

    for (const kv of kvs) {
      const key = atob(kv.key);
      if (key === 'delegate' && kv.value?.bytes) {
        // 32-byte raw address → encode to Algorand address string
        const raw = Uint8Array.from(atob(kv.value.bytes), (c) => c.charCodeAt(0));
        if (raw.length === 32) {
          delegate = algosdk.encodeAddress(raw);
        }
      }
      if (key === 'delegated_at' && kv.value?.uint !== undefined) {
        delegatedAt = kv.value.uint;
      }
    }

    if (!delegate) return null;
    return { address: delegate, round: delegatedAt };
  } catch {
    return null;
  }
}

const Delegate = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isConnected, accountAddress, handleConnect, signTransactions } = useAppContext();

  const [delegateAddress, setDelegateAddress] = useState('');
  const [currentDelegation, setCurrentDelegation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [inputError, setInputError] = useState('');

  // Load delegation from on-chain local state.
  const loadDelegation = useCallback(async () => {
    if (!accountAddress) {
      setCurrentDelegation(null);
      setOptedIn(false);
      setLoading(false);
      return;
    }
    try {
      const info = await algodClient.accountInformation(accountAddress).do();
      const localStates = info?.['apps-local-state'] || [];
      const appState = localStates.find(
        (s) => Number(s.id) === VOTE_DELEGATION_APP_ID
      );
      setOptedIn(!!appState);

      const delegation = await readDelegation(accountAddress);
      setCurrentDelegation(delegation);
    } catch (err) {
      console.error('Load delegation error:', err);
    } finally {
      setLoading(false);
    }
  }, [accountAddress]);

  useEffect(() => { loadDelegation(); }, [loadDelegation]);

  const validateAddress = useCallback((addr) => {
    if (!addr?.trim()) return 'Address is required';
    try {
      if (!algosdk.isValidAddress(addr)) return 'Enter a valid Algorand address';
    } catch {
      return 'Enter a valid Algorand address';
    }
    if (addr === accountAddress) return 'Cannot delegate to your own wallet';
    return '';
  }, [accountAddress]);

  // Opt-in to the delegation contract (required before first delegation).
  const handleOptIn = async () => {
    if (!isConnected || !accountAddress) return;
    setSubmitting(true);
    try {
      const params = await algodClient.getTransactionParams().do();
      const txn = algosdk.makeApplicationOptInTxnFromObject({
        from: accountAddress,
        appIndex: VOTE_DELEGATION_APP_ID,
        suggestedParams: params,
      });
      const signed = await signTransactions([[{ txn, signers: [accountAddress] }]]);
      await algodClient.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(algodClient, txn.txID(), 4);
      setOptedIn(true);
      toast({ title: 'Opted In', description: 'You can now delegate your voting power.' });
    } catch (err) {
      console.error('Opt-in failed:', err);
      toast({ variant: 'destructive', title: 'Opt-in Failed', description: err?.message || 'Could not opt into delegation contract.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Delegate: app call with delegate(raw_address_bytes).
  const handleDelegation = async (e) => {
    e.preventDefault();
    const addr = delegateAddress.trim().toUpperCase();
    const err = validateAddress(addr);
    if (err) {
      setInputError(err);
      toast({ variant: 'destructive', title: 'Invalid address', description: err });
      return;
    }
    setInputError('');

    if (!isConnected || !accountAddress) {
      toast({ variant: 'destructive', title: 'Wallet not connected' });
      return;
    }

    setSubmitting(true);
    try {
      // Decode the delegate address to raw 32 bytes for the contract.
      const decoded = algosdk.decodeAddress(addr);
      const params = await algodClient.getTransactionParams().do();
      const txn = algosdk.makeApplicationCallTxnFromObject({
        from: accountAddress,
        appIndex: VOTE_DELEGATION_APP_ID,
        appArgs: [
          new TextEncoder().encode('delegate'),
          decoded.publicKey,
        ],
        suggestedParams: params,
      });

      const signed = await signTransactions([[{ txn, signers: [accountAddress] }]]);
      await algodClient.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(algodClient, txn.txID(), 4);

      await loadDelegation();
      setDelegateAddress('');
      toast({
        title: 'Vote Delegated On-Chain',
        description: `Voting power delegated to ${truncateAddr(addr)}. Stored in smart contract.`,
      });
    } catch (err) {
      console.error('Delegation failed:', err);
      toast({
        variant: 'destructive',
        title: 'Delegation Failed',
        description: err?.message || 'Could not complete delegation.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke: app call with revoke().
  const handleRevoke = async () => {
    if (!currentDelegation || !isConnected || !accountAddress) return;

    setRevoking(true);
    try {
      const params = await algodClient.getTransactionParams().do();
      const txn = algosdk.makeApplicationCallTxnFromObject({
        from: accountAddress,
        appIndex: VOTE_DELEGATION_APP_ID,
        appArgs: [new TextEncoder().encode('revoke')],
        suggestedParams: params,
      });

      const signed = await signTransactions([[{ txn, signers: [accountAddress] }]]);
      await algodClient.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(algodClient, txn.txID(), 4);

      setCurrentDelegation(null);
      toast({
        title: 'Delegation Revoked On-Chain',
        description: 'Your voting power has been returned to your wallet.',
      });
    } catch (err) {
      console.error('Revoke failed:', err);
      toast({
        variant: 'destructive',
        title: 'Revoke Failed',
        description: err?.message || 'Could not revoke delegation.',
      });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <PageTitle title="Delegate Voting Power" description="Delegate your vote to a trusted member or advisor." />

      <div className="mb-4 p-3 bg-secondary/30 rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-4 w-4 text-green-400 shrink-0" />
        Delegation is stored on-chain in smart contract {VOTE_DELEGATION_APP_ID}. Fully auditable, tamper-proof.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Handshake /> New Delegation</CardTitle>
              <CardDescription>Enter the Algorand address you wish to delegate your voting power to.</CardDescription>
            </CardHeader>
            <CardContent>
              {!isConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-yellow-400">
                    <AlertCircle className="h-4 w-4" />
                    Connect your wallet to delegate.
                  </div>
                  <Button onClick={handleConnect} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600">
                    Connect Wallet
                  </Button>
                </div>
              ) : !optedIn ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You need to opt into the delegation contract first. This is a one-time transaction.
                  </p>
                  <Button onClick={handleOptIn} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600" disabled={submitting}>
                    {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opting In...</> : 'Opt Into Delegation Contract'}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleDelegation} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="delegate-address">Delegate Address</Label>
                    <Input
                      id="delegate-address"
                      name="address"
                      placeholder="Enter Algorand wallet address..."
                      value={delegateAddress}
                      onChange={(e) => {
                        setDelegateAddress(e.target.value.toUpperCase());
                        if (inputError) setInputError('');
                      }}
                      className={`font-mono text-sm ${inputError ? 'border-red-500' : ''}`}
                    />
                    {inputError && <p className="text-xs text-red-400">{inputError}</p>}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
                    disabled={submitting || !delegateAddress.trim()}
                  >
                    {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Delegating...</> : 'Delegate Vote'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserCheck /> Current Delegation</CardTitle>
              <CardDescription>
                {currentDelegation
                  ? 'Your voting power is delegated on-chain. Revoke at any time.'
                  : 'No active delegation.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : currentDelegation ? (
                <>
                  <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
                    <p className="text-muted-foreground text-center text-sm">Delegated to:</p>
                    <p className="font-mono text-lg font-bold text-center break-all">
                      {truncateAddr(currentDelegation.address)}
                    </p>
                    {currentDelegation.round && (
                      <p className="text-xs text-muted-foreground text-center">
                        Since round {currentDelegation.round.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleRevoke}
                    variant="destructive"
                    className="w-full"
                    disabled={revoking || !isConnected}
                  >
                    {revoking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Revoking...</> : 'Revoke Delegation'}
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  You have not delegated your vote.
                  {!isConnected && <span className="block mt-1 text-xs">Connect your wallet to delegate.</span>}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Delegate;
