/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 12 — Settings Page matching code.html Lines 1151–1236.
 *   Provides:
 *     1. NODE PROFILE (local permanent nodeId, operator handle editing)
 *     2. NETWORK TRANSPORT (ICE/STUN checkboxes + real PROBE STUN button)
 *     3. POSTER APPEARANCE (Light, Dark, System mode switcher)
 *     4. BLOCKED NODES roster with unblock actions
 *     5. PURGE LOCAL WEBRTC LOGS (calling DELETE /api/transfers/purge/all)
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTransfer } from '../context/TransferContext';
import { api } from '../api/httpClient';
import { probeStun } from '../services/stunProbeService';
import type { Contact } from '../types/peerlink';

export const SettingsPage: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { showToast, disconnectAllPeers } = useTransfer();
  const navigate = useNavigate();

  const [handle, setHandle] = useState(user?.handle || '');
  const [allowLanHost, setAllowLanHost] = useState(user?.allowLanHost ?? true);
  const [isSavingHandle, setIsSavingHandle] = useState(false);
  const [stunProbeVal, setStunProbeVal] = useState('ROUND TRIP: 14MS (OPTIMAL)');
  const [isProbing, setIsProbing] = useState(false);
  const [blockedList, setBlockedList] = useState<Contact[]>([]);

  useEffect(() => {
    if (user?.handle) setHandle(user.handle);
    if (user?.allowLanHost !== undefined) setAllowLanHost(user.allowLanHost);

    // Fetch blocked contacts
    api.get<{ contacts: Contact[] }>('/api/contacts?status=BLOCKED')
      .then((res) => setBlockedList(res.contacts))
      .catch(console.error);
  }, [user]);

  const handleSaveHandle = async () => {
    setIsSavingHandle(true);
    try {
      await updateProfile({ handle, allowLanHost });
      showToast('OPERATOR HANDLE & NETWORK PREFERENCES SAVED.');
    } catch (err: any) {
      showToast(err.message || 'FAILED TO SAVE HANDLE');
    } finally {
      setIsSavingHandle(false);
    }
  };

  const handleProbeStun = async () => {
    setIsProbing(true);
    setStunProbeVal('PROBING RFC 8489 STUN...');
    const res = await probeStun();
    if (res.success) {
      setStunProbeVal(`ROUND TRIP: ${res.rttMs}MS (${res.reflexiveIp})`);
      showToast('STUN SERVER RTT MEASURED.');
    } else {
      setStunProbeVal(`PROBE ERROR: ${res.error || 'UNREACHABLE'}`);
    }
    setIsProbing(false);
  };

  const handleSetMode = (mode: 'LIGHT' | 'DARK' | 'SYSTEM') => {
    if (mode === 'DARK') {
      document.documentElement.classList.add('dark');
      showToast('DARK POSTER MODE ACTIVE.');
    } else if (mode === 'LIGHT') {
      document.documentElement.classList.remove('dark');
      showToast('LIGHT POSTER MODE ACTIVE.');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      showToast('SYSTEM APPEARANCE ACTIVE.');
    }
  };

  const handleUnblock = async (contactId: string) => {
    try {
      await api.delete(`/api/contacts/${contactId}/block`);
      showToast('PEER RESTORED.');
      setBlockedList((prev) => prev.filter((c) => c._id !== contactId));
    } catch (err: any) {
      showToast(err.message || 'FAILED TO UNBLOCK');
    }
  };

  const handlePurgeAllLogs = async () => {
    if (!window.confirm('PURGE EVERYTHING: Erase all transmission logs from server memory?')) return;
    try {
      await api.delete('/api/transfers/purge/all');
      showToast('ALL AUDIT REGISTERS PURGED.');
    } catch (err: any) {
      showToast(err.message || 'FAILED TO PURGE LOGS');
    }
  };

  const handleLogout = () => {
    disconnectAllPeers();
    logout();
    showToast('SESSION TERMINATED. SIGNED OUT.');
    navigate('/signin');
  };

  return (
    <section className="w-full bg-cream text-ink py-12 pb-24 md:pb-12 flex-grow overflow-x-hidden">
      <div className="max-w-[760px] mx-auto px-4 sm:px-8 flex flex-col gap-8">
        <div className="border-b-2 border-ink pb-4">
          <span className="text-[12px] font-mono font-[700] uppercase tracking-widest text-ink-muted">
            // OPERATOR CONFIGURATION
          </span>
          <h2 className="text-[40px] md:text-[56px] font-[800] uppercase tracking-tight leading-none mt-1">
            SETTINGS
          </h2>
        </div>

        {/* 1. Node Profile */}
        <div className="border-2 border-ink bg-cream p-6 flex flex-col gap-4 hard-shadow-ink">
          <span className="text-[16px] font-[800] uppercase font-mono">1. NODE PROFILE</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[13px]">
            <div>
              <label className="text-[11px] font-[700] uppercase text-ink-muted block mb-1">
                LOCAL NODE ID (PERMANENT)
              </label>
              <input
                type="text"
                readOnly
                value={user?.nodeId || 'NODE-77-DELTA'}
                className="w-full h-11 border-2 border-ink bg-sand px-3 font-[700]"
              />
            </div>
            <div>
              <label className="text-[11px] font-[700] uppercase text-ink-muted block mb-1">
                OPERATOR HANDLE
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                className="w-full h-11 border-2 border-ink bg-sand px-3 font-[700] focus:border-cobalt focus:ring-0"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-sand border-2 border-ink flex items-center justify-center font-mono font-[800] text-[18px] avatar-hatch">
                {user?.avatar || 'PX'}
              </div>
              <p className="text-[12px] font-mono text-ink-muted">
                Deterministic avatar initial generated from operator credentials.
              </p>
            </div>
            <button
              onClick={handleSaveHandle}
              disabled={isSavingHandle}
              className="h-10 px-6 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[12px] uppercase hard-shadow-coral hover:bg-sand"
            >
              {isSavingHandle ? 'SAVING...' : 'SAVE HANDLE'}
            </button>
          </div>
        </div>

        {/* 2. Network Transport */}
        <div className="border-2 border-ink bg-cream p-6 flex flex-col gap-4 font-mono text-[13px]">
          <span className="text-[16px] font-[800] uppercase">2. NETWORK TRANSPORT (ICE / STUN)</span>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowLanHost}
              onChange={(e) => setAllowLanHost(e.target.checked)}
              className="w-5 h-5 border-2 border-ink text-cobalt focus:ring-0 rounded-none"
            />
            <span className="font-[700]">ALLOW DIRECT LAN HOST CANDIDATES (ENABLES WI-FI / LOCAL TRANSFER)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked
              readOnly
              className="w-5 h-5 border-2 border-ink text-cobalt focus:ring-0 rounded-none"
            />
            <span className="font-[700]">REFLEXIVE STUN: stun:stun.l.google.com:19302</span>
          </label>
          <div className="border-t-2 border-ink pt-3 flex justify-between items-center">
            <button
              onClick={handleProbeStun}
              disabled={isProbing}
              className="h-9 px-4 rounded-full border-2 border-ink bg-sand font-[700] uppercase hover:bg-cream"
            >
              {isProbing ? 'PROBING...' : 'PROBE STUN'}
            </button>
            <span id="stun-probe-val" className="text-[11px] text-cobalt font-[700]">
              {stunProbeVal}
            </span>
          </div>
        </div>

        {/* 3. Poster Appearance */}
        <div className="border-2 border-ink bg-cream p-6 flex flex-col gap-3 font-mono">
          <span className="text-[16px] font-[800] uppercase">3. POSTER APPEARANCE</span>
          <div className="flex flex-wrap gap-2 text-[12px] font-[700]">
            <button
              onClick={() => handleSetMode('LIGHT')}
              className="px-5 py-2 border-2 border-ink bg-sand hover:bg-cream"
            >
              LIGHT (CREAM)
            </button>
            <button
              onClick={() => handleSetMode('DARK')}
              className="px-5 py-2 border-2 border-ink bg-ink text-cream"
            >
              DARK (INK)
            </button>
            <button
              onClick={() => handleSetMode('SYSTEM')}
              className="px-5 py-2 border-2 border-ink bg-sand hover:bg-cream"
            >
              SYSTEM
            </button>
          </div>
        </div>

        {/* 4. Blocked Nodes */}
        <div className="border-2 border-ink bg-cream p-6 flex flex-col gap-3 font-mono">
          <span className="text-[16px] font-[800] uppercase">4. BLOCKED NODES ({blockedList.length})</span>
          {blockedList.length === 0 ? (
            <div className="p-3 text-[12px] text-ink-muted">ZERO BLOCKED PEERS.</div>
          ) : (
            <div className="border border-ink divide-y divide-ink text-[12px]">
              {blockedList.map((b) => {
                const currentUserId = user?.id || user?._id;
                const peerUser = (b.requester._id || b.requester.id) === currentUserId ? b.recipient : b.requester;
                return (
                  <div key={b._id} className="p-3 flex justify-between items-center bg-sand/30">
                    <span>{peerUser.handle} (@{peerUser.handle})</span>
                    <button
                      onClick={() => handleUnblock(b._id)}
                      className="text-cobalt font-[700] underline"
                    >
                      UNBLOCK
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Purge Logs */}
        <div className="border-2 border-coral bg-coral/10 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <span className="text-[16px] font-[800] uppercase text-ink block">
              PURGE LOCAL WEBRTC LOGS
            </span>
            <span className="text-[12px] font-mono text-ink-muted">
              Erase all cached transfer manifests from database and memory.
            </span>
          </div>
          <button
            onClick={handlePurgeAllLogs}
            className="h-10 px-6 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[12px] uppercase hard-shadow-coral hover:bg-sand shrink-0"
          >
            PURGE EVERYTHING
          </button>
        </div>

        {/* 6. Active Session & Logout */}
        <div className="border-2 border-ink bg-cream p-6 flex flex-col gap-4 font-mono hard-shadow-ink">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-ink pb-3">
            <div>
              <span className="text-[16px] font-[800] uppercase block">
                6. ACTIVE SESSION & AUTHENTICATION
              </span>
              <span className="text-[12px] text-ink-muted">
                Manage your active device session or switch to another operator account.
              </span>
            </div>
            <span className={`px-2.5 py-1 text-[11px] font-[800] uppercase border border-ink self-start sm:self-auto ${
              user?.handle.startsWith('guest_') ? 'bg-coral text-ink' : 'bg-cobalt text-cream'
            }`}>
              {user?.handle.startsWith('guest_') ? '⚡ GUEST SESSION' : '🔒 AUTHENTICATED'}
            </span>
          </div>

          <div className="bg-sand p-4 border border-ink flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-[13px] font-[800]">
                OPERATOR: <span className="text-cobalt">@{user?.handle || 'UNKNOWN'}</span>
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                {user?.handle.startsWith('guest_')
                  ? 'Ephemeral guest session. Log out to register an account or log in with credentials.'
                  : `Signed in as permanent account${user?.email ? ` (${user.email})` : ''}.`}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="h-10 px-6 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[800] text-[12px] uppercase hard-shadow-coral hover:bg-sand transition-colors inline-flex items-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              LOG OUT OF SESSION
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
