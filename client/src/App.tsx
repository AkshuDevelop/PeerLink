/**
 * ============================================================
 * FILE PURPOSE:
 *   Root App component for PeerLink.
 *   Sets up React Router, AuthProvider, TransferProvider,
 *   persistent Header and Footer, and global modals.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Root Component
 * ============================================================
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { IncomingRequestModal } from './components/IncomingRequestModal';
import { PairPinModal } from './components/PairPinModal';

// Pages
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { DashboardPage } from './pages/DashboardPage';
import { PeersPage } from './pages/PeersPage';
import { AddPeerPage } from './pages/AddPeerPage';
import { SendFilePage } from './pages/SendFilePage';
import { ActiveTransferPage } from './pages/ActiveTransferPage';
import { TransferResultPage } from './pages/TransferResultPage';
import { TransferDetailsPage } from './pages/TransferDetailsPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-cream text-ink">
      <Header />

      <main className="flex-grow flex flex-col w-full relative" id="router-viewport">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/peers" element={<PeersPage />} />
          <Route path="/peers/add" element={<AddPeerPage />} />
          <Route path="/send" element={<SendFilePage />} />
          <Route path="/transfer/:id" element={<ActiveTransferPage />} />
          <Route path="/transfer/:id/result" element={<TransferResultPage />} />
          <Route path="/transfer/:id/details" element={<TransferDetailsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />

      {/* Global Modals & Notifications */}
      <IncomingRequestModal />
      <PairPinModal />
      <Toast />
    </div>
  );
};
