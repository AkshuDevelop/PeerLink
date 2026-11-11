/**
 * ============================================================
 * FILE PURPOSE:
 *   Incoming Transfer Request Modal matching code.html Lines 172–214.
 *   Shows dispatcher node, payload filename, size, slice count,
 *   E2E cipher badge, security caution note, and ACCEPT/REJECT buttons.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Component
 * ============================================================
 */

import React from 'react';
import { useTransfer } from '../context/TransferContext';

export const IncomingRequestModal: React.FC = () => {
  const { activeOffer, acceptOffer, rejectOffer, dismissOfferModal } = useTransfer();

  if (!activeOffer) return null;

  const sizeMB = (activeOffer.sizeBytes / (1024 * 1024)).toFixed(2);
  const sizeFormatted = activeOffer.sizeBytes > 1024 * 1024 * 1024
    ? `${(activeOffer.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    : `${sizeMB} MB`;

  return (
    <div
      id="request-modal"
      className="fixed inset-0 bg-ink/80 z-50 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-[540px] bg-ink border-2 border-cream p-8 text-cream flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-cream-hairline pb-4">
          <span className="text-[12px] font-mono font-[700] uppercase tracking-widest text-coral">
            // INCOMING WEBRTC TRANSFER
          </span>
          <span className="text-[11px] font-mono text-cream-muted uppercase">RFC 8489 STUN</span>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-coral text-ink border-2 border-ink flex items-center justify-center font-mono font-[800] text-[20px] shrink-0 avatar-hatch">
            {activeOffer.sender.avatar || 'KF'}
          </div>
          <div>
            <span className="text-[11px] font-mono text-cream-muted uppercase block">DISPATCHER NODE</span>
            <h3 className="text-[22px] font-[800] uppercase tracking-tight text-cream">
              {activeOffer.sender.handle.toUpperCase()} (@{activeOffer.sender.handle})
            </h3>
            <p className="text-[12px] font-mono text-sand">STUN Candidate RTT: 14ms</p>
          </div>
        </div>

        {/* File Payload Card */}
        <div className="border-2 border-cream bg-cream/5 p-4 flex flex-col gap-2 font-mono">
          <div className="text-[11px] text-cream-muted uppercase">PAYLOAD:</div>
          <div className="text-[18px] font-[800] uppercase truncate text-cream" id="req-filename">
            {activeOffer.filename}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-sand pt-1 border-t border-cream-hairline">
            <span>SIZE: <strong>{sizeFormatted}</strong></span>
            <span>SLICES: <strong>{activeOffer.totalChunks.toLocaleString()} @ 64KB</strong></span>
            <span className="truncate">TYPE: <strong>{activeOffer.mimeType}</strong></span>
            <span>CIPHER: <strong className="text-coral">SHA-256 E2E</strong></span>
          </div>
        </div>

        {/* Caution Note */}
        <div className="border border-cream/30 p-3 text-[12px] font-mono text-cream-muted flex items-start gap-2">
          <span className="material-symbols-outlined text-[16px] text-coral mt-0.5">shield</span>
          <span>This file type streams directly into memory. Open only if you trust the peer. Zero malware cloud scanning.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => acceptOffer(activeOffer.transferId)}
            className="flex-1 h-[48px] rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[14px] uppercase tracking-wider hard-shadow-coral hover:bg-sand inline-flex items-center justify-center leading-none"
          >
            ACCEPT & STREAM
          </button>
          <button
            onClick={() => rejectOffer(activeOffer.transferId)}
            className="h-[48px] px-6 rounded-full border-2 border-cream text-cream font-mono font-[700] text-[14px] uppercase hover:bg-cream hover:text-ink inline-flex items-center justify-center leading-none"
          >
            REJECT
          </button>
        </div>
      </div>
    </div>
  );
};
