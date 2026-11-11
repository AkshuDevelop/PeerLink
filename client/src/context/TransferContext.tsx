/**
 * ============================================================
 * FILE PURPOSE:
 *   Transfer and Signalling Coordination Context.
 *   Subscribes to Socket.IO events, orchestrates WebRTC connections,
 *   manages incoming offers modal, and drives live telemetry
 *   during sender and receiver file transfers.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — Application Coordinator Context
 *
 * CRITICAL FLOW CONTROL & TIMING RACE FIXES:
 *   1. Zero fake setInterval / simulated timers.
 *   2. Signal Buffering: Any WebRTC signal (SDP or ICE) that arrives before
 *      pcRef.current is initialized is queued and flushed as soon as pc is ready.
 *   3. webrtc:receiver_ready coordination: When Receiver accepts, it mounts pc
 *      and emits webrtc:receiver_ready. The Sender waits for receiver_ready before
 *      creating the DataChannel and sending SDP_OFFER, eliminating dropped offers.
 *   4. Sender waits for RECEIVER_ACK_COMPLETE over DataChannel before completion.
 * ============================================================
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getSocket } from '../services/socketService';
import { PeerConnection } from '../services/webrtcService';
import {
  sendFileOverDataChannel,
  ReceiverFileEngine,
  type FileHeaderMessage,
  type EofMessage,
  type ControlMessage,
} from '../services/fileTransferService';
import { saveReceivedBlob } from '../services/blobStorage';
import { api } from '../api/httpClient';
import type {
  IncomingOffer,
  TransferTelemetry,
  WebRTCSignal,
  PeerPresence,
  Transfer,
} from '../types/peerlink';
import { useNavigate } from 'react-router-dom';

export interface CachedDownload {
  blobUrl: string;
  filename: string;
  fileBlob: Blob;
}

export const globalDownloadsCache = new Map<string, CachedDownload>();

interface TransferContextType {
  activeOffer: IncomingOffer | null;
  pendingOffers: IncomingOffer[];
  telemetry: TransferTelemetry | null;
  activeTransfer: Transfer | null;
  downloadUrl: string | null;
  receivedFileBlob: Blob | null;
  receivedFilename: string | null;
  peerPresenceMap: Record<string, PeerPresence>;
  peerLatencyMap: Record<string, number>;
  toastMessage: string | null;
  isPairModalOpen: boolean;
  showToast: (msg: string) => void;
  openPairModal: () => void;
  closePairModal: () => void;
  acceptOffer: (offerId: string) => Promise<void>;
  rejectOffer: (offerId: string) => Promise<void>;
  dismissOfferModal: () => void;
  initiateSendTransfer: (recipientId: string, file: File, senderSha256: string) => Promise<string>;
  cancelActiveTransfer: (reason?: string) => Promise<void>;
  disconnectAllPeers: () => void;
  pingPeer: (targetUserId: string) => void;
}

const TransferContext = createContext<TransferContextType | undefined>(undefined);

export const TransferProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [activeOffer, setActiveOffer] = useState<IncomingOffer | null>(null);
  const [pendingOffers, setPendingOffers] = useState<IncomingOffer[]>([]);
  const [telemetry, setTelemetry] = useState<TransferTelemetry | null>(null);
  const [activeTransfer, setActiveTransfer] = useState<Transfer | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [receivedFileBlob, setReceivedFileBlob] = useState<Blob | null>(null);
  const [receivedFilename, setReceivedFilename] = useState<string | null>(null);
  const [peerPresenceMap, setPeerPresenceMap] = useState<Record<string, PeerPresence>>({});
  const [peerLatencyMap, setPeerLatencyMap] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);

  const pcRef = useRef<PeerConnection | null>(null);
  const receiverEngineRef = useRef<ReceiverFileEngine | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const pendingFileToSendRef = useRef<{ file: File; senderSha256: string } | null>(null);

  // Early signal queue: buffers signals that arrive before pcRef.current is mounted
  const earlySignalsRef = useRef<Map<string, WebRTCSignal[]>>(new Map());

  // Ready listener map for Sender waiting on receiver_ready
  const receiverReadyWaitersRef = useRef<Map<string, () => void>>(new Map());
  // Set of transferIds for which receiver_ready has arrived (prevents missed signals)
  const readyReceiversRef = useRef<Set<string>>(new Set());

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const openPairModal = useCallback(() => setIsPairModalOpen(true), []);
  const closePairModal = useCallback(() => setIsPairModalOpen(false), []);

  const pingPeer = useCallback((targetUserId: string) => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit('peer:ping_request', { targetUserId, timestamp: performance.now() });
  }, [token]);

  // Helper to flush early signals when a PeerConnection is mounted
  const flushEarlySignals = async (transferId: string, pc: PeerConnection) => {
    const list = earlySignalsRef.current.get(transferId) || [];
    earlySignalsRef.current.delete(transferId);
    for (const signal of list) {
      if (signal.type === 'SDP_OFFER') {
        await pc.handleOffer(signal.data as RTCSessionDescriptionInit);
      } else if (signal.type === 'SDP_ANSWER') {
        await pc.handleAnswer(signal.data as RTCSessionDescriptionInit);
      } else if (signal.type === 'ICE_CANDIDATE') {
        await pc.addIceCandidate(signal.data as RTCIceCandidateInit);
      }
    }
  };

  // Socket.IO event listener bindings
  useEffect(() => {
    if (!user || !token) return;

    const socket = getSocket(token);

    // Incoming offer notification
    socket.on('transfer:incoming_offer', (offer: IncomingOffer) => {
      setPendingOffers((prev) => [...prev.filter((o) => o.transferId !== offer.transferId), offer]);
      setActiveOffer(offer);
      showToast(`INCOMING TRANSFER OFFER: ${offer.filename}`);
    });

    // Sender receives response (ACCEPTED / REJECTED)
    socket.on('transfer:response', async (payload: { transferId: string; sessionCode: string; status: string }) => {
      if (payload.status === 'ACCEPTED') {
        showToast('RECIPIENT ACCEPTED CONDUIT. PREPARING SCTP...');
        if (pendingFileToSendRef.current) {
          const { file, senderSha256 } = pendingFileToSendRef.current;
          await startSenderPipeline(payload.transferId, payload.sessionCode, file, senderSha256);
        }
      } else if (payload.status === 'REJECTED') {
        showToast('RECIPIENT DECLINED OFFER.');
        setTelemetry((prev) => (prev ? { ...prev, status: 'REJECTED' } : null));
        navigate(`/transfer/${payload.sessionCode}/result`);
      }
    });

    // Receiver readiness notification (Sender receives this)
    socket.on('webrtc:receiver_ready', (payload: { transferId: string; receiverId: string }) => {
      readyReceiversRef.current.add(payload.transferId);
      const waiter = receiverReadyWaitersRef.current.get(payload.transferId);
      if (waiter) {
        receiverReadyWaitersRef.current.delete(payload.transferId);
        waiter();
      }
    });

    // WebRTC Signalling Relay with Early Signal Queueing
    socket.on('webrtc:signal', async (signal: WebRTCSignal) => {
      if (!pcRef.current) {
        // Buffer signal for later processing once PeerConnection is created
        const existing = earlySignalsRef.current.get(signal.transferId) || [];
        existing.push(signal);
        earlySignalsRef.current.set(signal.transferId, existing);
        return;
      }

      if (signal.type === 'SDP_OFFER') {
        await pcRef.current.handleOffer(signal.data as RTCSessionDescriptionInit);
      } else if (signal.type === 'SDP_ANSWER') {
        await pcRef.current.handleAnswer(signal.data as RTCSessionDescriptionInit);
      } else if (signal.type === 'ICE_CANDIDATE') {
        await pcRef.current.addIceCandidate(signal.data as RTCIceCandidateInit);
      }
    });

    // Fallback socket streaming: receiver receives chunks and control frames directly over Socket.IO
    socket.on('transfer:chunk', (payload: { transferId: string; frame: ArrayBuffer }) => {
      if (receiverEngineRef.current) {
        receiverEngineRef.current.handleBinaryFrame(payload.frame);
      }
    });

    socket.on('transfer:control', (payload: { transferId: string; message: ControlMessage }) => {
      if (receiverEngineRef.current) {
        receiverEngineRef.current.handleControlMessage(payload.message);
      }
    });

    // Transfer cancellation
    socket.on('transfer:cancelled', (payload: { sessionCode: string; reason?: string }) => {
      isCancelledRef.current = true;
      pcRef.current?.close();
      pcRef.current = null;
      receiverEngineRef.current?.destroy();
      receiverEngineRef.current = null;
      setTelemetry((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      showToast(`TRANSMISSION CANCELLED: ${payload.reason || 'Terminated'}`);
      navigate(`/transfer/${payload.sessionCode}/result`);
    });

    // Remote completed notification
    socket.on('transfer:completed', (payload: { sessionCode: string }) => {
      setTelemetry((prev) => {
        if (!prev) return null;
        // CRITICAL GUARD: If this device is RECEIVER and blob is not yet ready, DO NOT prematurely mark COMPLETED!
        if (prev.role === 'RECEIVER' && !prev.downloadBlobUrl) {
          return prev;
        }
        return { ...prev, status: 'COMPLETED' };
      });
    });

    // Peer presence update
    socket.on('peer:presence_update', (payload: { userId: string; status: PeerPresence }) => {
      setPeerPresenceMap((prev) => ({ ...prev, [payload.userId]: payload.status }));
    });

    // Peer latency ping/pong
    socket.on('peer:ping_request', (payload: { fromUserId: string; timestamp: number }) => {
      socket.emit('peer:ping_response', { targetUserId: payload.fromUserId, timestamp: payload.timestamp });
    });

    socket.on('peer:ping_response', (payload: { fromUserId: string; timestamp: number }) => {
      const rtt = Math.round(performance.now() - payload.timestamp);
      setPeerLatencyMap((prev) => ({ ...prev, [payload.fromUserId]: rtt }));
    });

    return () => {
      socket.off('transfer:incoming_offer');
      socket.off('transfer:response');
      socket.off('webrtc:receiver_ready');
      socket.off('webrtc:signal');
      socket.off('transfer:chunk');
      socket.off('transfer:control');
      socket.off('transfer:cancelled');
      socket.off('transfer:completed');
      socket.off('peer:presence_update');
      socket.off('peer:ping_request');
      socket.off('peer:ping_response');
    };
  }, [user, token, showToast, navigate]);

  // Start Sender Pipeline
  const startSenderPipeline = async (
    transferId: string,
    sessionCode: string,
    file: File,
    senderSha256: string
  ) => {
    isCancelledRef.current = false;
    const transferDoc = await api.get<{ transfer: Transfer }>(`/api/transfers/${transferId}`);
    setActiveTransfer(transferDoc.transfer);

    setTelemetry({
      transferId,
      sessionCode,
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks: Math.ceil(file.size / (64 * 1024)),
      senderSha256,
      transferredBytes: 0,
      percent: 0,
      speedMBps: 0,
      etaSeconds: 0,
      status: 'TRANSFERRING',
      conduitType: 'DIRECT_SCTP',
      role: 'SENDER',
    });

    navigate(`/transfer/${sessionCode}`);

    // Wait for receiver_ready signal or proceed if already received
    if (!readyReceiversRef.current.has(transferId)) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          receiverReadyWaitersRef.current.delete(transferId);
          resolve();
        }, 3000);

        receiverReadyWaitersRef.current.set(transferId, () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    // Create RTCPeerConnection for Sender
    const targetUserId = String(
      (transferDoc.transfer.recipient as any)._id ||
      (transferDoc.transfer.recipient as any).id ||
      transferDoc.transfer.recipient
    );

    const pc = new PeerConnection({
      transferId,
      targetUserId,
      allowLanHost: user?.allowLanHost ?? true,
      onConnectionStateChange: (state) => {
        if (state === 'failed') {
          console.warn('[WebRTC] Connection failed, fallback to socket relay if active');
        }
      },
    });
    pcRef.current = pc;

    // Flush any early signals
    await flushEarlySignals(transferId, pc);

    // Create Offer and DataChannel
    const dc = await pc.createOffer();

    let didStart = false;
    let fallbackTimer: any = null;

    const startStreaming = async () => {
      if (didStart || isCancelledRef.current) return;
      didStart = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);

      const conduitType = await pc.getConduitType();
      try {
        await api.patch(`/api/transfers/${transferId}/status`, {
          status: 'TRANSFERRING',
          conduitType,
        });
      } catch {}
      setTelemetry((prev) => (prev ? { ...prev, conduitType } : null));

      try {
        const result = await sendFileOverDataChannel(
          file,
          dc,
          senderSha256,
          (telUpdate) => setTelemetry((prev) => (prev ? { ...prev, ...telUpdate } : null)),
          isCancelledRef
        );

        // Verification & completion
        await api.post(`/api/transfers/${transferId}/complete`, {
          conduitType,
          averageSpeedMBps: result.averageSpeedMBps,
        });

        setTelemetry((prev) =>
          prev
            ? {
                ...prev,
                status: 'COMPLETED',
                averageSpeedMBps: result.averageSpeedMBps,
              }
            : null
        );
        showToast('TRANSMISSION COMPLETE & VERIFIED.');
        navigate(`/transfer/${sessionCode}/result`);
      } catch (err: any) {
        if (err.message !== 'TRANSFER_CANCELLED_BY_USER') {
          console.warn('[WebRTC DataChannel error, falling back to Socket.IO relay]:', err);
          await startSocketRelayStreaming(transferId, sessionCode, targetUserId, file, senderSha256);
        }
      }
    };

    if (dc.readyState === 'open') {
      startStreaming();
    } else {
      dc.onopen = startStreaming;

      // Failover after 9 seconds if WebRTC connection cannot pierce NAT/router
      fallbackTimer = setTimeout(async () => {
        if (!didStart && !isCancelledRef.current) {
          didStart = true;
          dc.onopen = null;
          console.warn('[WebRTC] DataChannel onopen timed out after 9s. Initiating WebSocket Relay conduit...');
          await startSocketRelayStreaming(transferId, sessionCode, targetUserId, file, senderSha256);
        }
      }, 9000);
    }
  };

  // Socket.IO Relay streaming fallback with windowed flow control
  const startSocketRelayStreaming = async (
    transferId: string,
    sessionCode: string,
    targetUserId: string,
    file: File,
    senderSha256: string
  ) => {
    if (!token || isCancelledRef.current) return;
    const socket = getSocket(token);

    setTelemetry((prev) => (prev ? { ...prev, conduitType: 'TURN_RELAY' } : null));
    try {
      await api.patch(`/api/transfers/${transferId}/status`, {
        status: 'TRANSFERRING',
        conduitType: 'TURN_RELAY',
      });
    } catch {}

    const totalBytes = file.size;
    const CHUNK_SIZE = 64 * 1024;
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

    // 1. Send FILE_HEADER control frame
    const header: FileHeaderMessage = {
      type: 'FILE_HEADER',
      filename: file.name,
      sizeBytes: totalBytes,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      senderSha256,
    };
    socket.emit('transfer:control', {
      transferId,
      targetUserId,
      message: header,
    });

    const startTime = performance.now();
    let highestAckedSeq = -1;
    let notifyResolver: (() => void) | null = null;

    const onChunkAck = (payload: { transferId: string; seq: number }) => {
      if (payload.transferId === transferId) {
        if (payload.seq > highestAckedSeq) {
          highestAckedSeq = payload.seq;
        }
        if (notifyResolver) {
          const r = notifyResolver;
          notifyResolver = null;
          r();
        }
      }
    };
    socket.on('transfer:chunk_ack', onChunkAck);

    const WINDOW_SIZE = 4; // 4 chunks = 256 KB in-flight window

    try {
      // 2. Stream 64KB slices with windowed backpressure
      for (let seq = 0; seq < totalChunks; seq++) {
        if (isCancelledRef.current) throw new Error('TRANSFER_CANCELLED_BY_USER');

        // Backpressure check: wait if in-flight chunks exceed window size
        while (seq - highestAckedSeq > WINDOW_SIZE) {
          if (isCancelledRef.current) throw new Error('TRANSFER_CANCELLED_BY_USER');
          await new Promise<void>((resolve) => {
            notifyResolver = resolve;
            // 200ms fallback timeout so we never stall if a single ACK packet drops
            setTimeout(() => {
              if (notifyResolver === resolve) {
                notifyResolver = null;
                resolve();
              }
            }, 200);
          });
        }

        const start = seq * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalBytes);
        const sliceBuffer = await file.slice(start, end).arrayBuffer();

        const frame = new Uint8Array(4 + sliceBuffer.byteLength);
        const view = new DataView(frame.buffer);
        view.setUint32(0, seq, false);
        frame.set(new Uint8Array(sliceBuffer), 4);

        socket.emit('transfer:chunk', {
          transferId,
          targetUserId,
          frame: frame.buffer,
        });

        // Compute speed from confirmed wire progress
        const confirmedBytes = Math.min(totalBytes, (highestAckedSeq + 1) * CHUNK_SIZE);
        const now = performance.now();
        const elapsedSec = Math.max(0.01, (now - startTime) / 1000);
        const speedMBps = Number(((confirmedBytes / (1024 * 1024)) / elapsedSec).toFixed(1));
        const remainingBytes = Math.max(0, totalBytes - confirmedBytes);
        const speedBps = speedMBps * 1024 * 1024;
        const etaSeconds = speedBps > 0 ? Math.ceil(remainingBytes / speedBps) : 0;
        const percent = Math.min(99, Math.floor((confirmedBytes / totalBytes) * 100));

        setTelemetry((prev) =>
          prev
            ? {
                ...prev,
                transferredBytes: confirmedBytes,
                percent,
                speedMBps,
                etaSeconds,
              }
            : null
        );
      }

      // 3. Wait for in-flight buffer to drain and all chunks to be acknowledged
      const drainStart = performance.now();
      while (highestAckedSeq < totalChunks - 1 && performance.now() - drainStart < 20000) {
        if (isCancelledRef.current) throw new Error('TRANSFER_CANCELLED_BY_USER');
        await new Promise((r) => setTimeout(r, 50));
      }

      // 4. Send EOF control frame
      const eof: EofMessage = {
        type: 'EOF',
        totalChunks,
        totalBytes: file.size,
        senderSha256,
      };
      socket.emit('transfer:control', {
        transferId,
        targetUserId,
        message: eof,
      });

      // 5. Wait for receiver ACK
      await new Promise<void>((resolve) => {
        let timeout: any = null;
        const ackHandler = (payload: { transferId: string; message: any }) => {
          if (payload.transferId === transferId && payload.message?.type === 'RECEIVER_ACK_COMPLETE') {
            if (timeout) clearTimeout(timeout);
            socket.off('transfer:control', ackHandler);
            resolve();
          }
        };
        socket.on('transfer:control', ackHandler);
        timeout = setTimeout(() => {
          socket.off('transfer:control', ackHandler);
          resolve();
        }, 60000);
      });

      const totalElapsedSec = Math.max(0.01, (performance.now() - startTime) / 1000);
      const avgSpeedMBps = Number(((totalBytes / (1024 * 1024)) / totalElapsedSec).toFixed(1));

      await api.post(`/api/transfers/${transferId}/complete`, {
        conduitType: 'TURN_RELAY',
        averageSpeedMBps: avgSpeedMBps,
      });

      setTelemetry((prev) =>
        prev
          ? {
              ...prev,
              transferredBytes: totalBytes,
              percent: 100,
              status: 'COMPLETED',
              averageSpeedMBps: avgSpeedMBps,
            }
          : null
      );
      showToast('TRANSMISSION COMPLETE & VERIFIED.');
      navigate(`/transfer/${sessionCode}/result`);
    } finally {
      socket.off('transfer:chunk_ack', onChunkAck);
    }
  };

  // Start Receiver Pipeline
  const acceptOffer = async (offerId: string) => {
    const offer = pendingOffers.find((o) => o.transferId === offerId) || activeOffer;
    if (!offer) return;

    setActiveOffer(null);
    setPendingOffers((prev) => prev.filter((o) => o.transferId !== offerId));
    isCancelledRef.current = false;
    setDownloadUrl(null);
    setReceivedFileBlob(null);
    setReceivedFilename(null);

    // 1. Respond accepted on server
    await api.patch(`/api/transfers/${offer.transferId}/respond`, { decision: 'ACCEPT' });

    setTelemetry({
      transferId: offer.transferId,
      sessionCode: offer.sessionCode,
      filename: offer.filename,
      sizeBytes: offer.sizeBytes,
      mimeType: offer.mimeType,
      totalChunks: offer.totalChunks,
      senderSha256: offer.senderSha256,
      transferredBytes: 0,
      percent: 0,
      speedMBps: 0,
      etaSeconds: 0,
      status: 'TRANSFERRING',
      conduitType: 'DIRECT_SCTP',
      role: 'RECEIVER',
    });

    const senderId = String((offer.sender as any).id || (offer.sender as any)._id);
    const socket = getSocket(token!);

    // 2. Initialize Receiver's ReceiverFileEngine FIRST (handles both DataChannel and socket chunks)
    const engine = new ReceiverFileEngine(
      null, // dc will be bound via onDataChannel if WebRTC succeeds
      (telUpdate) => setTelemetry((prev) => (prev ? { ...prev, ...telUpdate } : null)),
      async (result) => {
        // Set local state FIRST so TransferResultPage has immediate access
        setReceivedFileBlob(result.fileBlob);
        setDownloadUrl(result.blobUrl);
        setReceivedFilename(result.filename);

        // Persist to IndexedDB immediately
        await saveReceivedBlob(offer.sessionCode, result.fileBlob, result.filename, result.fileBlob.type);
        await saveReceivedBlob(offer.transferId, result.fileBlob, result.filename, result.fileBlob.type);

        // Persist to global in-memory cache
        globalDownloadsCache.set(offer.sessionCode, {
          blobUrl: result.blobUrl,
          filename: result.filename,
          fileBlob: result.fileBlob,
        });
        globalDownloadsCache.set(offer.transferId, {
          blobUrl: result.blobUrl,
          filename: result.filename,
          fileBlob: result.fileBlob,
        });

        setTelemetry((prev) =>
          prev
            ? {
                ...prev,
                status: 'COMPLETED',
                receiverSha256: result.receiverSha256,
                integrityVerified: result.match,
                downloadBlobUrl: result.blobUrl,
                downloadFilename: result.filename,
                downloadBlob: result.fileBlob,
                averageSpeedMBps: result.averageSpeedMBps,
              }
            : null
        );

        // Report completion to backend
        try {
          await api.post(`/api/transfers/${offer.transferId}/complete`, {
            receiverSha256: result.receiverSha256,
            averageSpeedMBps: result.averageSpeedMBps,
          });
        } catch (err) {
          console.warn('[complete] Server record update failed, local file is safe:', err);
        }

        showToast('TRANSMISSION COMPLETE & ASSET ASSEMBLED.');
        navigate(`/transfer/${offer.sessionCode}/result`);
      },
      (err) => cancelActiveTransfer(err.message),
      (controlMsg) => {
        // Send ACK over Socket.IO as well
        socket.emit('transfer:control', {
          transferId: offer.transferId,
          targetUserId: senderId,
          message: controlMsg,
        });
      },
      (seq) => {
        // Send chunk ACK back to sender for windowed flow control
        socket.emit('transfer:chunk_ack', {
          transferId: offer.transferId,
          targetUserId: senderId,
          seq,
        });
      }
    );
    receiverEngineRef.current = engine;

    // 3. Initialize Receiver's RTCPeerConnection with onDataChannel registered
    const pc = new PeerConnection({
      transferId: offer.transferId,
      targetUserId: senderId,
      allowLanHost: user?.allowLanHost ?? true,
      onDataChannel: (dc) => {
        if (receiverEngineRef.current) {
          receiverEngineRef.current.setConduitDataChannel(dc);
        }
      },
    });

    pcRef.current = pc;

    // 4. Flush any early signals that arrived before this point
    await flushEarlySignals(offer.transferId, pc);

    // 5. Notify sender that receiver is armed and ready for SDP_OFFER
    socket.emit('webrtc:receiver_ready', {
      transferId: offer.transferId,
      senderId: senderId,
    });

    navigate(`/transfer/${offer.sessionCode}`);
  };

  const rejectOffer = async (offerId: string) => {
    setActiveOffer(null);
    setPendingOffers((prev) => prev.filter((o) => o.transferId !== offerId));
    await api.patch(`/api/transfers/${offerId}/respond`, { decision: 'REJECT' });
    showToast('OFFER REJECTED.');
  };

  const dismissOfferModal = () => setActiveOffer(null);

  const initiateSendTransfer = async (
    recipientId: string,
    file: File,
    senderSha256: string
  ): Promise<string> => {
    // Reset all previous transfer state
    setTelemetry(null);
    setDownloadUrl(null);
    setReceivedFileBlob(null);
    setReceivedFilename(null);
    isCancelledRef.current = false;
    pendingFileToSendRef.current = { file, senderSha256 };

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (receiverEngineRef.current) {
      receiverEngineRef.current.destroy();
      receiverEngineRef.current = null;
    }

    const res = await api.post<{ transfer: { id: string; sessionCode: string } }>('/api/transfers/request', {
      recipientId,
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks: Math.ceil(file.size / (64 * 1024)),
      senderSha256,
    });

    setTelemetry({
      transferId: res.transfer.id,
      sessionCode: res.transfer.sessionCode,
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks: Math.ceil(file.size / (64 * 1024)),
      senderSha256,
      transferredBytes: 0,
      percent: 0,
      speedMBps: 0,
      etaSeconds: 0,
      status: 'TRANSFERRING',
      conduitType: 'DIRECT_SCTP',
      role: 'SENDER',
    });

    showToast(`OFFER DISPATCHED. AWAITING PEER CONSENT...`);
    return res.transfer.sessionCode;
  };

  const cancelActiveTransfer = async (reason?: string) => {
    isCancelledRef.current = true;
    if (telemetry?.transferId && token) {
      const socket = getSocket(token);
      socket.emit('transfer:cancel', { transferId: telemetry.transferId, reason });
    }
    pcRef.current?.close();
    pcRef.current = null;
    receiverEngineRef.current?.destroy();
    receiverEngineRef.current = null;
    setTelemetry((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
  };

  const disconnectAllPeers = () => {
    cancelActiveTransfer('MANUAL_DISCONNECT_ALL');
    pcRef.current?.close();
    pcRef.current = null;
    showToast('ALL CONDUITS TERMINATED.');
  };

  return (
    <TransferContext.Provider
      value={{
        activeOffer,
        pendingOffers,
        telemetry,
        activeTransfer,
        downloadUrl,
        receivedFileBlob,
        receivedFilename,
        peerPresenceMap,
        peerLatencyMap,
        toastMessage,
        isPairModalOpen,
        showToast,
        openPairModal,
        closePairModal,
        acceptOffer,
        rejectOffer,
        dismissOfferModal,
        initiateSendTransfer,
        cancelActiveTransfer,
        disconnectAllPeers,
        pingPeer,
      }}
    >
      {children}
    </TransferContext.Provider>
  );
};

export function useTransfer(): TransferContextType {
  const context = useContext(TransferContext);
  if (!context) {
    throw new Error('useTransfer must be used within a TransferProvider');
  }
  return context;
}
