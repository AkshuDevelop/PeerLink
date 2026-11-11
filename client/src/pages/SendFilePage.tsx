/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 7 — Send File Page matching code.html Lines 760–831.
 *   Left: 1. CHOOSE A PEER selectable roster (highlights with ring-4 ring-cobalt).
 *   Right: 2. PAYLOAD STAGING drag-and-drop dropzone + file input.
 *   Real-time SHA-256 worker hashing before sending offer.
 *   TRANSMIT REQUEST button initiates WebRTC negotiation.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTransfer } from '../context/TransferContext';
import { api } from '../api/httpClient';
import { computeFileSha256 } from '../services/hashService';
import type { Contact } from '../types/peerlink';

export const SendFilePage: React.FC = () => {
  const { user } = useAuth();
  const { initiateSendTransfer, showToast } = useTransfer();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [peers, setPeers] = useState<Contact[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string>('');
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedSha256, setStagedSha256] = useState<string>('');
  const [isHashing, setIsHashing] = useState<boolean>(false);
  const [hashingPercent, setHashingPercent] = useState<number>(0);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api.get<{ contacts: Contact[] }>('/api/contacts?status=ACCEPTED')
      .then((res) => {
        setPeers(res.contacts);
        const queryPeer = searchParams.get('peer');
        const currentUserId = user?.id || user?._id;
        if (queryPeer) {
          setSelectedPeerId(queryPeer);
        } else if (res.contacts.length > 0) {
          const firstPeer = res.contacts[0];
          const firstPeerUser = (firstPeer.requester._id || firstPeer.requester.id) === currentUserId
            ? (firstPeer.recipient._id || firstPeer.recipient.id)
            : (firstPeer.requester._id || firstPeer.requester.id);
          setSelectedPeerId(firstPeerUser);
        }
      })
      .catch(console.error);
  }, [user, searchParams]);

  const handleFileSelect = async (file: File) => {
    setStagedFile(file);
    setStagedSha256('');
    setIsHashing(true);
    setHashingPercent(0);
    showToast('CALCULATING INCREMENTAL SHA-256 DIGEST...');

    try {
      const hash = await computeFileSha256(file, (percent) => {
        setHashingPercent(percent);
      });
      setStagedSha256(hash);
      setIsHashing(false);
      showToast('SHA-256 DIGEST VERIFIED IN MEMORY.');
    } catch (err: any) {
      console.error('[SendFilePage] Hash calculation failed:', err);
      showToast(err.message || 'FAILED TO HASH FILE');
      setIsHashing(false);
    }
  };

  const handleTransmit = async () => {
    if (!selectedPeerId) {
      alert('PLEASE SELECT A PEER FIRST.');
      return;
    }
    if (!stagedFile || !stagedSha256 || isHashing) {
      alert('FILE NOT READY OR SHA-256 HASH STILL COMPUTING.');
      return;
    }

    setIsTransmitting(true);
    try {
      const sessionCode = await initiateSendTransfer(selectedPeerId, stagedFile, stagedSha256);
      navigate(`/transfer/${sessionCode}`);
    } catch (err: any) {
      showToast(err.message || 'FAILED TO TRANSMIT REQUEST');
      setIsTransmitting(false);
    }
  };

  return (
    <>
      {/* Cobalt Header */}
      <section className="w-full bg-cobalt text-cream border-b-2 border-ink py-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
          <span className="text-[12px] font-mono font-[700] uppercase tracking-widest text-coral">
            // METADATA FIRST · PAYLOAD AFTER CONSENT
          </span>
          <h1 className="text-[40px] md:text-[56px] font-[800] uppercase tracking-tight text-cream leading-none mt-1">
            SEND A FILE
          </h1>
        </div>
      </section>

      {/* Body */}
      <section className="w-full bg-cream text-ink py-12 pb-24 md:pb-12 flex-grow overflow-x-hidden">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Choose a Peer */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <h3 className="text-[14px] font-mono font-[800] uppercase">1. CHOOSE A PEER</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {peers.length === 0 ? (
                <div className="col-span-full border-2 border-ink bg-sand p-6 text-center font-mono text-[13px] text-ink-muted">
                  NO ACCEPTED PEERS. ADD A PEER FIRST TO TRANSMIT FILES.
                </div>
              ) : (
                peers.map((c) => {
                  const currentUserId = user?.id || user?._id;
                  const peerUser = (c.requester._id || c.requester.id) === currentUserId ? c.recipient : c.requester;
                  const peerId = peerUser._id || peerUser.id;
                  const isSelected = selectedPeerId === peerId;

                  return (
                    <div
                      key={c._id}
                      onClick={() => setSelectedPeerId(peerId)}
                      className={`peer-select-card cursor-pointer border-2 border-ink bg-cream p-4 flex flex-col justify-between gap-3 hover:bg-sand transition-all ${
                        isSelected ? 'ring-4 ring-cobalt' : ''
                      }`}
                    >
                      <div className="w-12 h-12 border-2 border-ink bg-coral text-ink flex items-center justify-center font-mono font-[800] text-[16px] avatar-hatch">
                        {peerUser.avatar || 'P'}
                      </div>
                      <div>
                        <div className="font-[800] text-[15px] uppercase truncate">{peerUser.handle}</div>
                        <div className="text-[11px] font-mono text-ink-muted">@{peerUser.handle}</div>
                      </div>
                      <span className="text-[10px] font-mono font-[800] px-1.5 py-0.5 border border-ink bg-sand self-start uppercase">
                        ONLINE
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Dropzone / Card */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <h3 className="text-[14px] font-mono font-[800] uppercase">2. PAYLOAD STAGING</h3>

            <div
              id="send-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-ink bg-sand p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-cream transition-colors min-h-[220px]"
            >
              <span className="material-symbols-outlined text-[48px] text-cobalt mb-2">upload_file</span>
              <span className="text-[16px] font-[800] uppercase font-mono">DROP A FILE OR SELECT ONE</span>
              <span className="text-[12px] font-mono text-ink-muted mt-1">Unlimited gigabyte payload · Client-sliced</span>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
            </div>

            {/* Staged File Card */}
            {stagedFile && (
              <div id="staged-card" className="border-2 border-ink bg-cream p-5 font-mono flex flex-col gap-3 hard-shadow-coral">
                <div className="flex justify-between items-center border-b border-ink pb-2">
                  <span className="text-[11px] font-[800] uppercase text-cobalt">STAGED AUDIT</span>
                  <span className="text-[10px] bg-coral px-2 py-0.5 border border-ink font-[800] uppercase">
                    DTLS ARMED
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-ink-muted uppercase block">FILE:</span>
                  <strong className="text-[16px] font-[800] uppercase truncate block">
                    {stagedFile.name}
                  </strong>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    SIZE: <strong>{(stagedFile.size / (1024 * 1024)).toFixed(2)} MB</strong>
                  </div>
                  <div>
                    SLICES: <strong>{Math.ceil(stagedFile.size / (64 * 1024)).toLocaleString()} @ 64KB</strong>
                  </div>
                </div>

                {isHashing ? (
                  <div className="text-[12px] text-cobalt font-mono font-bold animate-pulse border border-cobalt p-2 bg-cobalt/5">
                    COMPUTING SHA-256: {hashingPercent}%
                  </div>
                ) : (
                  <div className="text-[10px] text-ink-muted break-all border border-ink/20 p-1.5 bg-sand/20">
                    SHA-256: <strong className="text-ink">{stagedSha256 || 'AWAITING SELECTION'}</strong>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-ink">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-4 rounded-full border border-ink bg-sand text-[11px] font-[700] uppercase hover:bg-cream"
                  >
                    REPLACE
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleTransmit}
              disabled={isTransmitting || !stagedFile || isHashing || !stagedSha256}
              className="w-full h-12 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[13px] uppercase tracking-wider hard-shadow-coral hover:bg-sand transition-colors"
            >
              {isTransmitting
                ? 'NEGOTIATING CONDUIT...'
                : isHashing
                ? 'CALCULATING CHECKSUM...'
                : 'TRANSMIT REQUEST'}
            </button>
            <p className="text-[11px] font-mono text-ink-muted text-center">
              We send the details first. Bytes move only after the remote peer accepts.
            </p>
          </div>
        </div>
      </section>
    </>
  );
};
