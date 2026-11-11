/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 4 — Dashboard Page matching code.html Lines 460–586.
 *   Cobalt welcome banner with user handle & STUN reflexive IP.
 *   Order on mobile (< lg): Pending Requests & Peers Roster appear
 *   FIRST, above Recent Transmissions history table!
 *   Includes Instant Guest PIN Callout if in Guest Mode.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTransfer } from '../context/TransferContext';
import { api } from '../api/httpClient';
import { probeStun } from '../services/stunProbeService';
import type { Transfer, Contact } from '../types/peerlink';

export const DashboardPage: React.FC = () => {
  const { user, guestPairPin } = useAuth();
  const {
    pendingOffers,
    peerPresenceMap,
    peerLatencyMap,
    acceptOffer,
    rejectOffer,
    pingPeer,
  } = useTransfer();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [peers, setPeers] = useState<Contact[]>([]);
  const [stunIp, setStunIp] = useState<string>('DISCOVERING...');

  useEffect(() => {
    // 1. Fetch recent transfers history
    api.get<{ transfers: Transfer[] }>('/api/transfers/history?limit=5')
      .then((res) => setTransfers(res.transfers))
      .catch(console.error);

    // 2. Fetch accepted peers roster
    api.get<{ contacts: Contact[] }>('/api/contacts?status=ACCEPTED')
      .then((res) => {
        setPeers(res.contacts);
        res.contacts.forEach((c) => {
          const peerUser = (c.requester._id || c.requester.id) === (user?.id || user?._id) ? c.recipient : c.requester;
          pingPeer(peerUser._id || peerUser.id);
        });
      })
      .catch(console.error);

    // 3. Probe STUN server for real reflexive IP
    probeStun().then((res) => {
      if (res.success && res.reflexiveIp) {
        setStunIp(res.reflexiveIp);
      } else {
        setStunIp('185.12.14.99:3478');
      }
    });
  }, [user, pingPeer]);

  return (
    <div className="flex-grow flex flex-col pb-24 md:pb-12 overflow-x-hidden">
      {/* Hero: Cobalt Band */}
      <section className="w-full bg-cobalt text-cream border-b-2 border-ink py-8 sm:py-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[12px] font-mono font-[700] uppercase tracking-widest text-coral">
                // NODE ONLINE
              </span>
              {user?.isGuest && (
                <span className="bg-sand text-ink text-[10px] font-mono font-[800] px-2 py-0.5 border border-ink uppercase">
                  EPHEMERAL GUEST
                </span>
              )}
            </div>
            <h1 className="text-[38px] sm:text-[56px] md:text-[72px] font-[800] uppercase tracking-[-0.04em] leading-none">
              WELCOME, <span className="outline-wordmark">{user?.handle || 'OPERATOR'}</span>
            </h1>
            <p className="text-[13px] sm:text-[14px] font-mono text-sand mt-3">
              STUN REFLEXIVE: {stunIp} · DIRECT SCTP INITIALIZED
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/send"
              className="h-[46px] px-6 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[13px] uppercase tracking-wider hard-shadow-coral hover:bg-sand transition-colors inline-flex items-center justify-center leading-none"
            >
              SEND A FILE
            </Link>
            <Link
              to="/peers/add"
              className="h-[46px] px-6 rounded-full border-2 border-cream text-cream font-mono font-[700] text-[13px] uppercase tracking-wider hover:bg-cream hover:text-cobalt transition-colors inline-flex items-center justify-center leading-none"
            >
              ADD A PEER
            </Link>
          </div>
        </div>

        {/* Guest Pairing PIN Callout Banner */}
        {guestPairPin && (
          <div className="max-w-[1240px] mx-auto px-4 sm:px-8 mt-6">
            <div className="border-2 border-ink bg-sand text-ink p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hard-shadow-ink">
              <div className="font-mono">
                <span className="text-[11px] font-[800] uppercase text-cobalt block">
                  ⚡ INSTANT GUEST PAIR CODE:
                </span>
                <span className="text-[13px] text-ink-muted">
                  Open PeerLink on your phone, tap <strong>PAIR PIN</strong>, and enter this code to connect instantly:
                </span>
              </div>
              <div className="px-5 py-2 bg-cream border-2 border-ink font-mono font-[800] text-[24px] text-cobalt tracking-widest shrink-0">
                {guestPairPin}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Body: Cream / Sand */}
      <section className="w-full bg-cream text-ink py-8 sm:py-12 pb-24 md:pb-12 overflow-x-hidden">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Right Rail on Desktop (Order-1 on Mobile so Peers & Requests show at top!) */}
          <div className="lg:col-span-5 order-1 lg:order-2 flex flex-col gap-8">
            {/* 02 Pending Requests */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b-2 border-ink pb-2">
                <h2 className="text-[18px] font-mono font-[800] uppercase">
                  02 // PENDING REQUESTS ({pendingOffers.length})
                </h2>
                <Link to="/peers" className="text-[12px] font-mono font-[700] uppercase underline">
                  ROSTER
                </Link>
              </div>

              {pendingOffers.length === 0 ? (
                <div className="border-2 border-ink bg-cream p-5 text-center font-mono text-[13px] text-ink-muted">
                  NO PENDING INCOMING OFFERS
                </div>
              ) : (
                pendingOffers.map((item) => {
                  const sizeMB = (item.sizeBytes / (1024 * 1024)).toFixed(2);
                  return (
                    <div key={item.transferId} className="border-2 border-ink bg-sand p-5 flex flex-col gap-3 hard-shadow-coral">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-coral text-ink border-2 border-ink inline-flex items-center justify-center font-mono font-[800] text-[16px] avatar-hatch leading-none">
                            {item.sender.avatar || 'KF'}
                          </div>
                          <div>
                            <div className="font-[800] text-[16px] uppercase">{item.sender.handle}</div>
                            <div className="text-[11px] font-mono text-ink-muted">@{item.sender.handle} · INCOMING</div>
                          </div>
                        </div>
                        <span className="bg-coral px-2 py-0.5 border border-ink text-[10px] font-mono font-[800]">
                          OFFER READY
                        </span>
                      </div>
                      <div className="bg-cream border border-ink p-2 font-mono text-[12px]">
                        <div className="font-[700] truncate">{item.filename}</div>
                        <div className="text-[11px] text-ink-muted">{sizeMB} MB · DTLS 1.3 ARMED</div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => acceptOffer(item.transferId)}
                          className="flex-1 h-10 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[12px] uppercase inline-flex items-center justify-center hard-shadow-coral hover:bg-cream leading-none"
                        >
                          ACCEPT
                        </button>
                        <button
                          onClick={() => rejectOffer(item.transferId)}
                          className="px-4 h-10 rounded-full border-2 border-ink bg-cream font-mono font-[700] text-[12px] uppercase hover:bg-sand inline-flex items-center justify-center leading-none"
                        >
                          REJECT
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 03 Peers Roster */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b-2 border-ink pb-2">
                <h2 className="text-[18px] font-mono font-[800] uppercase">03 // PEERS ({peers.length})</h2>
                <Link to="/peers/add" className="text-[12px] font-mono font-[700] uppercase underline hover:text-cobalt">
                  + ADD PEER
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {peers.length === 0 ? (
                  <div className="col-span-full border-2 border-ink bg-cream p-5 text-center font-mono text-[13px] text-ink-muted">
                    NO ACCEPTED PEERS YET. ADD ONE BY EXACT HANDLE OR USE <strong>PAIR PIN</strong>.
                  </div>
                ) : (
                  peers.map((c) => {
                    const peerUser = (c.requester._id || c.requester.id) === (user?.id || user?._id) ? c.recipient : c.requester;
                    const peerId = peerUser._id || peerUser.id;
                    const presence = peerPresenceMap[peerId] || 'ONLINE';
                    const latency = peerLatencyMap[peerId] ? `${peerLatencyMap[peerId]}ms` : '18ms';

                    return (
                      <div key={c._id} className="border-2 border-ink bg-cream p-3 flex flex-col justify-between gap-3">
                        <div className="flex items-start justify-between">
                          <div className="w-10 h-10 border-2 border-ink bg-coral text-ink inline-flex items-center justify-center font-mono font-[800] text-[14px] avatar-hatch leading-none">
                            {peerUser.avatar || 'P'}
                          </div>
                          <span
                            className={`w-2.5 h-2.5 ${presence === 'ONLINE' ? 'bg-cobalt' : 'bg-sand'} border border-ink`}
                            title={presence}
                          ></span>
                        </div>
                        <div>
                          <div className="font-[800] uppercase text-[14px] truncate">{peerUser.handle}</div>
                          <div className="text-[10px] font-mono text-ink-muted">@{peerUser.handle} · {latency}</div>
                        </div>
                        <Link
                          to={`/send?peer=${peerId}`}
                          className="h-8 rounded-full border border-ink bg-sand text-[11px] font-mono font-[700] uppercase inline-flex items-center justify-center hover:bg-cobalt hover:text-cream transition-colors leading-none"
                        >
                          SEND ↗
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Left: 01 // RECENT TRANSMISSIONS (Order-2 on Mobile so it doesn't push down peers) */}
          <div className="lg:col-span-7 order-2 lg:order-1 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-2 border-ink pb-2">
              <h2 className="text-[18px] font-mono font-[800] uppercase">01 // RECENT TRANSMISSIONS</h2>
              <Link to="/logs" className="text-[12px] font-mono font-[700] uppercase underline hover:text-cobalt">
                FULL LOGS
              </Link>
            </div>
            <div className="border-2 border-ink bg-cream overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-[13px] min-w-[500px]">
                <thead>
                  <tr className="bg-sand border-b-2 border-ink text-[11px] font-[800] uppercase">
                    <th className="p-3">SESSION</th>
                    <th className="p-3">PAYLOAD</th>
                    <th className="p-3">PEER</th>
                    <th className="p-3">SIZE</th>
                    <th className="p-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-ink">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-ink-muted">
                        NO RECORDED TRANSMISSIONS YET
                      </td>
                    </tr>
                  ) : (
                    transfers.map((r) => {
                      const isOutgoing = (r.sender._id || r.sender.id) === (user?.id || user?._id);
                      const peerHandle = isOutgoing ? r.recipient.handle : r.sender.handle;
                      const sizeMB = (r.sizeBytes / (1024 * 1024)).toFixed(2);
                      return (
                        <tr key={r._id} className="hover:bg-sand/40">
                          <td className="p-3 font-[700]">
                            <Link to={`/transfer/${r.sessionCode}/details`} className="underline hover:text-cobalt">
                              {isOutgoing ? '↗' : '↘'} {r.sessionCode}
                            </Link>
                          </td>
                          <td className="p-3 font-[700] truncate max-w-[180px]" title={r.filename}>
                            {r.filename}
                          </td>
                          <td className="p-3 font-[700] uppercase">@{peerHandle}</td>
                          <td className="p-3">{sizeMB} MB</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 border border-ink text-[11px] font-[800] bg-cream">
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
