/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 2 — Sign In Page matching code.html Lines 1239–1274.
 *   Split Ink/Cream card with HANDLE OR EMAIL and KEY PASSPHRASE.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTransfer } from '../context/TransferContext';

export const SignInPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const { login, loginGuest } = useAuth();
  const { showToast } = useTransfer();
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
      await login(identifier, password);
      showToast('NODE AUTHENTICATED.');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'AUTHENTICATION FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="w-full bg-cobalt text-cream py-14 flex-grow flex items-center justify-center p-4">
      <div className="w-full max-w-[840px] border-2 border-ink bg-cream text-ink hard-shadow-ink grid grid-cols-1 md:grid-cols-2">
        <div className="p-8 bg-ink text-cream flex flex-col justify-between border-b-2 md:border-b-0 md:border-r-2 border-ink">
          <div>
            <span className="text-[12px] font-mono font-[700] text-coral uppercase tracking-widest">// AUTHENTICATION</span>
            <h2 className="text-[44px] font-[800] uppercase tracking-tight text-cream mt-2 leading-none">PEERLINK</h2>
            <p className="text-[14px] font-mono text-sand mt-4">
              Connect using your local operator handle. Credentials never leave your device unencrypted.
            </p>
          </div>
          <div className="border-t border-cream-hairline pt-4 mt-8 font-mono text-[12px] text-sand">
            NO NODE YET? <Link to="/signup" className="text-coral font-[700] underline ml-1">INITIALIZE ONE →</Link>
          </div>
        </div>

        <div className="p-8 flex flex-col justify-center gap-4 font-mono">
          <h3 className="text-[20px] font-[800] uppercase">CONNECT NODE</h3>

          {error && (
            <div className="border border-coral bg-coral/10 p-3 text-[12px] text-coral font-[700]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-[700] uppercase block mb-1">HANDLE OR EMAIL</label>
              <input
                type="text"
                required
                placeholder="operator_alpha"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full h-11 border-2 border-ink bg-sand px-3 font-[700] focus:border-cobalt focus:ring-0"
              />
            </div>
            <div>
              <label className="text-[11px] font-[700] uppercase block mb-1">KEY PASSPHRASE</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
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
              {isLoading ? 'CONNECTING...' : 'CONNECT NODE'}
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
