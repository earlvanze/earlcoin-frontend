import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { useToast } from "@/components/ui/use-toast";
    import { Loader2 } from 'lucide-react';
    import PageTitle from '@/components/PageTitle';

    const Profile = () => {
      const { user } = useAuth();
      const { toast } = useToast();
      const [loading, setLoading] = useState(true);
      const [username, setUsername] = useState('');
      const [walletAddress, setWalletAddress] = useState('');

      useEffect(() => {
        const fetchProfile = async () => {
          if (user) {
            try {
              setLoading(true);
              const { data, error } = await supabase
                .from('profiles')
                .select('username, wallet_address')
                .eq('id', user.id)
                .single();

              if (error) throw error;

              if (data) {
                setUsername(data.username || '');
                setWalletAddress(data.wallet_address || '');
              }
            } catch (error) {
              toast({
                variant: "destructive",
                title: "Failed to load profile",
                description: error.message,
              });
            } finally {
              setLoading(false);
            }
          }
        };

        fetchProfile();
      }, [user, toast]);

      const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ username, wallet_address: walletAddress, updated_at: new Date().toISOString() })
            .eq('id', user.id);

          if (error) throw error;

          toast({
            title: "Profile Updated",
            description: "Your profile has been successfully updated.",
          });
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message,
          });
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
          <PageTitle title="My Profile" description="Manage your account details." />
          <div className="flex justify-center">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your username and wallet address.</CardDescription>
              </CardHeader>
              <form onSubmit={handleUpdateProfile}>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={user?.email || ''} disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" type="text" placeholder="Your username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="walletAddress">Wallet Address</Label>
                    <Input id="walletAddress" type="text" placeholder="Your Pera wallet address" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} />
                  </div>
                  <Button className="w-full mt-2" type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Update Profile'}
                  </Button>
                </CardContent>
              </form>
            </Card>
          </div>
        </motion.div>
      );
    };

    export default Profile;