import React from 'react';
    import Sidebar from '@/components/Sidebar';
    import Header from '@/components/Header';

    const Layout = ({ children }) => {
      return (
        <div className="min-h-screen flex bg-background text-foreground">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      );
    };

    export default Layout;