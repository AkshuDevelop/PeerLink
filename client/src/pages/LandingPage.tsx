/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 1 — Landing Page matching code.html Lines 285–457.
 *   Cobalt hero with outline wordmark, rotating SVG status disc,
 *   Cream specs readout grid (SCTP, ∞ GB, 0 BYTES, SHA-256),
 *   Ink mesh stack operational band, and Sovereignty Guarantee card.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { user, loginGuest } = useAuth();
  const navigate = useNavigate();
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  /**
   * Handle instant 1-click guest node creation.
   * Calls POST /api/auth/guest, stores the ephemeral session + pair PIN,
   * and routes directly to /dashboard without requiring registration.
   */
  const handleGuestLogin = async () => {
    try {
      setIsGuestLoading(true);
      await loginGuest();
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Failed to create guest node:', err);
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <>
      {/* Cobalt Hero */}
      <section className="w-full bg-cobalt text-cream border-b-2 border-ink py-12 md:py-20 relative overflow-hidden">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-cream pb-6 mb-8 gap-4">
            <div>
              <span className="text-[13px] font-mono font-[700] uppercase tracking-widest text-cream-muted block mb-1">
                DIRECT BROWSER TO BROWSER · NO CLOUD STORAGE
              </span>
              <h1 className="text-[64px] sm:text-[96px] md:text-[140px] font-[800] uppercase tracking-[-0.06em] leading-[0.82] select-none">
                PEER<span className="outline-wordmark">LINK</span>
              </h1>
            </div>
            <div className="flex flex-col items-start md:items-end font-mono">
              <span className="text-[16px] font-[800] uppercase text-sand">NO SERVERS. NO INTERMEDIARY. ZERO PERSISTENCE.</span>
              <span className="text-[11px] text-cream-muted uppercase tracking-widest">SCTP / ICE / DTLS 1.3 / RAW CHUNK PROTOCOL</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <p className="text-[20px] md:text-[24px] font-[800] uppercase tracking-tight leading-tight text-cream">
                TRANSMIT MULTI-GIGABYTE ASSETS DIRECTLY BROWSER-TO-BROWSER AT MAXIMUM WIRE SPEED.
              </p>
              <p className="text-[16px] text-sand max-w-[48ch] leading-relaxed">
                Find a contact by their exact handle, add them with their consent, and send files straight from your browser to theirs. Files never touch a central storage bucket or staging proxy.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to={user ? '/dashboard' : '/signup'}
                  className="h-[48px] px-8 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[14px] uppercase tracking-wider inline-flex items-center justify-center hard-shadow-coral hover:bg-sand transition-colors"
                >
                  INITIALIZE NODE
                </Link>
                {!user && (
                  <button
                    type="button"
                    onClick={handleGuestLogin}
                    disabled={isGuestLoading}
                    className="h-[48px] px-6 rounded-full border-2 border-ink bg-sand text-ink font-mono font-[800] text-[13px] uppercase tracking-wider inline-flex items-center justify-center hard-shadow-coral hover:bg-cream transition-colors"
                  >
                    {isGuestLoading ? 'CONNECTING GUEST...' : '⚡ INSTANT GUEST NODE (NO SIGNUP)'}
                  </button>
                )}
                <Link
                  to="/dashboard"
                  className="h-[48px] px-8 rounded-full border-2 border-cream bg-transparent text-cream font-mono font-[700] text-[14px] uppercase tracking-wider inline-flex items-center justify-center hover:bg-cream hover:text-cobalt transition-colors"
                >
                  VIEW LIVE TELEMETRY
                </Link>
              </div>
            </div>

            {/* Rotating SVG Status Disc */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-[168px] h-[168px] flex items-center justify-center">
                <div className="w-[168px] h-[168px] animate-disc-spin">
                  <svg viewBox="0 0 200 200" className="w-full h-full fill-current text-cream">
                    <path
                      id="curve-landing"
                      fill="transparent"
                      d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0"
                    />
                    <text className="text-[12px] font-[800] tracking-[0.14em] uppercase font-mono">
                      <textPath href="#curve-landing" startOffset="0%">
                        PEER TO PEER · END TO END · NO CLOUD ·
                      </textPath>
                    </text>
                  </svg>
                </div>
                <div className="absolute w-[96px] h-[96px] rounded-full bg-cream border-2 border-ink flex flex-col items-center justify-center text-ink hard-shadow-ink">
                  <span className="text-[10px] font-mono font-[700] text-cobalt uppercase">WEBRTC</span>
                  <span className="text-[28px] font-[800] leading-none">↘</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cream Specs Readout Grid */}
      <section className="w-full bg-cream text-ink border-b-2 border-ink py-12 md:py-16">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-8">
            <h2 className="text-[20px] font-[800] uppercase font-mono tracking-tight">01 // SPECIFICATIONS & BENCHMARKS</h2>
            <span className="text-[11px] font-mono uppercase bg-sand px-3 py-1 border border-ink font-[700]">LOCAL HARDWARE VERIFIED</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-2 border-ink bg-ink gap-[2px]">
            <div className="bg-cream p-6 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono text-ink-muted uppercase">CHANNEL PIPELINE</span>
                <h3 className="text-[44px] font-[800] uppercase mt-2 font-mono">SCTP</h3>
              </div>
              <p className="text-[13px] border-t-2 border-ink pt-3 mt-6">Direct ordered chunk transmission over UDP with reliable retransmission semantics.</p>
            </div>
            <div className="bg-cream p-6 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono text-ink-muted uppercase">FILE LIMIT</span>
                <h3 className="text-[44px] font-[800] uppercase mt-2 font-mono">∞ GB</h3>
              </div>
              <p className="text-[13px] border-t-2 border-ink pt-3 mt-6">Zero file size capping. Sliced in 64KB ArrayBuffer chunks via the File API with backpressure.</p>
            </div>
            <div className="bg-cream p-6 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono text-ink-muted uppercase">SERVER LOGS</span>
                <h3 className="text-[44px] font-[800] uppercase mt-2 font-mono">0 BYTES</h3>
              </div>
              <p className="text-[13px] border-t-2 border-ink pt-3 mt-6">Signaling offers/answers vanish from memory immediately upon peer channel handshake.</p>
            </div>
            <div className="bg-sand p-6 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono text-ink uppercase font-[700]">CHECKSUM SECURITY</span>
                <h3 className="text-[44px] font-[800] uppercase mt-2 font-mono">SHA-256</h3>
              </div>
              <p className="text-[13px] border-t-2 border-ink pt-3 mt-6 font-[600]">Client-side Web Worker hash-wasm digest calculated incrementally with live streaming.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ink Mechanism Band */}
      <section className="w-full bg-ink text-cream py-14 md:py-20 border-b-2 border-ink">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <span className="text-[12px] font-mono text-coral uppercase tracking-widest font-[700]">MECHANISM // ARCHITECTURE</span>
            <h2 className="text-[36px] md:text-[48px] font-[800] uppercase tracking-tight text-cream">HOW THE MESH STACK OPERATES</h2>
            <div className="flex flex-col border-t-2 border-cream mt-2">
              <div className="py-5 border-b border-cream-hairline flex items-start gap-4">
                <span className="text-[28px] font-[800] text-coral font-mono shrink-0">01</span>
                <div>
                  <h4 className="text-[18px] font-[800] uppercase text-cream">STUN DISCOVERY &amp; ICE GATHERING</h4>
                  <p className="text-[14px] text-sand mt-1">Both browsers ping an RFC 8489 STUN server solely to discover their reflexive public UDP IP/port candidates.</p>
                </div>
              </div>
              <div className="py-5 border-b border-cream-hairline flex items-start gap-4">
                <span className="text-[28px] font-[800] text-coral font-mono shrink-0">02</span>
                <div>
                  <h4 className="text-[18px] font-[800] uppercase text-cream">EPHEMERAL SIGNALING EXCHANGE</h4>
                  <p className="text-[14px] text-sand mt-1">Session Description Protocol (SDP) payloads are exchanged via authenticated Socket.IO channels. Never written to persistent storage.</p>
                </div>
              </div>
              <div className="py-5 border-b border-cream-hairline flex items-start gap-4">
                <span className="text-[28px] font-[800] text-coral font-mono shrink-0">03</span>
                <div>
                  <h4 className="text-[18px] font-[800] uppercase text-cream">DIRECT SCTP SOCKET OPENING</h4>
                  <p className="text-[14px] text-sand mt-1">Signaling terminates. A direct end-to-end encrypted DTLS 1.3 socket bridges the machines at maximum link capacity.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Guarantee Card */}
          <div className="lg:col-span-5 bg-cream text-ink p-8 border-2 border-cream flex flex-col justify-between hard-shadow-coral">
            <div>
              <div className="flex items-center justify-between border-b-2 border-ink pb-2 mb-4 font-mono">
                <span className="text-[12px] font-[800] uppercase">SOVEREIGNTY GUARANTEE</span>
                <span className="bg-coral px-2 py-0.5 text-[11px] font-[800] uppercase">ZERO RETENTION</span>
              </div>
              <h3 className="text-[26px] font-[800] uppercase tracking-tight mb-4">WHAT WE STORE ON OUR SERVERS:</h3>
              <div className="space-y-3 font-mono text-[13px] font-[700]">
                <div className="flex items-center gap-2 text-ink">
                  <span className="w-2.5 h-2.5 bg-coral inline-block"></span>
                  <span>FILE METADATA / FILENAMES ONLY</span>
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <span className="w-2.5 h-2.5 bg-coral inline-block"></span>
                  <span>USER IP ADDRESS ARCHIVES: ZERO</span>
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <span className="w-2.5 h-2.5 bg-coral inline-block"></span>
                  <span>TRANSMISSION PAYLOAD BYTES: 0 BYTES</span>
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <span className="w-2.5 h-2.5 bg-coral inline-block"></span>
                  <span>TRACKING COOKIES: ZERO</span>
                </div>
                <div className="flex items-center gap-2 text-cobalt pt-2 border-t-2 border-ink">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  <span>100% IN-MEMORY CLIENT BROWSER EXECUTION</span>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-4 border-t-2 border-ink">
              <Link
                to="/dashboard"
                className="w-full h-[46px] rounded-full border-2 border-ink bg-cobalt text-cream font-mono font-[700] text-[13px] uppercase tracking-wider flex items-center justify-center hover:bg-sand hover:text-ink transition-colors"
              >
                LAUNCH DASHBOARD WORKBENCH
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
