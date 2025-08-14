import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { useToast } from "@/components/ui/use-toast";
    import { useNavigate, Link } from 'react-router-dom';
    import { Loader2 } from 'lucide-react';
    import PageTitle from '@/components/PageTitle';
    import SocialLogins from '@/components/SocialLogins';

    const Signup = () => {
      const { signUp } = useAuth();
      const [email, setEmail] = useState('');
      const [password, setPassword] = useState('');
      const [loading, setLoading] = useState(false);
      const { toast } = useToast();
      const navigate = useNavigate();

      const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          const { error } = await signUp(email, password);
          if (error) {
            throw error;
          }
          toast({
            title: "Account Created!",
            description: "Please check your email to verify your account.",
          });
          navigate('/login');
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Signup Failed",
            description: error.message || "An unexpected error occurred.",
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
          <PageTitle title="Sign Up" description="Create a new account to join the DAO." />
          <div className="flex justify-center">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Sign Up</CardTitle>
                <CardDescription>
                  Enter your information to create an account.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSignup}>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button className="w-full mt-2" type="submit" disabled={loading}>
                     {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign Up'}
                  </Button>
                </CardContent>
              </form>
              <CardContent>
                <SocialLogins type="sign up" />
              </CardContent>
              <CardFooter className="flex justify-center">
                   <p className="text-xs text-center text-muted-foreground">
                      Already have an account?{' '}
                      <Link to="/login" className="underline underline-offset-4 hover:text-primary">
                        Login
                      </Link>
                    </p>
              </CardFooter>
            </Card>
          </div>
        </motion.div>
      );
    };

    export default Signup;