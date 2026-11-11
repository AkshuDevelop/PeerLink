/**
 * ============================================================
 * FILE PURPOSE:
 *   WebRTC peer connection manager. Creates and manages RTCPeerConnection,
 *   handles ICE candidate queueing (critical bug prevention), creates
 *   the binary DataChannel for file transfer, and exchanges SDP via
 *   the Socket.IO signalling relay.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — WebRTC Service Layer
 *
 * CONNECTED MODULES:
 *   - Called by: TransferContext.tsx (initiates connections, handles signals)
 *   - Calls out to: socketService.ts (emitSignal for SDP/ICE relay)
 *   - Calls out to: browser RTCPeerConnection, RTCDataChannel APIs
 *   - Called by: fileTransferService.ts (uses the data channel returned here)
 *
 * CRITICAL DESIGN DECISIONS:
 *   1. ICE Candidate Queueing: ICE candidates can arrive BEFORE the remote
 *      SDP description is set. If we call addIceCandidate() before
 *      setRemoteDescription(), it throws an error and breaks the connection.
 *      We queue early candidates and flush them after setRemoteDescription().
 *
 *   2. STUN + optional TURN: Default to Google's public STUN servers.
 *      If VITE_TURN_* env vars are set, also include TURN relay servers
 *      for users behind strict symmetric NAT (common on mobile carriers).
 *
 *   3. The DataChannel is opened by the SENDER only (via createDataChannel).
 *      The RECEIVER discovers it via pc.ondatachannel callback.
 * ============================================================
 */

import { emitSignal } from './socketService';

// ================================================================
// ICE Server Configuration
// ================================================================

/**
 * getIceServers — Build the ICE server list from environment variables.
 *
 * WHAT IT DOES:
 *   Returns a list including two Google STUN servers (for redundancy)
 *   and optionally a TURN relay server if configured via VITE_TURN_* vars.
 *
 * WHY TWO STUN SERVERS:
 *   If stun.l.google.com is temporarily unavailable, stun1.l.google.com
 *   provides a fallback. Both are free public servers maintained by Google.
 *
 * WHY OPTIONAL TURN:
 *   TURN relay is needed when both peers are behind strict symmetric NAT
 *   (common on mobile carriers like 4G/5G). Without TURN, those peers
 *   cannot connect. With TURN, all bytes relay through the TURN server
 *   (slower but reliable). We make it optional since TURN costs bandwidth.
 */
function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    // Public Google STUN servers (primary NAT hole-punching)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },

    // Open Relay Project public STUN and TURN relays (UDP, TCP, TLS)
    // Critical for cellular CGNAT and cross-network transfers (Cloudflare Tunnel, LTE/5G)
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];

  // User-configured custom TURN (if set in env)
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

  if (turnUrl && turnUsername && turnCredential) {
    servers.unshift({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
}

// ================================================================
// PeerConnection Class
// ================================================================

/** Callback type for receiving data channel messages */
export type DataChannelMessageHandler = (data: ArrayBuffer | string) => void;

/** Configuration for creating a WebRTC connection */
export interface WebRTCConfig {
  transferId: string;       // Transfer session ID (used in signal payloads)
  targetUserId: string;     // The other peer's userId (for signal routing)
  allowLanHost: boolean;    // Whether to include LAN host candidates
  onDataChannel?: (dc: RTCDataChannel) => void; // Called when receiver gets channel
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
}

/**
 * PeerConnection — Wraps RTCPeerConnection with PeerLink-specific behaviour.
 *
 * WHAT IT DOES:
 *   - Creates an RTCPeerConnection with the correct ICE server config.
 *   - Queues ICE candidates that arrive before remote SDP is set.
 *   - Sends ICE candidates and SDP via socketService.emitSignal().
 *   - Provides a DataChannel for the SENDER to create.
 *   - Provides ondatachannel callback for the RECEIVER to receive it.
 */
export class PeerConnection {
  public pc: RTCPeerConnection;
  private config: WebRTCConfig;
  private pendingCandidates: RTCIceCandidateInit[] = []; // ICE candidate queue
  private remoteDescriptionSet = false; // Guard flag for candidate queueing

  constructor(config: WebRTCConfig) {
    this.config = config;

    // Create the RTCPeerConnection with our ICE server config
    this.pc = new RTCPeerConnection({
      iceServers: getIceServers(),
      // If allowLanHost is false (user preference), restrict ICE to relay only
      iceTransportPolicy: config.allowLanHost ? 'all' : 'relay',
      bundlePolicy: 'max-bundle',
    });

    // ── ICE Candidate Handler ──────────────────────────────────────
    /**
     * When a local ICE candidate is gathered, relay it to the remote peer
     * via Socket.IO signalling. The remote peer will call addIceCandidate()
     * when they receive the ICE_CANDIDATE signal.
     */
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitSignal({
          transferId: config.transferId,
          targetUserId: config.targetUserId,
          type: 'ICE_CANDIDATE',
          data: event.candidate.toJSON(),
        });
      }
    };

    // ── DataChannel Handler (RECEIVER side) ───────────────────────
    /**
     * The SENDER creates the DataChannel. The RECEIVER receives it here.
     * This callback fires when the sender calls pc.createDataChannel().
     */
    if (config.onDataChannel) {
      this.pc.ondatachannel = (event) => {
        config.onDataChannel!(event.channel);
      };
    }

    // ── Connection State Change ────────────────────────────────────
    if (config.onConnectionStateChange) {
      this.pc.onconnectionstatechange = () => {
        config.onConnectionStateChange!(this.pc.connectionState);
      };
    }

    if (config.onIceConnectionStateChange) {
      this.pc.oniceconnectionstatechange = () => {
        config.onIceConnectionStateChange!(this.pc.iceConnectionState);
      };
    }
  }

  // ================================================================
  // SENDER: Create offer + data channel
  // ================================================================

  /**
   * createOffer — Create an SDP offer and a DataChannel, then send the offer
   * to the remote peer via the signalling server.
   *
   * WHAT IT DOES:
   *   1. Creates a labeled RTCDataChannel with binary type and backpressure settings.
   *   2. Creates an SDP offer describing the connection.
   *   3. Sets it as the local description (triggers ICE gathering to start).
   *   4. Sends the SDP offer to the receiver via Socket.IO signalling.
   *
   * CALLED BY: fileTransferService.ts when the receiver accepts the transfer offer.
   *
   * @returns The RTCDataChannel to use for sending file chunks
   */
  async createOffer(): Promise<RTCDataChannel> {
    // Create the data channel BEFORE creating the offer
    // (The offer SDP must include the data channel description)
    const dc = this.pc.createDataChannel('file-transfer', {
      ordered: true,  // Ordered delivery — required for in-sequence chunk reassembly
    });

    // Configure the DataChannel for binary file transfer
    dc.binaryType = 'arraybuffer';

    // Set the low-water mark threshold for backpressure.
    // When bufferedAmount drops BELOW this threshold after being above
    // MAX_BUFFERED_AMOUNT, the onbufferedamountlow event fires, allowing
    // the sender to resume sending chunks.
    dc.bufferedAmountLowThreshold = 256 * 1024; // 256 KB

    // Create the SDP offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Send the SDP offer to the receiver via Socket.IO
    emitSignal({
      transferId: this.config.transferId,
      targetUserId: this.config.targetUserId,
      type: 'SDP_OFFER',
      data: offer,
    });

    return dc;
  }

  // ================================================================
  // RECEIVER: Handle incoming offer, create answer
  // ================================================================

  /**
   * handleOffer — Process an SDP offer from the sender and send back an answer.
   *
   * WHAT IT DOES:
   *   1. Sets the sender's SDP offer as the remote description.
   *   2. AFTER setting remote description, flushes any queued ICE candidates.
   *   3. Creates an SDP answer.
   *   4. Sets it as the local description (triggers ICE gathering for receiver).
   *   5. Sends the SDP answer to the sender via Socket.IO.
   *
   * CALLED BY: TransferContext.tsx when it receives an SDP_OFFER signal.
   *
   * WHY setRemoteDescription BEFORE addIceCandidate:
   *   RTCPeerConnection requires a remote SDP to be set before it can
   *   process ICE candidates. If candidates arrive before the SDP (which
   *   is very common in fast connections), they must be queued and applied
   *   afterwards. This is the #1 cause of "WebRTC connection failed" bugs.
   *
   * @param offer - The SDP offer received from the sender
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

    // ── FLUSH QUEUED ICE CANDIDATES ──────────────────────────────
    // Now that remote description is set, any ICE candidates that arrived
    // before this point can be safely applied.
    this.remoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Failed to add queued ICE candidate:', err);
      }
    }
    this.pendingCandidates = []; // Clear the queue

    // Create and send the SDP answer
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    emitSignal({
      transferId: this.config.transferId,
      targetUserId: this.config.targetUserId,
      type: 'SDP_ANSWER',
      data: answer,
    });
  }

  /**
   * handleAnswer — Process the SDP answer received from the receiver.
   *
   * CALLED BY: TransferContext.tsx when sender receives an SDP_ANSWER signal.
   *
   * @param answer - The SDP answer from the receiver
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));

    // Flush any ICE candidates that arrived before the answer
    this.remoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Failed to add queued ICE candidate:', err);
      }
    }
    this.pendingCandidates = [];
  }

  /**
   * addIceCandidate — Add a remote ICE candidate, with queueing if needed.
   *
   * WHAT IT DOES:
   *   If the remote SDP description has been set, immediately calls
   *   pc.addIceCandidate(). If not yet set (early arrival), pushes the
   *   candidate to pendingCandidates for later processing.
   *
   * CALLED BY: TransferContext.tsx when it receives an ICE_CANDIDATE signal.
   *
   * WHY THIS MATTERS:
   *   ICE candidates often arrive out-of-order relative to SDP messages.
   *   This is especially true over Socket.IO which may have different
   *   delivery latencies for different events. Without this guard,
   *   the connection would fail silently for many real-world network setups.
   *
   * @param candidate - The ICE candidate received from the remote peer
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.remoteDescriptionSet) {
      // Safe to add immediately
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] addIceCandidate error:', err);
      }
    } else {
      // Queue for later (after setRemoteDescription is called)
      this.pendingCandidates.push(candidate);
    }
  }

  /**
   * getConduitType — Determine the ICE candidate pair type for display.
   *
   * WHAT IT DOES:
   *   Queries RTCPeerConnection stats to find the active nominated ICE
   *   candidate pair and returns whether it's direct (DIRECT_SCTP) or
   *   relayed via TURN (TURN_RELAY).
   *
   * CALLED BY: fileTransferService.ts when the DataChannel opens.
   *
   * @returns 'DIRECT_SCTP' | 'TURN_RELAY' | 'UNKNOWN'
   */
  async getConduitType(): Promise<'DIRECT_SCTP' | 'TURN_RELAY' | 'UNKNOWN'> {
    try {
      const stats = await this.pc.getStats();
      for (const [, stat] of stats) {
        if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
          // Look up the local candidate to determine type
          const localId = stat.localCandidateId;
          const localStat = stats.get(localId);
          if (localStat?.candidateType === 'relay') return 'TURN_RELAY';
          return 'DIRECT_SCTP';
        }
      }
    } catch {
      // Stats may not be available on all browsers
    }
    return 'UNKNOWN';
  }

  /**
   * close — Clean up the RTCPeerConnection.
   *
   * CALLED BY: TransferContext.tsx on transfer completion/cancellation.
   */
  close(): void {
    this.pc.close();
  }
}
