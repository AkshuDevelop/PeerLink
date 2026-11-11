/**
 * ============================================================
 * FILE PURPOSE:
 *   React DOM Entry Point for PeerLink.
 *   Wraps the application in BrowserRouter, AuthProvider, and TransferProvider.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend Entry Point
 * ============================================================
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TransferProvider } from './context/TransferContext';
import { App } from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element in index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TransferProvider>
          <App />
        </TransferProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
