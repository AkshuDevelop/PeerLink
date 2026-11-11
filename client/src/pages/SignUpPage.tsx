/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 3 — Sign Up Page matching code.html Lines 1277–1317.
 *   Split Ink/Cream card with EMAIL, PROPOSED HANDLE, and PASSPHRASE.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTransfer } from '../context/TransferContext';

export const SignUpPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const { user, register, loginGuest, logout } = useAuth();
  const { showToast, disconnectAllPeers } = useTransfer();
  const navigate = useNavigate();

  const handleGuest = async () => {
    try {
      setIsGuestLoading(true);
      setError(null);
      await loginGuest();
      showToast('⚡ INSTANT GUEST NODE INITIALIZED.');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'GUEST INITIALIZATION FAILED');
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await register(email, handle, password);
      showToast('NODE KEY GENERATED & PROVISIONED.');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'REGISTRATION FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="w-full bg-cobalt text-cream py-14 flex-grow flex items-center justify-center p-4">
      <div className="w-full max-w-[840px] border-2 border-ink bg-cream text-ink hard-shadow-ink grid grid-cols-1 md:grid-cols-2">
        <div className="p-8 bg-ink text-cream flex flex-col justify-between border-b-2 md:border-b-0 md:border-r-2 border-ink">
          <div>
            <span className="text-[12px] font-mono font-[700] text-coral uppercase tracking-widest">// INITIALIZE IDENTITY</span>
            <h2 className="text-[44px] font-[800] uppercase tracking-tight text-cream mt-2 leading-none">ONE HANDLE</h2>
            <p className="text-[14px] font-mono text-sand mt-4">
              // ONE HANDLE. THAT IS HOW A PEER FINDS YOU. Deterministic node credentials generated purely for P2P connection.
            </p>
          </div>
          <div className="border-t border-cream-hairline pt-4 mt-8 font-mono text-[12px] text-sand">
            ALREADY PROVISIONED? <Link to="/signin" className="text-coral font-[700] underline ml-1">SIGN IN →</Link>
          </div>
        </div>

        <div className="p-8 flex flex-col justify-center gap-4 font-mono">
          <h3 className="text-[20px] font-[800] uppercase">INITIALIZE NODE</h3>

          {user && (
            <div className="border-2 border-ink bg-sand p-3.5 flex flex-col gap-2 hard-shadow-ink text-[12px]">
              <div className="flex items-center justify-between">
                <span className="font-[800] text-cobalt flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">account_circle</span>
                  ACTIVE: @{user.handle}
                </span>
                <span className="text-[10px] font-[800] bg-coral/30 px-1.5 py-0.5 border border-ink">
                  {user.handle.startsWith('guest_') ? 'GUEST NODE' : 'SIGNED IN'}
                </span>
              </div>
              <p className="text-[11px] text-ink-muted">
                You are currently running an active session. Log out to initialize a new operator node.
              </p>
              <button
                type="button"
                onClick={() => {
                  disconnectAllPeers();
                  logout();
                  showToast('LOGGED OUT OF SESSION. READY TO SIGN UP.');
                }}
                className="mt-1 h-8 px-3 rounded-full border-2 border-ink bg-coral text-ink font-[800] text-[11px] uppercase hard-shadow-coral hover:bg-cream transition-colors self-start inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px]">logout</span>
                LOG OUT / SWITCH
              </button>
            </div>
          )}

          {error && (
            <div className="border border-coral bg-coral/10 p-3 text-[12px] text-coral font-[700]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-[700] uppercase block mb-1">EMAIL</label>
              <input
                type="email"
                required
                placeholder="node@domain.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 border-2 border-ink bg-sand px-3 font-[700] focus:border-cobalt focus:ring-0"
              />
            </div>
            <div>
              <label className="text-[11px] font-[700] uppercase block mb-1">PROPOSED HANDLE</label>
              <input
                type="text"
                required
                placeholder="pilot_echo"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                className="w-full h-11 border-2 border-ink bg-sand px-3 font-[700] focus:border-cobalt focus:ring-0"
              />
              <span className="text-[10px] text-ink-muted">3-20 chars · letters, numbers, dot, underscore</span>
            </div>
            <div>
              <label className="text-[11px] font-[700] uppercase block mb-1">PASSPHRASE</label>
              <input
                type="password"
                required
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 border-2 border-ink bg-sand px-3 font-[700] focus:border-cobalt focus:ring-0"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || isGuestLoading}
              className="h-11 mt-2 rounded-full border-2 border-ink bg-coral text-ink font-[700] text-[13px] uppercase hard-shadow-coral hover:bg-sand transition-colors"
            >
              {isLoading ? 'INITIALIZING...' : 'INITIALIZE NODE'}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-ink/20 w-full"></div>
            <span className="bg-cream px-2 text-[10px] text-ink-muted uppercase tracking-wider font-bold shrink-0">
              OR ZERO-SIGNUP
            </span>
            <div className="border-t border-ink/20 w-full"></div>
          </div>

          <button
            type="button"
            onClick={handleGuest}
            disabled={isLoading || isGuestLoading}
            className="w-full h-11 rounded-full border-2 border-ink bg-sand text-ink font-[800] text-[11px] sm:text-[12px] uppercase hard-shadow-ink hover:bg-white transition-colors"
          >
            {isGuestLoading ? 'INITIALIZING GUEST...' : '⚡ CONTINUE AS INSTANT GUEST (1-CLICK, NO ACCOUNT)'}
          </button>
        </div>
      </div>
    </section>
  );
};
