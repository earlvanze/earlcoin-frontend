import React, { useState, useRef, useEffect } from 'react';
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
    import { PlusCircle, XCircle, Loader2, Sparkles, FileText, Building, DollarSign, Settings } from 'lucide-react';
    import { v4 as uuidv4 } from 'uuid';
    import algosdk from 'algosdk';
    import { ALGOD_URL, EARL_ASA_ID, GOV_APP_ID } from '@/lib/config';
    import { usePortfolioData } from '@/hooks/usePortfolioData';

    // Proposal templates with auto-generated reasoning
    const proposalTemplates = [
      {
        id: 'property-acquisition',
        name: 'Property Acquisition',
        icon: Building,
        color: 'text-blue-400',
        generate: (portfolioData) => {
          const avgCapRate = portfolioData?.properties?.reduce((sum, p) => sum + (p.capRate || 0), 0) / (portfolioData?.properties?.length || 1);
          const avgApy = portfolioData?.properties?.reduce((sum, p) => sum + (p.apy7d || 0), 0) / (portfolioData?.properties?.length || 1);
          return {
            title: 'Acquire [Property Address]',
            description: `## Summary
Proposal to acquire [PROPERTY ADDRESS], a [X]BR/[X]BA property in [CITY, STATE].

## Property Details
- **Purchase Price:** $[XXX,XXX]
- **Monthly Rent:** $[X,XXX]
- **Cap Rate:** [X.X]% (portfolio avg: ${avgCapRate.toFixed(1)}%)
- **Projected APY:** [X.X]% (portfolio avg: ${avgApy.toFixed(1)}%)

## Financing
- DAO contribution: $[XXX,XXX] (XX%)
- External financing: $[XXX,XXX] (XX%)

## Rationale
This acquisition ${avgCapRate > 6 ? 'would bring our average cap rate up' : 'maintains our strong yield profile'} while diversifying our geographic footprint. The property offers:

1. **Strong cash flow** - Rent-to-price ratio of [X.X]%
2. **Market growth** - [CITY] showing [X]% YoY appreciation
3. **Portfolio fit** - Adds ${portfolioData?.stateCount ? `to our presence in ${portfolioData.stateCount} states` : 'geographic diversification'}

## Risk Assessment
- Vacancy risk: LOW/MEDIUM/HIGH
- Capex reserves: $[X,XXX] allocated
- Property condition: [DESCRIPTION]

## Vote Options
Please vote on whether to proceed with this acquisition.`,
            options: [
              { id: uuidv4(), text: 'Approve Acquisition' },
              { id: uuidv4(), text: 'Reject' },
              { id: uuidv4(), text: 'Request More Due Diligence' }
            ],
            voteDuration: '168' // 7 days
          };
        }
      },
      {
        id: 'treasury-action',
        name: 'Treasury Action',
        icon: DollarSign,
        color: 'text-green-400',
        generate: (portfolioData) => {
          const grossValue = portfolioData?.totalGross || 0;
          const propertyCount = portfolioData?.propertyCount || 0;
          return {
            title: 'Q[X] 2026 Treasury Action: [Description]',
            description: `## Summary
Proposal regarding DAO treasury management and capital allocation.

## Current Treasury Status
- **Gross Portfolio Value:** $${grossValue.toLocaleString()}
- **Property Count:** ${propertyCount} properties
- **Action Requested:** [DESCRIBE ACTION]

## Proposed Action
[Describe the specific treasury action - dividend distribution, reserve allocation, liquidity provision, etc.]

### Financial Impact
| Metric | Before | After |
|--------|--------|-------|
| Treasury Balance | $[XXX] | $[XXX] |
| Reserve Ratio | [X]% | [X]% |
| Token Holder Yield | [X]% | [X]% |

## Rationale
This action ${propertyCount > 20 ? 'reflects our growing portfolio' : 'positions us for growth'} while maintaining:

1. **Adequate reserves** - [X] months operating expenses covered
2. **Holder returns** - Competitive yield vs alternatives
3. **Growth capacity** - Retained capital for opportunities

## Risk Considerations
- Market exposure: [ASSESSMENT]
- Liquidity impact: [ASSESSMENT]
- Reversibility: [ASSESSMENT]

## Implementation Timeline
- Vote closes: [DATE]
- Execution: [DATE]
- Distribution/Action: [DATE]`,
            options: [
              { id: uuidv4(), text: 'Approve' },
              { id: uuidv4(), text: 'Modify Amount' },
              { id: uuidv4(), text: 'Defer to Next Quarter' },
              { id: uuidv4(), text: 'Reject' }
            ],
            voteDuration: '72' // 3 days
          };
        }
      },
      {
        id: 'governance-change',
        name: 'Governance Change',
        icon: Settings,
        color: 'text-purple-400',
        generate: (portfolioData) => {
          return {
            title: 'Governance: [Change Description]',
            description: `## Summary
Proposal to modify DAO governance parameters or operational procedures.

## Current State
[Describe current governance structure/parameter]

## Proposed Change
[Describe the specific change being proposed]

### Comparison
| Aspect | Current | Proposed |
|--------|---------|----------|
| [Parameter] | [Value] | [Value] |
| [Parameter] | [Value] | [Value] |

## Rationale
This change improves DAO operations by:

1. **Efficiency** - [How this improves efficiency]
2. **Transparency** - [How this improves transparency]
3. **Alignment** - [How this aligns incentives]

## Implementation
- Smart contract changes: [YES/NO]
- Timeline: [DESCRIPTION]
- Reversibility: [DESCRIPTION]

## Community Feedback
[Summary of any pre-proposal discussion]

## Risks
- Unintended consequences: [ASSESSMENT]
- Implementation complexity: [ASSESSMENT]`,
            options: [
              { id: uuidv4(), text: 'Approve Change' },
              { id: uuidv4(), text: 'Approve with Modifications' },
              { id: uuidv4(), text: 'Reject' }
            ],
            voteDuration: '120' // 5 days
          };
        }
      },
      {
        id: 'blank',
        name: 'Custom Proposal',
        icon: FileText,
        color: 'text-gray-400',
        generate: () => ({
          title: '',
          description: '',
          options: [
            { id: uuidv4(), text: '' },
            { id: uuidv4(), text: '' }
          ],
          voteDuration: '72'
        })
      }
    ];

    const CreateProposal = () => {
        const [title, setTitle] = useState('');
        const [description, setDescription] = useState('');
        const [options, setOptions] = useState([{ id: uuidv4(), text: '' }, { id: uuidv4(), text: '' }]);
        const [loading, setLoading] = useState(false);
        const [voteDurationHours, setVoteDurationHours] = useState('72');
        const [proposalFile, setProposalFile] = useState(null);
        const [selectedTemplate, setSelectedTemplate] = useState(null);
        const { user } = useAuth();
        const { accountAddress, signTransactions, handleConnect } = useAppContext();
        const navigate = useNavigate();
        const { toast } = useToast();
        const fileInputRef = useRef(null);
        const { data: portfolioData } = usePortfolioData();

        const handleSelectTemplate = (template) => {
          setSelectedTemplate(template.id);
          const generated = template.generate(portfolioData);
          setTitle(generated.title);
          setDescription(generated.description);
          setOptions(generated.options);
          setVoteDurationHours(generated.voteDuration);
          toast({
            title: `Template loaded: ${template.name}`,
            description: 'Fields populated with template. Customize as needed.',
          });
        };

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
                        foreignAssets: [EARL_ASA_ID],
                        boxes: [
                            { appIndex: GOV_APP_ID, name: boxNameFor('p', nextId) },
                            { appIndex: GOV_APP_ID, name: boxNameFor('r', nextId) }
                        ],
                        suggestedParams
                    });

                    const signed = await signTransactions([[{ txn: appCallTxn, signers: [accountAddress] }]]);
                    const sendResult = await algodClient.sendRawTransaction(signed).do();
                    const txId = sendResult?.txId || sendResult;
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

                {/* Template Selection */}
                <Card className="max-w-4xl mx-auto mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-yellow-400" />
                            Quick Start Templates
                        </CardTitle>
                        <CardDescription>
                            Select a template to auto-generate proposal fields with portfolio-aware reasoning
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {proposalTemplates.map((template) => {
                                const Icon = template.icon;
                                const isSelected = selectedTemplate === template.id;
                                return (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => handleSelectTemplate(template)}
                                        className={`p-4 rounded-lg border-2 text-left transition-all hover:border-purple-500/50 hover:bg-accent/30 ${
                                            isSelected 
                                                ? 'border-purple-500 bg-purple-500/10' 
                                                : 'border-border/50 bg-card'
                                        }`}
                                    >
                                        <Icon className={`h-6 w-6 mb-2 ${template.color}`} />
                                        <p className="font-medium text-sm">{template.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {template.id === 'property-acquisition' && 'For new property purchases'}
                                            {template.id === 'treasury-action' && 'Dividends, reserves, allocation'}
                                            {template.id === 'governance-change' && 'Rules and parameters'}
                                            {template.id === 'blank' && 'Start from scratch'}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card className="max-w-4xl mx-auto">
                    <CardHeader>
                        <CardTitle>Proposal Details</CardTitle>
                        <CardDescription>Fill out the details below. Once submitted, it will be open for votes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="title" className="font-medium">Title</label>
                                <Input 
                                    id="title" 
                                    placeholder="E.g., Acquire 123 Main St, Denver CO" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)} 
                                    required 
                                    className="text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="description" className="font-medium">Description (Markdown supported)</label>
                                <Textarea 
                                    id="description" 
                                    placeholder="Provide a detailed explanation with rationale, financial analysis, and risk assessment..." 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)} 
                                    required 
                                    className="min-h-[300px] font-mono text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="voteDuration" className="font-medium">Voting Duration (hours)</label>
                                    <Input 
                                        id="voteDuration" 
                                        type="number" 
                                        min="1" 
                                        value={voteDurationHours} 
                                        onChange={(e) => setVoteDurationHours(e.target.value)} 
                                        required 
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {Number(voteDurationHours) > 0 && (
                                            <>≈ {(Number(voteDurationHours) / 24).toFixed(1)} days</>
                                        )}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="proposalFile" className="font-medium">Attach File (optional)</label>
                                    <Input id="proposalFile" type="file" ref={fileInputRef} onChange={(e) => setProposalFile(e.target.files?.[0] || null)} />
                                    <p className="text-xs text-muted-foreground">PDF, images, or documents</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="font-medium">Voting Options</label>
                                {options.map((option, index) => (
                                    <div key={option.id} className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                                        <Input
                                            placeholder={`Option ${index + 1} (e.g., "Approve", "Reject", "Defer")`}
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
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button type="button" variant="outline" onClick={() => navigate('/proposals')}>
                                    Cancel
                                </Button>
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
