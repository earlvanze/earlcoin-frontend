
import React from 'react';
    import { Bell, LogIn, LogOut, User, Settings as SettingsIcon, Wallet } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import {
      DropdownMenu,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuLabel,
      DropdownMenuSeparator,
      DropdownMenuTrigger,
    } from '@/components/ui/dropdown-menu';
    import { useAppContext } from '@/contexts/AppContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Link, useNavigate } from 'react-router-dom';
    import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

    const Header = () => {
      const { notifications, isConnected, accountAddress, handleConnect, handleDisconnect } = useAppContext();
      const { session, signOut } = useAuth();
      const user = session?.user;
      const navigate = useNavigate();

      return (
        <header className="flex items-center justify-end h-16 px-4 sm:px-6 lg:px-8 bg-background/70 backdrop-blur-lg border-b border-border/20 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-0 right-0 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length > 0 ? (
                  notifications.slice(0, 4).map((notification) => (
                    <DropdownMenuItem key={notification.id} className="flex flex-col items-start">
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">{notification.description}</p>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem>No new notifications</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/notifications" className="w-full text-center">View all notifications</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.name} />
                      <AvatarFallback>{user?.email?.[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  {isConnected && accountAddress ? (
                    <>
                      <DropdownMenuItem className="cursor-default" onSelect={(event) => event.preventDefault()}>
                        <Wallet className="mr-2 h-4 w-4" />
                        <span className="font-mono text-xs">{accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDisconnect}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Disconnect Wallet</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={handleConnect}>
                      <Wallet className="mr-2 h-4 w-4" />
                      <span>Connect Wallet</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                {isConnected && accountAddress ? (
                  <Button onClick={handleDisconnect} title="Disconnect wallet" variant="outline" size="sm" className="hidden md:flex gap-2">
                    <Wallet className="h-4 w-4" />
                    <span className="font-mono text-xs">{accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}</span>
                  </Button>
                ) : (
                  <Button onClick={handleConnect} variant="outline" size="sm" className="hidden md:flex">
                    <Wallet className="mr-2 h-4 w-4" /> Connect Wallet
                  </Button>
                )}
                <Button onClick={() => navigate('/login')} variant="outline" size="sm" className="hidden md:flex ml-2">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Button>
              </>
            )}
          </div>
        </header>
      );
    };

    export default Header;
