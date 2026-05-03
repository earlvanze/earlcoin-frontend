import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { Toaster } from '@/components/ui/toaster';
import { BrowserRouter } from 'react-router-dom';

const pendingRedirect = sessionStorage.getItem('earlcoin:redirect');
if (pendingRedirect) {
  sessionStorage.removeItem('earlcoin:redirect');
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (pendingRedirect !== current) {
    window.history.replaceState(null, '', pendingRedirect);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster />
    </BrowserRouter>
  </React.StrictMode>
);
