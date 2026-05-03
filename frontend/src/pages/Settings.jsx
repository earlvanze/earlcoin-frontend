import React from 'react';
    import { motion } from 'framer-motion';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Label } from '@/components/ui/label';
    import { Button } from '@/components/ui/button';
    import { useToast } from "@/components/ui/use-toast";
    import PageTitle from '@/components/PageTitle';
    import { Sun, Moon, Bell } from 'lucide-react';

    const Settings = () => {
        const { toast } = useToast();

        const showNotImplementedToast = () => {
            toast({
                title: "🚧 Feature Not Implemented",
                description: "This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
            });
        };

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="container mx-auto"
            >
                <PageTitle title="Settings" description="Customize your experience." />
                <div className="flex justify-center">
                    <Card className="w-full max-w-2xl">
                        <CardHeader>
                            <CardTitle>Application Settings</CardTitle>
                            <CardDescription>Adjust your preferences for the platform.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Appearance</h3>
                                <div className="flex items-center space-x-4 p-4 border rounded-lg">
                                    <Label>Theme</Label>
                                    <div className="flex-1" />
                                    <Button variant="outline" size="icon" onClick={showNotImplementedToast}>
                                        <Sun className="h-5 w-5" />
                                    </Button>
                                    <Button variant="secondary" size="icon" onClick={showNotImplementedToast}>
                                        <Moon className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Notifications</h3>
                                <div className="flex items-center space-x-4 p-4 border rounded-lg">
                                    <Bell className="h-5 w-5 text-muted-foreground" />
                                    <div className="flex-grow">
                                        <Label>Proposal Updates</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Receive email notifications for new proposals and status changes.
                                        </p>
                                    </div>
                                    <Button variant="outline" onClick={showNotImplementedToast}>Manage</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </motion.div>
        );
    };

    export default Settings;