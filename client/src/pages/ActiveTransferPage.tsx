/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 8 — Active Transfer Page matching code.html Lines 834–935.
 *   Full-height Ink screen showing SENDING/RECEIVING badge, conduit type,
 *   CANCEL TRANSFER button, large filename headline, spinning SVG status disc
 *   with real-time percentage, animated progress track, and 4-cell telemetry grid
 *   driven by real WebRTC byte counters.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTransfer } from '../context/TransferContext';

export const ActiveTransferPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { telemetry, downloadUrl, cancelActiveTransfer } = useTransfer();
  const navigate = useNavigate();

  useEffect(() => {
    // Only navigate to /result if this telemetry is for THIS specific active transfer
    const isMatchingSession = telemetry?.sessionCode === id || telemetry?.transferId === id;
    if (!isMatchingSession) return;

    if (telemetry?.status === 'COMPLETED') {
      // If receiver, ensure download blob is created or let them transition
      navigate(`/transfer/${id}/result`);
    } else if (telemetry?.status === 'CANCELLED' || telemetry?.status === 'FAILED') {
      navigate(`/transfer/${id}/result`);
    }
  }, [telemetry?.status, telemetry?.sessionCode, telemetry?.transferId, telemetry?.downloadBlobUrl, downloadUrl, id, navigate]);

  const transferredMB = telemetry ? (telemetry.transferredBytes / (1024 * 1024)).toFixed(1) : '0.0';
  const totalMB = telemetry ? (telemetry.sizeBytes / (1024 * 1024)).toFixed(1) : '0.0';
  const percent = telemetry?.percent || 0;
  const speed = telemetry?.speedMBps ? telemetry.speedMBps.toFixed(1) : '0.0';
  const etaSec = telemetry?.etaSeconds || 0;
  const etaFormatted = `00:${etaSec.toString().padStart(2, '0')}s`;

  return (
    <section className="w-full bg-ink text-cream py-10 pb-24 md:pb-10 flex-grow flex flex-col justify-between overflow-x-hidden">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 w-full flex flex-col gap-8">
        {/* Header bar with Direction & Cancel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-cream-hairline pb-4 gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-coral text-ink px-2 py-1 text-[11px] font-mono font-[800] uppercase border border-ink">
              {telemetry?.role === 'RECEIVER' ? 'RECEIVING' : 'SENDING'}
            </span>
            <span className="text-[14px] font-mono font-[700] uppercase tracking-widest text-sand">
              {telemetry?.role === 'RECEIVER' ? 'YOU ↖ REMOTE PEER' : 'YOU ↘ REMOTE PEER'}
            </span>
            <span className="px-2 py-0.5 border border-cream/30 text-[10px] font-mono uppercase text-cream-muted">
              {telemetry?.conduitType || 'DIRECT SCTP'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/transfer/${id}/details`}
              className="h-9 px-4 rounded-full border-2 border-cream text-cream text-[11px] font-mono font-[700] uppercase hover:bg-cream hover:text-ink transition-colors inline-flex items-center justify-center leading-none"
            >
              DETAILS
            </Link>
            <button
              onClick={() => cancelActiveTransfer('Aborted by user')}
              className="h-9 px-4 rounded-full border-2 border-cream bg-coral text-ink text-[11px] font-mono font-[700] uppercase hard-shadow-coral hover:bg-sand transition-colors inline-flex items-center justify-center leading-none"
            >
              CANCEL TRANSFER
            </button>
          </div>
        </div>

        {/* Filename Anchor */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="max-w-3xl">
            <span className="text-[11px] font-mono text-cream-muted uppercase block">
              // TRANSMISSION PAYLOAD CONDUIT:
            </span>
            <h1
              className="text-[36px] sm:text-[56px] md:text-[72px] font-[800] uppercase tracking-[-0.04em] leading-[0.9] text-cream truncate"
              title={telemetry?.filename || 'STREAMING_PAYLOAD'}
            >
              {telemetry?.filename || 'STREAMING_PAYLOAD'}
            </h1>
          </div>

          {/* Fast-spinning status disc */}
          <div className="relative w-[140px] h-[140px] shrink-0 flex items-center justify-center">
            <div className="w-[140px] h-[140px] animate-disc-fast">
              <svg viewBox="0 0 200 200" className="w-full h-full fill-current text-cobalt">
                <path
                  id="curve-transfer"
                  fill="transparent"
                  d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -75,0"
                />
                <text className="text-[13px] font-[800] tracking-[0.14em] uppercase font-mono">
                  <textPath href="#curve-transfer" startOffset="0%">
                    DIRECT · PEER TO PEER · END TO END ·
                  </textPath>
                </text>
              </svg>
            </div>
            <div className="absolute w-[80px] h-[80px] rounded-full bg-sand border-2 border-ink flex flex-col items-center justify-center text-ink text-center">
              <span id="transfer-disc-percent" className="text-[22px] font-[800] font-mono leading-none">
                {percent}%
              </span>
            </div>
          </div>
        </div>

        {/* Wire Progress Track */}
        <div className="flex flex-col gap-2 font-mono">
          <div className="flex justify-between text-[12px] text-sand font-[700] uppercase">
            <span id="transfer-live-state" aria-live="polite">
              STREAMING 64KB SLICES VIA SCTP
            </span>
            <span id="transfer-bytes-label">
              {transferredMB} MB / {totalMB} MB
            </span>
          </div>
          <div className="w-full h-[12px] border-2 border-cream bg-cream/10 p-[1px] relative overflow-hidden">
            <div
              id="transfer-progress-bar"
              className="h-full bg-cobalt transition-all duration-200"
              style={{ width: `${percent}%` }}
            >
              <div className="w-full h-full bg-[linear-gradient(90deg,transparent_50%,rgba(255,255,255,0.3)_50%)] bg-[length:12px_100%] animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* 4-Cell Telemetry Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-2 border-cream bg-cream gap-[2px] text-ink" role="timer">
          <div className="bg-cream p-5">
            <span className="text-[11px] font-mono text-ink-muted uppercase block">TRANSFERRED</span>
            <div id="tel-transferred" className="text-[36px] font-[800] font-mono mt-1">
              {transferredMB} MB
            </div>
            <span className="text-[11px] font-mono text-ink-muted">OF {totalMB} MB</span>
          </div>

          <div className="bg-cream p-5">
            <span className="text-[11px] font-mono text-ink-muted uppercase block">PERCENT</span>
            <div id="tel-percent" className="text-[36px] font-[800] font-mono mt-1">
              {percent}%
            </div>
            <span className="text-[11px] font-mono text-ink-muted">SLICES OK</span>
          </div>

          <div className="bg-cream p-5">
            <span className="text-[11px] font-mono text-ink-muted uppercase block">SPEED</span>
            <div id="tel-speed" className="text-[36px] font-[800] font-mono text-cobalt mt-1">
              {speed} MB/S
            </div>
            <span className="text-[11px] font-mono text-ink-muted">RELIABLE CONDUIT</span>
          </div>

          <div className="bg-sand p-5">
            <span className="text-[11px] font-mono text-ink-muted uppercase block">ETA</span>
            <div id="tel-eta" className="text-[36px] font-[800] font-mono mt-1">
              {etaFormatted}
            </div>
            <span className="text-[11px] font-mono text-ink-muted">ZERO LOSS</span>
          </div>
        </div>

        {/* Live SHA-256 Footer */}
        <div className="border border-cream/30 bg-cream/5 p-3 flex flex-col sm:flex-row justify-between items-center text-[12px] font-mono text-sand gap-2">
          <span className="truncate">
            RUNNING SHA-256: <strong className="text-cream">{telemetry?.senderSha256 || 'CALCULATING...'}</strong>
          </span>
          <span className="px-2 py-0.5 border border-cream/30 text-[10px] uppercase text-cream-muted">
            DTLS-SRTP 1.3
          </span>
        </div>
      </div>
    </section>
  );
};
