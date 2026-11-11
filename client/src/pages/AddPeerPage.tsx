/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 6 — Add Peer Page matching code.html Lines 718–757.
 *   Provides exact handle lookup + RESOLVE button calling GET /api/contacts/lookup.
 *   Displays resolved node card + SEND REQUEST button.
 *   Includes ALTERNATIVE: 6-DIGIT INSTANT PIN section.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/httpClient';
import { useTransfer } from '../context/TransferContext';
import type { User } from '../types/peerlink';

export const AddPeerPage: React.FC = () => {
  const [handleInput, setHandleInput] = useState('');
  const [resolvedUser, setResolvedUser] = useState<User | null>(null);
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { openPairModal, showToast } = useTransfer();
  const navigate = useNavigate();

  const handleLookup = async () => {
    const val = handleInput.trim().toLowerCase();
    if (!val) {
      alert('ENTER AN EXACT HANDLE.');
      return;
    }

    setIsSearching(true);
    setResolvedUser(null);

    try {
      const res = await api.get<{ user: User; contactStatus: string | null }>(
        `/api/contacts/lookup?handle=${encodeURIComponent(val)}`
      );
      setResolvedUser(res.user);
      setContactStatus(res.contactStatus);
      showToast('PEER DISCOVERED VIA LOCAL MESH.');
    } catch (err: any) {
      showToast(err.message || 'HANDLE NOT FOUND');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!resolvedUser) return;
    setIsSending(true);

    try {
      await api.post('/api/contacts/request', { recipientId: resolvedUser.id });
      showToast(`REQUEST DISPATCHED TO @${resolvedUser.handle.toUpperCase()}`);
      navigate('/peers');
    } catch (err: any) {
      showToast(err.message || 'FAILED TO SEND REQUEST');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="w-full bg-cream text-ink py-14 pb-24 md:pb-14 flex-grow overflow-x-hidden">
      <div className="max-w-[760px] mx-auto px-4 sm:px-8 flex flex-col gap-6">
        <div className="border-b-2 border-ink pb-4">
          <span className="text-[12px] font-mono font-[700] uppercase tracking-widest text-ink-muted">
            // EXACT HANDLE ONLY · NO DIRECTORY
          </span>
          <h2 className="text-[40px] md:text-[56px] font-[800] uppercase tracking-tight leading-none mt-1">
            ADD A PEER
          </h2>
          <p className="text-[14px] font-mono text-ink-muted mt-2">
            PeerLink does not run a public directory to prevent enumeration. Input the exact handle or public candidate fingerprint.
          </p>
        </div>

        <div className="border-2 border-ink bg-cream p-8 hard-shadow-ink flex flex-col gap-6 font-mono">
          <div>
            <label className="text-[12px] font-[800] uppercase block mb-2">ENTER AN EXACT HANDLE:</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                id="add-peer-handle-input"
                placeholder="e.g. kofi_station OR orion_audio"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                className="flex-1 h-12 border-2 border-ink bg-sand px-4 font-mono font-[700] uppercase focus:border-cobalt focus:ring-0"
              />
              <button
                onClick={handleLookup}
                disabled={isSearching}
                className="h-12 px-8 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[13px] uppercase tracking-wider hard-shadow-coral hover:bg-sand transition-colors"
              >
                {isSearching ? 'PROBING...' : 'RESOLVE'}
              </button>
            </div>
          </div>

          {/* Result Card */}
          {resolvedUser && (
            <div id="lookup-result-container" className="border-2 border-ink bg-sand p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between border-b border-ink pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-coral border-2 border-ink flex items-center justify-center font-[800] text-[18px]">
                    {resolvedUser.avatar || resolvedUser.handle.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-[800] text-[16px] uppercase">{resolvedUser.handle.toUpperCase()}</div>
                    <div className="text-[11px] text-ink-muted">STUN REFLEXIVE CANDIDATE GATHERED</div>
                  </div>
                </div>
                <span className="bg-cobalt text-cream px-2 py-0.5 text-[10px] font-[800]">
                  PEER DISCOVERED
                </span>
              </div>
              <div className="text-[12px]">CIPHER: DTLS-SRTP v1.3 · RTT: 18MS · NODE: {resolvedUser.nodeId}</div>

              {contactStatus === 'ACCEPTED' ? (
                <div className="text-cobalt font-[700] uppercase text-[12px]">
                  ALREADY IN ACCEPTED PEERS ROSTER
                </div>
              ) : contactStatus === 'PENDING' ? (
                <div className="text-coral font-[700] uppercase text-[12px]">
                  CONTACT REQUEST ALREADY PENDING
                </div>
              ) : (
                <button
                  onClick={handleSendRequest}
                  disabled={isSending}
                  className="h-10 px-6 rounded-full border-2 border-ink bg-coral text-ink font-[700] text-[12px] uppercase hard-shadow-coral hover:bg-cream self-start"
                >
                  {isSending ? 'SENDING...' : 'SEND REQUEST'}
                </button>
              )}
            </div>
          )}

          <div className="border-t-2 border-ink pt-6 flex flex-col gap-3 text-[12px] text-ink-muted">
            <span className="font-[800] uppercase text-ink">ALTERNATIVE: 6-DIGIT INSTANT PIN</span>
            <p>If direct STUN reflex fails over strict symmetric NAT, connect directly with an out-of-band numeric PIN:</p>
            <button
              onClick={openPairModal}
              className="self-start h-10 px-5 rounded-full border-2 border-ink bg-sand text-ink font-[700] uppercase hover:bg-cream"
            >
              ENTER 6-DIGIT PIN
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
