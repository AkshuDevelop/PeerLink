/**
 * ============================================================
 * FILE PURPOSE:
 *   Top Bar (Persistent Cobalt Band) + Mobile Bottom Navigation Bar.
 *   Provides full desktop nav on md: screens and a dedicated, tap-friendly
 *   bottom bar on mobile (< 768px) so phones NEVER need "Desktop Mode".
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Component
 * ============================================================
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTransfer } from '../context/TransferContext';

export const Header: React.FC = () => {
  const { user } = useAuth();
  const { pendingOffers, openPairModal, telemetry } = useTransfer();
  const location = useLocation();

  const getNavLinkClass = (navKey: string) => {
    let isActive = false;
    const path = location.pathname;

    if (navKey === 'TRANSFERS' && (path === '/dashboard' || path.startsWith('/send'))) {
      isActive = true;
    } else if (navKey === 'PEERS' && path.startsWith('/peers')) {
      isActive = true;
    } else if (navKey === 'TELEMETRY' && path.startsWith('/transfer')) {
      isActive = true;
    } else if (navKey === 'LOGS' && path.startsWith('/logs')) {
      isActive = true;
    }

    if (isActive) {
      return 'text-coral border-b-2 border-coral pb-1 font-bold';
    }
    return 'text-cream/80 hover:text-cream pb-1 transition-colors';
  };

  const getMobileTabClass = (pathPrefix: string) => {
    const isActive = location.pathname.startsWith(pathPrefix);
    return isActive
      ? 'text-coral font-[800] border-t-2 border-coral pt-1'
      : 'text-cream/80 hover:text-cream pt-1';
  };

  return (
    <>
      {/* ── Top Bar (Persistent Cobalt Band) ────────────────────────── */}
      <header className="h-[64px] sm:h-[72px] bg-cobalt text-cream border-b-2 border-ink sticky top-0 z-40" id="top-bar">
        <div className="max-w-[1240px] mx-auto px-3 sm:px-8 h-full flex justify-between items-center">
          {/* Left: Wordmark & Tag */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2 group">
              <span className="text-[17px] sm:text-[18px] font-[800] tracking-[-0.02em] uppercase text-cream">PEERLINK</span>
              <span className="bg-coral text-ink text-[9px] sm:text-[10px] font-mono font-[700] px-1 sm:px-1.5 py-0.5 border border-ink tracking-widest inline-block">
                V0.9.4
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-[13px] font-mono font-[700] uppercase tracking-wider pl-4 border-l border-cream/20" id="top-nav-links">
              <Link to="/dashboard" className={getNavLinkClass('TRANSFERS')}>TRANSFERS</Link>
              <Link to="/peers" className={getNavLinkClass('PEERS')}>PEERS</Link>
              <Link to={telemetry?.sessionCode ? `/transfer/${telemetry.sessionCode}` : '/dashboard'} className={getNavLinkClass('TELEMETRY')}>
                TELEMETRY
              </Link>
              <Link to="/logs" className={getNavLinkClass('LOGS')}>LOGS</Link>
            </nav>
          </div>

          {/* Right: Telemetry + Action Pills + Avatar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono font-[700] text-cream-muted pr-3 border-r border-cream/20">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-cream">hub</span> STUN:LIVE
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-cream">sync</span> 0.00% LOSS
              </span>
            </div>

            {/* PAIR CODE button — visible on ALL devices (mobile + desktop) */}
            <button
              onClick={openPairModal}
              className="inline-flex items-center justify-center h-[34px] sm:h-[38px] px-2.5 sm:px-4 rounded-full border-2 border-cream text-cream text-[11px] sm:text-[13px] font-[700] uppercase tracking-wider hover:bg-cream hover:text-cobalt transition-colors leading-none"
              title="Ephemeral 6-Digit Pair PIN"
            >
              PAIR PIN
            </button>

            {/* CONNECT PEER button */}
            <Link
              to="/peers/add"
              className="hidden xs:inline-flex inline-flex items-center justify-center h-[34px] sm:h-[38px] px-3 sm:px-4 rounded-full border-2 border-ink bg-coral text-ink text-[11px] sm:text-[13px] font-[700] uppercase tracking-wider hard-shadow-coral hover:bg-sand transition-colors leading-none"
            >
              + PEER
            </Link>

            {/* Request Chip */}
            {pendingOffers.length > 0 && (
              <Link
                to="/peers"
                id="request-chip"
                className="w-[22px] sm:w-[24px] h-[22px] sm:h-[24px] bg-coral text-ink border border-ink text-[11px] sm:text-[12px] font-[800] font-mono inline-flex items-center justify-center leading-none"
                title={`${pendingOffers.length} Pending Incoming Offer(s)`}
              >
                {pendingOffers.length}
              </Link>
            )}

            {/* User initials avatar block or Sign In/Up */}
            {user ? (
              <Link
                to="/settings"
                className="w-[34px] sm:w-[40px] h-[34px] sm:h-[40px] bg-sand text-ink border-2 border-ink inline-flex items-center justify-center font-mono font-[800] text-[13px] sm:text-[15px] avatar-hatch hover:border-cream leading-none"
                title={`Node ${user.handle} Settings`}
              >
                {user.avatar || 'PX'}
              </Link>
            ) : (
              <Link
                to="/signin"
                className="h-[34px] sm:h-[38px] px-3 sm:px-4 rounded-full border-2 border-cream text-cream text-[11px] sm:text-[13px] font-[700] uppercase hover:bg-cream hover:text-cobalt inline-flex items-center justify-center leading-none"
              >
                SIGN IN
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Dedicated Mobile Bottom Navigation Bar (< md screens) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink border-t-2 border-cream text-cream h-[58px] flex items-center justify-around font-mono text-[10px] font-[700] uppercase tracking-wider select-none shadow-2xl"
        aria-label="Mobile Navigation"
      >
        <Link
          to="/dashboard"
          className={`flex flex-col items-center justify-center flex-1 h-full ${getMobileTabClass('/dashboard')}`}
        >
          <span className="material-symbols-outlined text-[19px]">grid_view</span>
          <span>DASH</span>
        </Link>

        <Link
          to="/peers"
          className={`flex flex-col items-center justify-center flex-1 h-full relative ${getMobileTabClass('/peers')}`}
        >
          <span className="material-symbols-outlined text-[19px]">group</span>
          <span>PEERS</span>
          {pendingOffers.length > 0 && (
            <span className="absolute top-1.5 right-4 w-3.5 h-3.5 bg-coral text-ink text-[9px] font-[800] rounded-full inline-flex items-center justify-center">
              {pendingOffers.length}
            </span>
          )}
        </Link>

        <Link
          to="/send"
          className={`flex flex-col items-center justify-center flex-1 h-full ${getMobileTabClass('/send')}`}
        >
          <span className="material-symbols-outlined text-[19px]">send</span>
          <span>SEND</span>
        </Link>

        <button
          onClick={openPairModal}
          className="flex flex-col items-center justify-center flex-1 h-full text-cream/80 hover:text-coral pt-1"
        >
          <span className="material-symbols-outlined text-[19px]">pin</span>
          <span>PAIR PIN</span>
        </button>

        <Link
          to="/logs"
          className={`flex flex-col items-center justify-center flex-1 h-full ${getMobileTabClass('/logs')}`}
        >
          <span className="material-symbols-outlined text-[19px]">receipt_long</span>
          <span>LOGS</span>
        </Link>
      </nav>
    </>
  );
};
