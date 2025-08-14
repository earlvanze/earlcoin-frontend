import React from 'react';
    import { motion } from 'framer-motion';
    import PageTitle from '@/components/PageTitle';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { useAppContext } from '@/contexts/AppContext';
    import { Button } from '@/components/ui/button';
    import { Bell, Check, Trash2 } from 'lucide-react';

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
    };

    const itemVariants = {
      hidden: { x: -20, opacity: 0 },
      visible: { x: 0, opacity: 1 },
    };

    const Notifications = () => {
      const { notifications, setNotifications } = useAppContext();

      const markAsRead = (id) => {
        setNotifications(
          notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
      };

      const clearAll = () => {
        setNotifications([]);
      };

      return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <div className="flex justify-between items-center mb-8">
            <PageTitle title="Notifications" description="All your DAO alerts and updates in one place." />
            <motion.div variants={itemVariants}>
              <Button onClick={clearAll} variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" /> Clear All
              </Button>
            </motion.div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border/20">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      variants={itemVariants}
                      className={`flex items-center justify-between p-4 transition-colors ${
                        notification.read ? 'opacity-60' : 'bg-secondary/30'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${notification.read ? 'bg-muted' : 'bg-primary/20'}`}>
                          <Bell className={`h-5 w-5 ${notification.read ? 'text-muted-foreground' : 'text-primary'}`} />
                        </div>
                        <div>
                          <p className="font-semibold">{notification.title}</p>
                          <p className="text-sm text-muted-foreground">{notification.description}</p>
                        </div>
                      </div>
                      {!notification.read && (
                        <Button onClick={() => markAsRead(notification.id)} variant="ghost" size="sm">
                          <Check className="mr-2 h-4 w-4" /> Mark as read
                        </Button>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="mx-auto h-12 w-12 mb-4" />
                    <p>You're all caught up!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    };

    export default Notifications;