/**
 * ============================================================
 * FILE PURPOSE:
 *   Persistent Ink Footer matching code.html Lines 139–152.
 *   Provides protocol specifications links, status, and DISCONNECT ALL button.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Component
 * ============================================================
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTransfer } from '../context/TransferContext';

export const Footer: React.FC = () => {
  const { user, logout } = useAuth();
  const { disconnectAllPeers, showToast } = useTransfer();
  const navigate = useNavigate();

  const handleDisconnect = () => {
    if (window.confirm('DISCONNECT ALL PEERS: Terminate all WebRTC conduits immediately?')) {
      disconnectAllPeers();
    }
  };

  const handleLogout = () => {
    disconnectAllPeers();
    logout();
    showToast('SESSION TERMINATED. SIGNED OUT.');
    navigate('/signin');
  };

  return (
    <footer className="bg-ink text-cream border-t-2 border-ink mt-auto">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-4 font-mono text-[12px]">
        <div className="flex items-center gap-3">
          <span className="font-[800] uppercase text-[15px] tracking-tight">PEERLINK</span>
          <span className="text-sand/80">// DIRECT WEBRTC MESH // ZERO INTERMEDIARY</span>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sand/80 uppercase tracking-widest font-[700]">
          <Link to="/" className="hover:text-coral underline decoration-2">PROTOCOL SPEC</Link>
          <Link to="/dashboard" className="hover:text-coral underline decoration-2">STUN STATUS</Link>
          <Link to="/logs" className="hover:text-coral underline decoration-2">SHA-256 INTEGRITY</Link>
          <button
            onClick={handleDisconnect}
            className="text-sand hover:text-coral hover:underline decoration-2 uppercase font-[700]"
          >
            DISCONNECT ALL
          </button>
          {user && (
            <button
              onClick={handleLogout}
              className="text-coral hover:underline decoration-2 uppercase font-[700]"
              title="Log out of current session"
            >
              LOGOUT (@{user.handle})
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
