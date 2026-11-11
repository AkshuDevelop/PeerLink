/**
 * ============================================================
 * FILE PURPOSE:
 *   Real STUN probe utility. Opens a temporary RTCPeerConnection
 *   to measure actual round-trip time to a STUN server and discover
 *   the user's public reflexive IP:port (the IP mobile carriers
 *   and NAT gateways assign externally).
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — WebRTC Utility Service
 *
 * CONNECTED MODULES:
 *   - Called by: client/src/pages/SettingsPage.tsx PROBE STUN button
 *   - Called by: client/src/pages/DashboardPage.tsx (auto-probe on load)
 *   - Calls out to: browser RTCPeerConnection API, public STUN server
 *
 * HOW STUN WORKS (Why This Matters):
 *   STUN (Session Traversal Utilities for NAT) is an RFC 8489 protocol.
 *   The browser sends a Binding Request to the STUN server. The server
 *   replies with the browser's external IP:port as it appears on the
 *   public internet (the "reflexive" address). This RTT to the STUN
 *   server is a good proxy for internet latency.
 *   WebRTC uses this reflexive address as an ICE "srflx" candidate.
 * ============================================================
 */

import type { StunProbeResult } from '../types/peerlink';

/**
 * probeStun — Measure real STUN server RTT and discover reflexive IP.
 *
 * WHAT IT DOES:
 *   1. Records the start timestamp.
 *   2. Creates a temporary RTCPeerConnection with the given STUN server.
 *   3. Creates a dummy SDP offer (required to trigger ICE gathering).
 *   4. Waits for the first "srflx" (Server Reflexive) ICE candidate.
 *   5. Parses the candidate string to extract the reflexive IP:port.
 *   6. Calculates RTT = (timestamp when srflx candidate arrived) - (start).
 *   7. Closes the temporary RTCPeerConnection.
 *   8. Returns the StunProbeResult with the real RTT and IP.
 *
 * CALLED BY: SettingsPage.tsx PROBE STUN button click handler.
 *
 * WHY A TIMEOUT:
 *   If the STUN server is unreachable or the NAT blocks UDP, ICE gathering
 *   may never produce a srflx candidate. The 10-second timeout prevents
 *   the UI from hanging indefinitely.
 *
 * @param stunUrl - STUN server URL (e.g., "stun:stun.l.google.com:19302")
 * @returns StunProbeResult with success, reflexiveIp, rttMs, or error
 */
export async function probeStun(
  stunUrl = 'stun:stun.l.google.com:19302'
): Promise<StunProbeResult> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    let pc: RTCPeerConnection | null = null;

    // 10-second timeout in case STUN is unreachable
    const timeout = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        error: 'STUN probe timed out after 10 seconds',
      });
    }, 10000);

    function cleanup(): void {
      clearTimeout(timeout);
      if (pc) {
        pc.onicecandidate = null;
        pc.close();
        pc = null;
      }
    }

    try {
      // Create a temporary RTCPeerConnection with the STUN server
      pc = new RTCPeerConnection({
        iceServers: [{ urls: stunUrl }],
        // iceTransportPolicy: 'all' allows both host and srflx candidates
        iceTransportPolicy: 'all',
      });

      // Listen for ICE candidates
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          // ICE gathering complete, no srflx found — STUN may be blocked
          return;
        }

        const candidate = event.candidate.candidate;

        // We only care about "srflx" (Server Reflexive) candidates —
        // these are the ones that reveal the external IP via STUN.
        // "host" candidates are local LAN IPs, "relay" is TURN.
        if (candidate.includes('srflx')) {
          const rttMs = Math.round(performance.now() - startTime);

          // Parse the IP:port from the candidate string
          // Format: "candidate:... srflx ... <reflexive-ip> <port> ..."
          // Example: "candidate:1 1 UDP ... 185.12.14.99 3478 typ srflx ..."
          const parts = candidate.split(' ');
          const ipIndex = parts.indexOf('srflx') - 2;
          const reflexiveIp = ipIndex >= 0
            ? `${parts[ipIndex]}:${parts[ipIndex + 1]}`
            : 'Unknown';

          cleanup();
          resolve({
            success: true,
            reflexiveIp,
            rttMs,
          });
        }
      };

      // Create a dummy data channel — required to trigger ICE gathering
      // (Without a media track or data channel, Chrome won't gather candidates)
      pc.createDataChannel('stun-probe');

      // Create and set a local SDP offer to start ICE gathering
      pc.createOffer()
        .then((offer) => pc!.setLocalDescription(offer))
        .catch((err) => {
          cleanup();
          resolve({ success: false, error: String(err) });
        });

    } catch (err) {
      cleanup();
      resolve({
        success: false,
        error: err instanceof Error ? err.message : 'RTCPeerConnection not supported',
      });
    }
  });
}
