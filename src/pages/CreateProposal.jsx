import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import PageTitle from '@/components/PageTitle';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { useToast } from '@/components/ui/use-toast';
    import { PlusCircle, XCircle, Loader2 } from 'lucide-react';

    const CreateProposal = () => {
      const { user } = useAuth();
      const navigate = useNavigate();
      const { toast } = useToast();
      const [title, setTitle] = useState('');
      const [description, setDescription] = useState('');
      const [options, setOptions] = useState(['', '']);
      const [loading, setLoading] = useState(false);

      const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
      };

      const addOption = () => {
        setOptions([...options, '']);
      };

      const removeOption = (index) => {
        if (options.length > 2) {
          const newOptions = options.filter((_, i) => i !== index);
          setOptions(newOptions);
        }
      };

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
          toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to create a proposal.' });
          return;
        }

        const finalOptions = options.filter(opt => opt.trim() !== '');
        if (finalOptions.length < 2) {
            toast({ variant: 'destructive', title: 'Invalid Options', description: 'Please provide at least two non-empty options.' });
            return;
        }

        setLoading(true);
        try {
          const { error } = await supabase.from('proposals').insert({
            title,
            description,
            options: finalOptions,
            author_id: user.id,
          });

          if (error) throw error;

          toast({ title: 'Proposal Created!', description: 'Your proposal has been successfully submitted.' });
          navigate('/proposals');
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error Creating Proposal', description: error.message });
        } finally {
          setLoading(false);
        }
      };

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="container mx-auto"
        >
          <PageTitle title="Create a New Proposal" description="Shape the future of the DAO by submitting your proposal." />
          <div className="flex justify-center">
            <Card className="w-full max-w-3xl">
              <CardHeader>
                <CardTitle>New Proposal Details</CardTitle>
                <CardDescription>Fill out the form below to submit your proposal for voting.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Proposal Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Invest in a new DeFi protocol" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide a detailed description of your proposal..." required />
                  </div>
                  <div className="space-y-4">
                    <Label>Voting Options (Ranked Choice)</Label>
                    {options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input value={option} onChange={(e) => handleOptionChange(index, e.target.value)} placeholder={`Option ${index + 1}`} required />
                        {options.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index)}>
                            <XCircle className="h-5 w-5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addOption}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                    </Button>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Proposal'}
                  </Button>
                </CardContent>
              </form>
            </Card>
          </div>
        </motion.div>
      );
    };

    export default CreateProposal;