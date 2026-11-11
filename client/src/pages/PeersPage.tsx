/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 5 — Peer Directory Page matching code.html Lines 589–715.
 *   Ink header + 4 tabs: PEERS, INCOMING, OUTGOING, BLOCKED.
 *   Provides real-time contact management and offer acceptance.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTransfer } from '../context/TransferContext';
import { api } from '../api/httpClient';
import type { Contact } from '../types/peerlink';

export const PeersPage: React.FC = () => {
  const { user } = useAuth();
  const {
    peerPresenceMap,
    peerLatencyMap,
    pendingOffers,
    acceptOffer,
    rejectOffer,
    showToast,
    pingPeer,
  } = useTransfer();

  const [activeTab, setActiveTab] = useState<'peers' | 'incoming' | 'outgoing' | 'blocked'>('peers');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ contacts: Contact[] }>('/api/contacts');
      setContacts(res.contacts);
      res.contacts.forEach((c) => {
        const peer = (c.requester._id || c.requester.id) === (user?.id || user?._id) ? c.recipient : c.requester;
        pingPeer(peer._id || peer.id);
      });
    } catch (err: any) {
      showToast(err.message || 'FAILED TO LOAD CONTACTS');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [user]);

  // Derived lists
  const currentUserId = user?.id || user?._id;
  const acceptedPeers = contacts.filter((c) => c.status === 'ACCEPTED');
  const incomingRequests = contacts.filter((c) => c.status === 'PENDING' && (c.recipient._id || c.recipient.id) === currentUserId);
  const outgoingRequests = contacts.filter((c) => c.status === 'PENDING' && (c.requester._id || c.requester.id) === currentUserId);
  const blockedContacts = contacts.filter((c) => c.status === 'BLOCKED');

  const handleRespondContact = async (contactId: string, action: 'ACCEPTED' | 'REJECTED') => {
    try {
      await api.patch(`/api/contacts/${contactId}/respond`, { action });
      showToast(`CONTACT REQUEST ${action}.`);
      fetchContacts();
    } catch (err: any) {
      showToast(err.message || 'FAILED TO RESPOND');
    }
  };

  const handleBlock = async (contactId: string) => {
    if (!window.confirm('BLOCK PEER: Halt all P2P interactions?')) return;
    try {
      await api.post(`/api/contacts/${contactId}/block`, { reason: 'User initiated block' });
      showToast('PEER BLOCKED.');
      fetchContacts();
    } catch (err: any) {
      showToast(err.message || 'FAILED TO BLOCK');
    }
  };

  const handleUnblock = async (contactId: string) => {
    try {
      await api.delete(`/api/contacts/${contactId}/block`);
      showToast('PEER RESTORED.');
      fetchContacts();
    } catch (err: any) {
      showToast(err.message || 'FAILED TO UNBLOCK');
    }
  };

  return (
    <>
      {/* Ink Band Header */}
      <section className="w-full bg-ink text-cream border-b-2 border-ink py-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-[12px] font-mono font-[700] uppercase tracking-widest text-coral">
              // CONSENT-GATED ROSTER
            </span>
            <h2 className="text-[40px] md:text-[56px] font-[800] uppercase tracking-tight text-cream leading-none mt-1">
              PEER DIRECTORY
            </h2>
          </div>
          <Link
            to="/peers/add"
            className="h-[46px] px-6 rounded-full border-2 border-cream bg-coral text-ink font-mono font-[700] text-[13px] uppercase hard-shadow-coral hover:bg-sand transition-colors"
          >
            + CONNECT REMOTE PEER
          </Link>
        </div>
      </section>

      {/* Tabs & Lists */}
      <section className="w-full bg-cream text-ink py-10 pb-24 md:pb-10 flex-grow overflow-x-hidden">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 flex flex-col gap-6">
          {/* Tabs */}
          <div className="flex flex-wrap sm:flex-nowrap overflow-x-auto gap-2 border-b-2 border-ink pb-2" role="tablist">
            <button
              onClick={() => setActiveTab('peers')}
              className={`px-5 py-2 font-mono font-[700] text-[13px] uppercase border-2 border-ink whitespace-nowrap ${
                activeTab === 'peers' ? 'bg-ink text-cream' : 'bg-sand hover:bg-cream'
              }`}
            >
              PEERS ({acceptedPeers.length})
            </button>
            <button
              onClick={() => setActiveTab('incoming')}
              className={`px-5 py-2 font-mono font-[700] text-[13px] uppercase border-2 border-ink whitespace-nowrap ${
                activeTab === 'incoming' ? 'bg-ink text-cream' : 'bg-sand hover:bg-cream'
              }`}
            >
              INCOMING ({incomingRequests.length + pendingOffers.length})
            </button>
            <button
              onClick={() => setActiveTab('outgoing')}
              className={`px-5 py-2 font-mono font-[700] text-[13px] uppercase border-2 border-ink whitespace-nowrap ${
                activeTab === 'outgoing' ? 'bg-ink text-cream' : 'bg-sand hover:bg-cream'
              }`}
            >
              OUTGOING ({outgoingRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('blocked')}
              className={`px-5 py-2 font-mono font-[700] text-[13px] uppercase border-2 border-ink whitespace-nowrap ${
                activeTab === 'blocked' ? 'bg-ink text-cream' : 'bg-sand hover:bg-cream'
              }`}
            >
              BLOCKED ({blockedContacts.length})
            </button>
          </div>

          {/* Tab Body */}
          <div id="peers-tab-body">
            {activeTab === 'peers' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {acceptedPeers.length === 0 ? (
                  <div className="col-span-full border-2 border-ink bg-cream p-8 text-center font-mono text-[14px] text-ink-muted">
                    NO ACCEPTED PEERS IN DIRECTORY. CONNECT A PEER TO BEGIN.
                  </div>
                ) : (
                  acceptedPeers.map((p) => {
                    const peerUser = (p.requester._id || p.requester.id) === currentUserId ? p.recipient : p.requester;
                    const peerId = peerUser._id || peerUser.id;
                    const presence = peerPresenceMap[peerId] || 'ONLINE';
                    const latency = peerLatencyMap[peerId] ? `${peerLatencyMap[peerId]}ms` : '18ms';

                    return (
                      <div key={p._id} className="border-2 border-ink bg-cream p-5 flex flex-col justify-between gap-5 hard-shadow-ink">
                        <div className="flex items-start justify-between">
                          <div className="w-14 h-14 border-2 border-ink bg-coral text-ink flex items-center justify-center font-mono font-[800] text-[18px] avatar-hatch">
                            {peerUser.avatar || 'P'}
                          </div>
                          <span
                            className={`px-2 py-0.5 border border-ink text-[11px] font-mono font-[800] ${
                              presence === 'ONLINE' ? 'bg-cobalt text-cream' : 'bg-sand text-ink'
                            }`}
                          >
                            {presence}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-[18px] font-[800] uppercase truncate">{peerUser.handle}</h3>
                          <div className="text-[11px] font-mono text-ink-muted">@{peerUser.handle} · {latency}</div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t-2 border-ink">
                          <Link
                            to={`/send?peer=${peerId}`}
                            className="flex-1 h-9 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[12px] uppercase flex items-center justify-center hard-shadow-coral hover:bg-sand"
                          >
                            SEND
                          </Link>
                          <button
                            onClick={() => handleBlock(p._id)}
                            className="px-3 h-9 rounded-full border-2 border-ink bg-sand font-mono font-[700] text-[11px] uppercase hover:bg-ink hover:text-cream"
                          >
                            BLOCK
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'incoming' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Incoming transfer stream offers */}
                {pendingOffers.map((item) => {
                  const sizeMB = (item.sizeBytes / (1024 * 1024)).toFixed(2);
                  return (
                    <div key={item.transferId} className="border-2 border-ink bg-sand p-6 flex flex-col justify-between gap-4 hard-shadow-coral">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-coral border-2 border-ink flex items-center justify-center font-mono font-[800] text-[16px] avatar-hatch">
                            {item.sender.avatar || 'KF'}
                          </div>
                          <div>
                            <div className="text-[18px] font-[800] uppercase">{item.sender.handle}</div>
                            <div className="text-[11px] font-mono text-ink-muted">@{item.sender.handle} · INCOMING OFFER</div>
                          </div>
                        </div>
                        <span className="bg-coral px-2 py-0.5 border border-ink text-[11px] font-mono font-[800]">
                          OFFER READY
                        </span>
                      </div>
                      <div className="p-3 bg-cream border border-ink font-mono text-[12px]">
                        <div className="font-[700]">{item.filename}</div>
                        <div className="text-[11px] text-ink-muted">{sizeMB} MB · SHA-256 ARMED</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptOffer(item.transferId)}
                          className="flex-1 h-10 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[12px] uppercase flex items-center justify-center hard-shadow-coral hover:bg-sand"
                        >
                          ACCEPT & STREAM
                        </button>
                        <button
                          onClick={() => rejectOffer(item.transferId)}
                          className="px-4 h-10 rounded-full border-2 border-ink bg-cream font-mono font-[700] text-[12px] uppercase"
                        >
                          REJECT
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Incoming contact friendship requests */}
                {incomingRequests.map((req) => (
                  <div key={req._id} className="border-2 border-ink bg-sand p-6 flex flex-col justify-between gap-4 hard-shadow-coral">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-coral border-2 border-ink flex items-center justify-center font-mono font-[800] text-[16px] avatar-hatch">
                          {req.requester.avatar || 'P'}
                        </div>
                        <div>
                          <div className="text-[18px] font-[800] uppercase">{req.requester.handle}</div>
                          <div className="text-[11px] font-mono text-ink-muted">@{req.requester.handle} · PEER REQUEST</div>
                        </div>
                      </div>
                      <span className="bg-coral px-2 py-0.5 border border-ink text-[11px] font-mono font-[800]">
                        PEER REQUEST
                      </span>
                    </div>
                    <p className="text-[13px] font-mono text-ink-muted">
                      Node {req.requester.nodeId} requested consent to transmit WebRTC data.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespondContact(req._id, 'ACCEPTED')}
                        className="flex-1 h-10 rounded-full border-2 border-ink bg-coral text-ink font-mono font-[700] text-[12px] uppercase flex items-center justify-center hard-shadow-coral hover:bg-sand"
                      >
                        ACCEPT PEER
                      </button>
                      <button
                        onClick={() => handleRespondContact(req._id, 'REJECTED')}
                        className="px-4 h-10 rounded-full border-2 border-ink bg-cream font-mono font-[700] text-[12px] uppercase"
                      >
                        REJECT
                      </button>
                    </div>
                  </div>
                ))}

                {pendingOffers.length === 0 && incomingRequests.length === 0 && (
                  <div className="col-span-full border-2 border-ink bg-cream p-8 text-center font-mono text-[14px] text-ink-muted">
                    ZERO PENDING INCOMING OFFERS OR CONTACT REQUESTS.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'outgoing' && (
              <div className="border-2 border-ink bg-cream divide-y-2 divide-ink font-mono">
                {outgoingRequests.length === 0 ? (
                  <div className="p-8 text-center text-ink-muted text-[14px]">
                    NO PENDING OUTGOING CONTACT REQUESTS.
                  </div>
                ) : (
                  outgoingRequests.map((o) => (
                    <div key={o._id} className="p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-ink-muted uppercase">OUTGOING TO: @{o.recipient.handle}</span>
                        <div className="font-[800] text-[16px] uppercase">{o.recipient.nodeId}</div>
                      </div>
                      <span className="h-9 px-4 rounded-full border-2 border-ink bg-sand text-[11px] font-[700] uppercase flex items-center">
                        PENDING CONSENT
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'blocked' && (
              <div className="border-2 border-ink bg-cream divide-y-2 divide-ink font-mono">
                {blockedContacts.length === 0 ? (
                  <div className="p-8 text-center text-ink-muted text-[14px]">
                    NO BLOCKED NODES.
                  </div>
                ) : (
                  blockedContacts.map((b) => {
                    const peerUser = (b.requester._id || b.requester.id) === currentUserId ? b.recipient : b.requester;
                    return (
                      <div key={b._id} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-[800] text-[15px] uppercase">@{peerUser.handle}</div>
                          <div className="text-[11px] text-ink-muted">REASON: {b.blockReason || 'Manual block'}</div>
                        </div>
                        <button
                          onClick={() => handleUnblock(b._id)}
                          className="h-9 px-4 rounded-full border-2 border-ink bg-sand text-[11px] font-[700] uppercase hover:bg-cobalt hover:text-cream"
                        >
                          UNBLOCK
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};
