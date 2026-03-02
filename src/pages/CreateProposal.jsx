import React, { useState, useRef } from 'react';
    import { motion } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/AuthContext.jsx';
    import { useAppContext } from '@/contexts/AppContext.jsx';
    import PageTitle from '@/components/PageTitle';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { useToast } from '@/components/ui/use-toast';
    import { PlusCircle, XCircle, Loader2 } from 'lucide-react';
    import { v4 as uuidv4 } from 'uuid';
    import algosdk from 'algosdk';
    import { ALGOD_URL, EARL_ASA_ID, GOV_APP_ID } from '@/lib/config';
    import { normalizeTxId } from '@/lib/algorand';

    const CreateProposal = () => {
        const [title, setTitle] = useState('');
        const [description, setDescription] = useState('');
        const [options, setOptions] = useState([{ id: uuidv4(), text: '' }, { id: uuidv4(), text: '' }]);
        const [loading, setLoading] = useState(false);
        const [voteDurationHours, setVoteDurationHours] = useState('72');
        const [proposalFile, setProposalFile] = useState(null);
        const { user } = useAuth();
        const { accountAddress, signTransactions, handleConnect } = useAppContext();
        const navigate = useNavigate();
        const { toast } = useToast();
        const fileInputRef = useRef(null);

        const handleAddOption = () => {
            if (options.length < 10) {
                setOptions([...options, { id: uuidv4(), text: '' }]);
            }
        };

        const handleRemoveOption = (id) => {
            setOptions(options.filter(option => option.id !== id));
        };

        const handleOptionChange = (id, text) => {
            setOptions(options.map(option => (option.id === id ? { ...option, text } : option)));
        };

        const decodeGlobalState = (state = []) => {
            const decoded = {};
            state.forEach(({ key, value }) => {
                const k = atob(key);
                decoded[k] = value.type === 1 ? atob(value.bytes) : value.uint;
            });
            return decoded;
        };

        const encodeUint64 = (value) => {
            const bytes = new Uint8Array(8);
            const view = new DataView(bytes.buffer);
            view.setBigUint64(0, BigInt(value));
            return bytes;
        };

        const boxNameFor = (prefix, id) => {
            const prefixBytes = new TextEncoder().encode(prefix);
            const idBytes = encodeUint64(id);
            const out = new Uint8Array(prefixBytes.length + idBytes.length);
            out.set(prefixBytes, 0);
            out.set(idBytes, prefixBytes.length);
            return out;
        };

        const fetchNextId = async () => {
            const res = await fetch(`${ALGOD_URL}/v2/applications/${GOV_APP_ID}`);
            if (!res.ok) {
                throw new Error('Unable to fetch governance app state.');
            }
            const data = await res.json();
            const state = decodeGlobalState(data?.params?.['global-state'] || []);
            return Number(state.next_id || 0);
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!user) {
                toast({ variant: 'destructive', title: 'Not authenticated', description: 'You must be logged in to create a proposal.' });
                return;
            }

            const validOptions = options.filter(o => o.text.trim() !== '');
            if (title.trim() === '' || description.trim() === '' || validOptions.length < 2) {
                toast({ variant: 'destructive', title: 'Invalid input', description: 'Please fill in the title, description, and at least two options.' });
                return;
            }

            if (!voteDurationHours || Number(voteDurationHours) <= 0) {
                toast({ variant: 'destructive', title: 'Invalid duration', description: 'Set a valid voting duration.' });
                return;
            }

            setLoading(true);

            try {
                let filePath = null;
                let fileHashHex = null;

                if (proposalFile) {
                    const buffer = await proposalFile.arrayBuffer();
                    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    fileHashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

                    const fileKey = `${user.id}/${Date.now()}-${proposalFile.name}`;
                    const { error: uploadError } = await supabase.storage
                        .from('proposals')
                        .upload(fileKey, proposalFile);

                    if (uploadError) {
                        throw uploadError;
                    }
                    filePath = fileKey;
                }

                const nowTs = Math.floor(Date.now() / 1000);
                const durationSec = Math.floor(Number(voteDurationHours) * 3600);
                const startTs = nowTs;
                const endTs = nowTs + Math.max(1, durationSec);

                let onchainTxId = null;
                let onchainProposalId = null;

                if (GOV_APP_ID) {
                    if (!accountAddress) {
                        await handleConnect();
                    }
                    if (!accountAddress) {
                        throw new Error('Connect wallet to submit on-chain proposal.');
                    }

                    const algodClient = new algosdk.Algodv2('', ALGOD_URL, '');
                    const appInfo = await algodClient.getApplicationByID(GOV_APP_ID).do();
                    const state = decodeGlobalState(appInfo?.params?.['global-state'] || []);
                    const earlAsa = Number(state.earl_asa || EARL_ASA_ID);
                    let nextId = Number(state.next_id || 0);
                    if (!nextId) {
                        nextId = await fetchNextId();
                    }
                    if (!nextId) {
                        throw new Error('Unable to resolve next proposal id.');
                    }

                    const suggestedParams = await algodClient.getTransactionParams().do();
                    const encoder = new TextEncoder();
                    const hashBytes = fileHashHex
                        ? Uint8Array.from(fileHashHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)))
                        : new Uint8Array(32);

                    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
                        sender: accountAddress,
                        appIndex: GOV_APP_ID,
                        appArgs: [
                            encoder.encode('propose'),
                            hashBytes,
                            algosdk.encodeUint64(startTs),
                            algosdk.encodeUint64(endTs),
                            algosdk.encodeUint64(validOptions.length)
                        ],
                        foreignAssets: [earlAsa],
                        boxes: [
                            { appIndex: GOV_APP_ID, name: boxNameFor('p', nextId) },
                            { appIndex: GOV_APP_ID, name: boxNameFor('r', nextId) }
                        ],
                        suggestedParams
                    });

                    const signed = await signTransactions([[{ txn: appCallTxn, signers: [accountAddress] }]]);
                    const sendResult = await algodClient.sendRawTransaction(signed).do();
                    const txId = normalizeTxId(sendResult);
                    if (!txId) {
                        throw new Error('Transaction submission failed (missing txId).');
                    }
                    await algosdk.waitForConfirmation(algodClient, txId, 4);
                    onchainTxId = txId;
                    onchainProposalId = nextId;
                }

                const { error } = await supabase
                    .from('proposals')
                    .insert([{
                        title,
                        description,
                        author_id: user.id,
                        options: validOptions,
                        status: 'active',
                        file_path: filePath,
                        file_hash: fileHashHex,
                        vote_start_ts: startTs,
                        vote_end_ts: endTs,
                        onchain_tx_id: onchainTxId,
                        onchain_proposal_id: onchainProposalId
                    }]);

                if (error) {
                    throw error;
                }

                toast({ title: 'Proposal created!', description: 'Your proposal is now live for voting.' });
                navigate('/proposals');
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error creating proposal', description: error.message });
            } finally {
                setLoading(false);
            }
        };

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <PageTitle title="Create Proposal" description="Shape the future of the DAO by submitting a new proposal." />

                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle>New Proposal</CardTitle>
                        <CardDescription>Fill out the details below. Once submitted, it will be open for votes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="title" className="font-medium">Title</label>
                                <Input id="title" placeholder="E.g., Fund a new marketing campaign" value={title} onChange={(e) => setTitle(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="description" className="font-medium">Description</label>
                                <Textarea id="description" placeholder="Provide a detailed explanation of your proposal..." value={description} onChange={(e) => setDescription(e.target.value)} required />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="voteDuration" className="font-medium">Voting Duration (hours)</label>
                                    <Input id="voteDuration" type="number" min="1" value={voteDurationHours} onChange={(e) => setVoteDurationHours(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="proposalFile" className="font-medium">Attach File (optional)</label>
                                    <Input id="proposalFile" type="file" ref={fileInputRef} onChange={(e) => setProposalFile(e.target.files?.[0] || null)} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="font-medium">Voting Options</label>
                                {options.map((option, index) => (
                                    <div key={option.id} className="flex items-center gap-2">
                                        <Input
                                            placeholder={`Option ${index + 1}`}
                                            value={option.text}
                                            onChange={(e) => handleOptionChange(option.id, e.target.value)}
                                        />
                                        {options.length > 2 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveOption(option.id)}>
                                                <XCircle className="h-5 w-5 text-destructive" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                {options.length < 10 && (
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="mt-2">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                                    </Button>
                                )}
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : 'Submit Proposal'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        );
    };

    export default CreateProposal;