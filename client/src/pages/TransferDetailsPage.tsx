/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 10 — Transfer Details Page matching code.html Lines 1012–1081.
 *   Exhaustive metadata audit: transmission ID, conduit, dispatcher,
 *   recipient, side-by-side SHA-256 integrity attestation, and CSV export.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/httpClient';
import { useTransfer } from '../context/TransferContext';
import type { Transfer } from '../types/peerlink';

export const TransferDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useTransfer();

  useEffect(() => {
    if (!id) return;
    api.get<{ transfer: Transfer }>(`/api/transfers/${id}`)
      .then((res) => setTransfer(res.transfer))
      .catch((err) => {
        showToast(err.message || 'FAILED TO LOAD TRANSFER AUDIT');
      })
      .finally(() => setIsLoading(false));
  }, [id, showToast]);

  const handleExportCSV = () => {
    if (!transfer) return;
    const headers = 'SESSION_ID,FILENAME,SIZE_BYTES,CONDUIT,SENDER,RECIPIENT,STATUS,SENDER_SHA256,RECEIVER_SHA256,INTEGRITY_VERIFIED\n';
    const row = `"${transfer.sessionCode}","${transfer.filename}",${transfer.sizeBytes},"${transfer.conduitType}","${transfer.sender.handle}","${transfer.recipient.handle}","${transfer.status}","${transfer.senderSha256}","${transfer.receiverSha256 || ''}",${transfer.integrityVerified}\n`;
    const blob = new Blob([headers, row], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${transfer.sessionCode}.csv`;
    a.click();
    showToast('AUDIT CSV EXPORTED.');
  };

  if (isLoading) {
    return (
      <section className="w-full bg-cream text-ink py-12 flex-grow flex items-center justify-center font-mono">
        LOADING AUDIT RECORD [{id}]...
      </section>
    );
  }

  if (!transfer) {
    return (
      <section className="w-full bg-cream text-ink py-12 flex-grow flex flex-col items-center justify-center font-mono gap-4">
        <div>TRANSFER RECORD [{id}] NOT FOUND.</div>
        <Link to="/logs" className="underline font-[700]">RETURN TO LOGS</Link>
      </section>
    );
  }

  return (
    <section className="w-full bg-cream text-ink py-12 pb-24 md:pb-12 flex-grow overflow-x-hidden">
      <div className="max-w-[880px] mx-auto px-4 sm:px-8 flex flex-col gap-6">
        <div className="border-b-2 border-ink pb-4 flex justify-between items-end">
          <div>
            <span className="text-[12px] font-mono font-[700] uppercase tracking-widest text-ink-muted">
              // EXHAUSTIVE METADATA AUDIT
            </span>
            <h2 className="text-[40px] md:text-[56px] font-[800] uppercase tracking-tight leading-none mt-1">
              TRANSFER <span className="text-[28px] font-mono text-ink-muted">{transfer.sessionCode}</span>
            </h2>
          </div>
          <Link to="/logs" className="text-[13px] font-mono font-[800] uppercase underline">
            BACK TO LOGS
          </Link>
        </div>

        <div className="border-2 border-ink bg-cream p-8 hard-shadow-ink flex flex-col gap-6 font-mono text-[13px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="text-ink-muted text-[11px] block uppercase">TRANSMISSION ID</span>
              <strong className="text-[18px] font-[800]">{transfer.sessionCode}</strong>
            </div>
            <div>
              <span className="text-ink-muted text-[11px] block uppercase">ESTABLISHED CONDUIT</span>
              <strong className="text-[18px] font-[800] text-cobalt">
                WebRTC {transfer.conduitType} / DTLS 1.3
              </strong>
            </div>
            <div>
              <span className="text-ink-muted text-[11px] block uppercase">DISPATCHER (SENDER)</span>
              <strong className="text-[15px] font-[700]">
                {transfer.sender.nodeId} (@{transfer.sender.handle})
              </strong>
            </div>
            <div>
              <span className="text-ink-muted text-[11px] block uppercase">RECIPIENT (RECEIVER)</span>
              <strong className="text-[15px] font-[700]">
                {transfer.recipient.nodeId} (@{transfer.recipient.handle})
              </strong>
            </div>
          </div>

          {/* Side-by-side SHA comparison */}
          <div className="border-2 border-ink bg-sand p-6 flex flex-col gap-4">
            <span className="text-[15px] font-[800] uppercase">SIDE-BY-SIDE INTEGRITY ATTESTATION:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
              <div className="border border-ink bg-cream p-3">
                <span className="text-ink-muted uppercase block font-[700]">SENDER SHA-256:</span>
                <div className="font-[700] text-cobalt break-all mt-1">{transfer.senderSha256}</div>
              </div>
              <div className="border border-ink bg-cream p-3">
                <span className="text-ink-muted uppercase block font-[700]">RECEIVER REASSEMBLED:</span>
                <div className="font-[700] text-cobalt break-all mt-1">
                  {transfer.receiverSha256 || 'PENDING DISPATCH/COMPLETION'}
                </div>
              </div>
            </div>

            {transfer.integrityVerified ? (
              <div className="flex items-center gap-2 font-[700] text-ink">
                <span className="material-symbols-outlined text-cobalt">verified</span>
                <span>MATCH 100% CONFIRMED · ZERO BIT CORRUPTION DETECTED</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 font-[700] text-ink-muted">
                <span className="material-symbols-outlined text-coral">warning</span>
                <span>STATUS: {transfer.status}</span>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-2">
            <Link
              to={`/transfer/${transfer.sessionCode}`}
              className="h-11 px-6 rounded-full border-2 border-ink bg-sand text-ink font-[700] uppercase flex items-center justify-center hover:bg-cream"
            >
              VIEW LIVE PIPE
            </Link>
            <button
              onClick={handleExportCSV}
              className="h-11 px-6 rounded-full border-2 border-ink bg-coral text-ink font-[700] uppercase hard-shadow-coral hover:bg-sand"
            >
              DOWNLOAD AUDIT CSV
            </button>
          </div>
        </div>
        <p className="text-[11px] font-mono text-ink-muted text-center">
          Logs are metadata and reported outcomes, not independent proof of what a device saw or saved.
        </p>
      </div>
    </section>
  );
};
