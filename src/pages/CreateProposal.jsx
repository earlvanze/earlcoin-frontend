import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, XCircle, Loader2, Sparkles, FileText, Building, DollarSign, Settings, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { usePortfolioData } from '@/hooks/usePortfolioData';

// Generate proposal from Lofty deal data
const generateFromDeal = (params, portfolioData) => {
    const type = params.get('type');
    const address = params.get('address') || '[Property Address]';
    const city = params.get('city') || '[City]';
    const state = params.get('state') || '[State]';
    const recommendation = params.get('recommendation') || '';
    const thesis = params.get('thesis') || '';
    const shares = params.get('shares') || '100';
    const tokenPrice = params.get('token_price') || '50';
    const propertyId = params.get('property_id') || '';
    
    const investmentAmount = (parseInt(shares) * parseFloat(tokenPrice)).toLocaleString();
    const avgCapRate = portfolioData?.properties?.reduce((sum, p) => sum + (p.capRate || 0), 0) / (portfolioData?.properties?.length || 1) || 5.5;

    if (type === 'equity') {
        const equityPotential = params.get('equity_potential') || '0';
        const navUpside = params.get('nav_upside') || '0';
        const discountToNav = params.get('discount_to_nav') || '0';
        
        return {
            title: `Acquire ${shares} tokens of ${address}`,
            description: `## Summary
Proposal to acquire ${shares} tokens of **${address}**, ${city}, ${state}.

## Investment Thesis
${thesis || recommendation || 'This property represents an equity opportunity for the DAO.'}

## Deal Analysis
- **Recommended Investment:** ${shares} tokens (~$${investmentAmount})
- **Discount to NAV:** ${parseFloat(discountToNav).toFixed(1)}%
- **Equity Potential:** $${parseInt(equityPotential).toLocaleString()}
- **NAV Convergence Upside:** $${parseInt(navUpside).toLocaleString()}

## Strategic Rationale
${recommendation?.includes('High') || recommendation?.includes('Strong') 
    ? 'This is a high-conviction equity play based on significant NAV discount.'
    : 'This property offers moderate equity appreciation potential.'}

**Compass Yield Rating:** ${recommendation}

## Portfolio Impact
- Current portfolio cap rate: ${avgCapRate.toFixed(1)}%
- Geographic diversification: Adds presence in ${state}

## Risk Assessment
- Market risk: NAV may not converge if market conditions deteriorate
- Liquidity risk: Tokens may be illiquid in short term
- Property-specific risk: Standard real estate risks apply

## Vote Options
Please vote on whether to proceed with this acquisition.`,
            options: [
                { id: uuidv4(), text: 'Approve Purchase' },
                { id: uuidv4(), text: 'Reject' },
                { id: uuidv4(), text: 'Defer - Request More Analysis' }
            ],
            voteDuration: '168',
            propertyId,
            dealType: 'equity'
        };
    } else {
        const coc = params.get('coc') || '0';
        const monthlyRent = params.get('monthly_rent') || '0';
        const netYield = params.get('net_yield') || '0';
        
        return {
            title: `Acquire ${shares} tokens of ${address}`,
            description: `## Summary
Proposal to acquire ${shares} tokens of **${address}**, ${city}, ${state} for cashflow.

## Investment Thesis
${thesis || recommendation || 'This property represents a cashflow opportunity for the DAO.'}

## Deal Analysis
- **Recommended Investment:** ${shares} tokens (~$${investmentAmount})
- **Cash on Cash Return:** ${parseFloat(coc).toFixed(1)}%
- **Monthly Rent:** $${parseInt(monthlyRent).toLocaleString()}
- **Net Yield:** ${parseFloat(netYield).toFixed(1)}%

## Strategic Rationale
${parseFloat(coc) > 8 
    ? 'This is a high-yield cashflow property exceeding our 8% CoC threshold.'
    : 'This property offers steady income generation for the DAO treasury.'}

**Compass Yield Rating:** ${recommendation}

## Portfolio Impact
- Current portfolio cap rate: ${avgCapRate.toFixed(1)}%
- Expected monthly income contribution: ~$${((parseInt(shares) / 1000) * parseInt(monthlyRent)).toFixed(0)}

## Risk Assessment
- Occupancy risk: Current status and vacancy history
- Rent sustainability: Market rent trends
- Property condition: Capex and maintenance considerations

## Vote Options
Please vote on whether to proceed with this acquisition.`,
            options: [
                { id: uuidv4(), text: 'Approve Purchase' },
                { id: uuidv4(), text: 'Reject' },
                { id: uuidv4(), text: 'Defer - Request More Analysis' }
            ],
            voteDuration: '168',
            propertyId,
            dealType: 'cashflow'
        };
    }
};

// Proposal templates
const proposalTemplates = [
    {
        id: 'property-acquisition',
        name: 'Property Acquisition',
        icon: Building,
        color: 'text-blue-400',
        generate: (portfolioData) => ({
            title: 'Acquire [Property Address]',
            description: `## Summary
Proposal to acquire [PROPERTY ADDRESS] in [CITY, STATE].

## Property Details
- **Purchase Price:** $[XXX,XXX]
- **Monthly Rent:** $[X,XXX]
- **Cap Rate:** [X.X]%
- **Projected CoC:** [X.X]%

## Investment Rationale
[Describe why this property is a good fit for the DAO portfolio]

## Risk Assessment
- Vacancy risk: [LOW/MEDIUM/HIGH]
- Capex reserves: $[X,XXX]

## Vote Options
Please vote on whether to proceed.`,
            options: [
                { id: uuidv4(), text: 'Approve Acquisition' },
                { id: uuidv4(), text: 'Reject' },
                { id: uuidv4(), text: 'Request More Due Diligence' }
            ],
            voteDuration: '168'
        })
    },
    {
        id: 'treasury-action',
        name: 'Treasury Action',
        icon: DollarSign,
        color: 'text-green-400',
        generate: () => ({
            title: 'Treasury Action: [Description]',
            description: `## Summary
Proposal regarding DAO treasury management.

## Proposed Action
[Describe the treasury action]

## Financial Impact
- Before: $[XXX]
- After: $[XXX]

## Rationale
[Why this action is beneficial]`,
            options: [
                { id: uuidv4(), text: 'Approve' },
                { id: uuidv4(), text: 'Modify' },
                { id: uuidv4(), text: 'Reject' }
            ],
            voteDuration: '72'
        })
    },
    {
        id: 'governance-change',
        name: 'Governance Change',
        icon: Settings,
        color: 'text-purple-400',
        generate: () => ({
            title: 'Governance: [Change Description]',
            description: `## Summary
Proposal to modify DAO governance.

## Current State
[Describe current state]

## Proposed Change
[Describe the change]

## Rationale
[Why this change is needed]`,
            options: [
                { id: uuidv4(), text: 'Approve Change' },
                { id: uuidv4(), text: 'Reject' }
            ],
            voteDuration: '120'
        })
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
    const [searchParams] = useSearchParams();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [options, setOptions] = useState([{ id: uuidv4(), text: '' }, { id: uuidv4(), text: '' }]);
    const [loading, setLoading] = useState(false);
    const [voteDurationHours, setVoteDurationHours] = useState('72');
    const [proposalFile, setProposalFile] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [propertyId, setPropertyId] = useState('');
    const [dealType, setDealType] = useState('');
    const [prefilled, setPrefilled] = useState(false);
    
    const { user, session } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const { data: portfolioData } = usePortfolioData();

    // Check for deal data in URL params on mount
    useEffect(() => {
        if (searchParams.get('type') && searchParams.get('address')) {
            const generated = generateFromDeal(searchParams, portfolioData);
            setTitle(generated.title);
            setDescription(generated.description);
            setOptions(generated.options);
            setVoteDurationHours(generated.voteDuration);
            setPropertyId(generated.propertyId || '');
            setDealType(generated.dealType || '');
            setPrefilled(true);
            
            toast({
                title: 'Proposal Pre-filled',
                description: `Loaded deal data for ${searchParams.get('address')}. Review and customize before submitting.`,
            });
        }
    }, [searchParams, portfolioData]);

    const handleSelectTemplate = (template) => {
        setSelectedTemplate(template.id);
        const generated = template.generate(portfolioData);
        setTitle(generated.title);
        setDescription(generated.description);
        setOptions(generated.options);
        setVoteDurationHours(generated.voteDuration);
        setPropertyId('');
        setDealType('');
        setPrefilled(false);
        toast({
            title: `Template: ${template.name}`,
            description: 'Fields populated. Customize as needed.',
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!user) {
            toast({ variant: 'destructive', title: 'Not authenticated', description: 'You must be logged in to create a proposal.' });
            return;
        }

        const validOptions = options.filter(o => o.text.trim() !== '');
        if (title.trim() === '' || description.trim() === '' || validOptions.length < 2) {
            toast({ variant: 'destructive', title: 'Invalid input', description: 'Please fill in title, description, and at least two options.' });
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

                if (uploadError) throw uploadError;
                filePath = fileKey;
            }

            const nowTs = Math.floor(Date.now() / 1000);
            const durationSec = Math.floor(Number(voteDurationHours) * 3600);
            const startTs = nowTs;
            const endTs = nowTs + Math.max(1, durationSec);

            // Create proposal in Supabase with 'draft' status (needs seconding per Robert's Rules)
            const { data: newProposal, error } = await supabase
                .from('proposals')
                .insert([{
                    title,
                    description,
                    author_id: user.id,
                    options: validOptions,
                    status: 'draft', // Robert's Rules: starts as draft, needs seconding
                    file_path: filePath,
                    file_hash: fileHashHex,
                    vote_start_ts: startTs,
                    vote_end_ts: endTs,
                    property_id: propertyId || null,
                    deal_type: dealType || null,
                }])
                .select()
                .single();

            if (error) throw error;

            toast({ 
                title: 'Proposal Created!', 
                description: 'Your proposal is now a draft. It needs to be seconded by another token holder before voting can begin.' 
            });
            navigate('/proposals');
        } catch (error) {
            console.error('Error creating proposal:', error);
            toast({ variant: 'destructive', title: 'Error creating proposal', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <PageTitle title="Create Proposal" description="Shape the future of the DAO. Proposals follow Robert's Rules - they need a second before voting." />

            {/* Robert's Rules Info */}
            <Card className="max-w-4xl mx-auto mb-6 border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="font-medium text-blue-400">Robert's Rules of Order</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                                Proposals follow a formal process: <strong>Draft</strong> → <strong>Seconded</strong> → <strong>Voting</strong> → <strong>Passed/Failed</strong>.
                                After you create this proposal, another token holder must "second" it before it can proceed to voting.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Pre-filled notice */}
            {prefilled && (
                <Card className="max-w-4xl mx-auto mb-6 border-green-500/30 bg-green-500/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Sparkles className="h-5 w-5 text-green-400" />
                            <div className="flex-1">
                                <span className="font-medium text-green-400">Pre-filled from Lofty Deal</span>
                                <span className="text-sm text-muted-foreground ml-2">
                                    Property: {searchParams.get('address')} | Type: {dealType}
                                </span>
                            </div>
                            {propertyId && (
                                <Badge variant="outline" className="text-xs">
                                    ID: {propertyId}
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Template Selection (only show if not pre-filled) */}
            {!prefilled && (
                <Card className="max-w-4xl mx-auto mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-yellow-400" />
                            Quick Start Templates
                        </CardTitle>
                        <CardDescription>
                            Select a template to auto-generate proposal fields
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
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>Proposal Details</CardTitle>
                    <CardDescription>Fill out the details below. Once submitted, it will need to be seconded before voting begins.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="title" className="font-medium">Title</label>
                            <Input 
                                id="title" 
                                placeholder="E.g., Acquire 100 tokens of 123 Main St" 
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
                            <Button type="submit" disabled={loading || !session}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : !session ? (
                                    'Login Required'
                                ) : (
                                    'Create Draft Proposal'
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default CreateProposal;
