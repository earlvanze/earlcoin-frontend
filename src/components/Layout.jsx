import React from 'react';
    import Sidebar from '@/components/Sidebar';
    import Header from '@/components/Header';

    const Layout = ({ children }) => {
      return (

        <div className="min-h-screen flex overflow-x-hidden bg-background text-foreground">
          <Sidebar />
          <div className="min-w-0 flex-1 flex flex-col">
            <Header />
            <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 md:pb-6 lg:p-8">

              {children}
            </main>
          </div>
        </div>
      );
    };

    export default Layout;