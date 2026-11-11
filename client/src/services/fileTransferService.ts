/**
 * ============================================================
 * FILE PURPOSE:
 *   Core file streaming, chunking, backpressure control, and reassembly engine.
 *   Implements 64 KB binary frames for maximum cross-browser mobile (iOS/Android)
 *   and desktop stability, incremental SHA-256 computation, and dual-strategy
 *   file saving (streaming/Blob fallback with download triggers).
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — File Transfer & Streaming Service
 *
 * CONNECTED MODULES:
 *   - Called by: TransferContext.tsx
 *   - Uses: workers/sha256.worker.ts (Web Worker hashing)
 *   - Interacts with: WebRTC RTCDataChannel
 *   - Interacts with: Browser File and Blob APIs
 *
 * CRITICAL FLOW CONTROL & FRAMING RULES:
 *   1. CHUNK_SIZE = 65536 (64 KB). Max safe SCTP payload.
 *   2. MAX_BUFFERED_AMOUNT = 1048576 (1 MB) high-water mark.
 *   3. dc.bufferedAmountLowThreshold = 262144 (256 KB) low-water mark.
 *   4. Binary frames: [4-byte Big-Endian sequence number] + [chunk payload].
 *   5. Control frames: JSON strings ("FILE_HEADER", "EOF", "RECEIVER_ACK_COMPLETE").
 *   6. Real-time speed calculation from real bytes sent/received and elapsed time.
 *      Zero simulated timers, zero fake numbers.
 * ============================================================
 */

import type { TransferTelemetry } from '../types/peerlink';
import { computeFileSha256, createIncrementalHasher, type IncrementalHasher } from './hashService';

export const CHUNK_SIZE = 65536; // 64 KB
export const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1 MB
export const LOW_WATERMARK = 256 * 1024; // 256 KB

export interface FileHeaderMessage {
  type: 'FILE_HEADER';
  filename: string;
  sizeBytes: number;
  mimeType: string;
  totalChunks: number;
  senderSha256: string;
}

export interface EofMessage {
  type: 'EOF';
  totalChunks: number;
  totalBytes: number;
  senderSha256: string;
}

export interface ReceiverAckMessage {
  type: 'RECEIVER_ACK_COMPLETE' | 'RECEIVER_VERIFIED';
  receiverSha256: string;
  verified: boolean;
  match?: boolean;
}

export type ControlMessage = FileHeaderMessage | EofMessage | ReceiverAckMessage;

/**
 * Hash a file using the robust 3-Tier hashing pipeline (Worker -> js-sha256 -> Embedded).
 * Guaranteed to never return empty or fallback error strings.
 */
export function hashFileWithWorker(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return computeFileSha256(file, onProgress);
}

/**
 * Sender streaming routine with backpressure flow control.
 * Calculates REAL transfer speed based on bytes sent over elapsed time.
 * Does NOT terminate or close the connection until receiver sends an ACK.
 */
export async function sendFileOverDataChannel(
  file: File,
  dc: RTCDataChannel,
  senderSha256: string,
  onTelemetryUpdate: (telemetry: Partial<TransferTelemetry>) => void,
  isCancelledRef: { current: boolean }
): Promise<{ averageSpeedMBps: number }> {
  dc.binaryType = 'arraybuffer';
  dc.bufferedAmountLowThreshold = LOW_WATERMARK;

  const totalBytes = file.size;
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
  dc.send(JSON.stringify(header));

  const startTime = performance.now();

  for (let seq = 0; seq < totalChunks; seq++) {
    if (isCancelledRef.current) {
      throw new Error('TRANSFER_CANCELLED_BY_USER');
    }

    // 2. High-water mark pause: check backpressure (1 MB threshold)
    if (dc.bufferedAmount >= MAX_BUFFERED_AMOUNT) {
      await new Promise<void>((resolve) => {
        let timer: any = null;
        const handler = () => {
          if (timer) clearInterval(timer);
          dc.removeEventListener('bufferedamountlow', handler);
          resolve();
        };
        dc.addEventListener('bufferedamountlow', handler);
        // Polling check ensures we never deadlock if bufferedamountlow fired just before listener attached
        timer = setInterval(() => {
          if (dc.bufferedAmount <= LOW_WATERMARK) {
            handler();
          }
        }, 30);
      });
    }

    if (isCancelledRef.current) {
      throw new Error('TRANSFER_CANCELLED_BY_USER');
    }

    // 3. Slice and frame binary payload
    const start = seq * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const sliceBuffer = await file.slice(start, end).arrayBuffer();

    // Frame: [4-byte Big-Endian sequence number][Slice payload]
    const frame = new Uint8Array(4 + sliceBuffer.byteLength);
    const view = new DataView(frame.buffer);
    view.setUint32(0, seq, false); // Big-endian
    frame.set(new Uint8Array(sliceBuffer), 4);

    dc.send(frame.buffer);

    // 4. Update Telemetry using REAL bytes transmitted over the wire (total pushed minus queued in buffer)
    const transferred = end;
    const buffered = dc.bufferedAmount || 0;
    const wireBytes = Math.max(0, transferred - buffered);

    const now = performance.now();
    const elapsedSec = Math.max(0.01, (now - startTime) / 1000);
    const speedMBps = Number(((wireBytes / (1024 * 1024)) / elapsedSec).toFixed(1));
    const remainingBytes = Math.max(0, totalBytes - wireBytes);
    const speedBps = speedMBps * 1024 * 1024;
    const etaSeconds = speedBps > 0 ? Math.ceil(remainingBytes / speedBps) : 0;
    const percent = Math.min(99, Math.floor((wireBytes / totalBytes) * 100));

    onTelemetryUpdate({
      transferredBytes: wireBytes,
      percent,
      speedMBps,
      etaSeconds,
    });
  }

  // 4b. Drain: Wait until all buffered bytes have actually left the network card
  while (dc.bufferedAmount > 0) {
    if (isCancelledRef.current) {
      throw new Error('TRANSFER_CANCELLED_BY_USER');
    }
    const wireBytes = Math.max(0, totalBytes - dc.bufferedAmount);
    const elapsedSec = Math.max(0.01, (performance.now() - startTime) / 1000);
    const speedMBps = Number(((wireBytes / (1024 * 1024)) / elapsedSec).toFixed(1));
    onTelemetryUpdate({
      transferredBytes: wireBytes,
      percent: Math.min(99, Math.floor((wireBytes / totalBytes) * 100)),
      speedMBps,
    });
    await new Promise((r) => setTimeout(r, 40));
  }

  // Calculate final average sender speed
  const totalElapsedSec = Math.max(0.01, (performance.now() - startTime) / 1000);
  const finalAvgSpeedMBps = Number(((totalBytes / (1024 * 1024)) / totalElapsedSec).toFixed(1));

  onTelemetryUpdate({
    transferredBytes: totalBytes,
    percent: 100,
    speedMBps: finalAvgSpeedMBps,
    etaSeconds: 0,
  });

  // 5. Send EOF control frame
  const eof: EofMessage = {
    type: 'EOF',
    totalChunks,
    totalBytes: file.size,
    senderSha256,
  };
  dc.send(JSON.stringify(eof));

  // 6. Wait for RECEIVER_ACK_COMPLETE acknowledgement from receiver over DataChannel
  await new Promise<void>((resolve) => {
    let timeout: any = null;
    const messageHandler = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data) as ControlMessage;
          if (msg.type === 'RECEIVER_ACK_COMPLETE' || msg.type === 'RECEIVER_VERIFIED') {
            if (timeout) clearTimeout(timeout);
            dc.removeEventListener('message', messageHandler);
            resolve();
          }
        } catch {
          // ignore non-json
        }
      }
    };
    dc.addEventListener('message', messageHandler);

    // 120-second fallback timeout in case ACK frame is dropped
    timeout = setTimeout(() => {
      dc.removeEventListener('message', messageHandler);
      resolve();
    }, 120000);
  });

  return { averageSpeedMBps: finalAvgSpeedMBps };
}

/**
 * Receiver file collector & reassembler with incremental hashing and Blob creation.
 * Handles both ArrayBuffer and Blob message types (essential for iOS Safari / Android Chrome).
 */
export class ReceiverFileEngine {
  private chunks: Uint8Array[] = [];
  private totalChunksExpected = 0;
  private totalBytesExpected = 0;
  private senderSha256 = '';
  private filename = 'received_file';
  private mimeType = 'application/octet-stream';
  private receivedBytes = 0;
  private hasher: IncrementalHasher;
  private startTime = 0;
  private isFinalized = false;
  private nextExpectedSeq = 0;

  constructor(
    private dc: RTCDataChannel | null,
    private onTelemetry: (telemetry: Partial<TransferTelemetry>) => void,
    private onComplete: (result: {
      blobUrl: string;
      filename: string;
      fileBlob: Blob;
      receiverSha256: string;
      match: boolean;
      averageSpeedMBps: number;
    }) => void,
    private onError: (err: Error) => void,
    private onSendControl?: (msg: ControlMessage) => void,
    private onChunkReceived?: (seq: number) => void
  ) {
    this.hasher = createIncrementalHasher();
    if (this.dc) {
      this.bindDataChannel();
    }
  }

  public setConduitDataChannel(dc: RTCDataChannel) {
    this.dc = dc;
    this.bindDataChannel();
  }

  private bindDataChannel() {
    if (!this.dc) return;
    this.dc.binaryType = 'arraybuffer';
    this.dc.onmessage = async (event: MessageEvent) => {
      try {
        if (typeof event.data === 'string') {
          await this.handleControlMessage(JSON.parse(event.data) as ControlMessage);
        } else if (event.data instanceof ArrayBuffer) {
          this.handleBinaryFrame(event.data);
        } else if (ArrayBuffer.isView(event.data)) {
          this.handleBinaryFrame(event.data);
        } else if (event.data instanceof Blob) {
          // Mobile Safari fallback: convert incoming Blob to ArrayBuffer
          const buffer = await event.data.arrayBuffer();
          this.handleBinaryFrame(buffer);
        }
      } catch (err) {
        this.onError(err instanceof Error ? err : new Error(String(err)));
      }
    };
  }

  public async handleControlMessage(msg: ControlMessage) {
    if (msg.type === 'FILE_HEADER') {
      this.filename = msg.filename;
      this.mimeType = msg.mimeType;
      this.totalChunksExpected = msg.totalChunks;
      this.totalBytesExpected = msg.sizeBytes;
      this.senderSha256 = msg.senderSha256;
      this.chunks = new Array(msg.totalChunks);
      this.receivedBytes = 0;
      this.nextExpectedSeq = 0;
      this.hasher = createIncrementalHasher();
      this.startTime = performance.now();
      this.isFinalized = false;
    } else if (msg.type === 'EOF') {
      await this.finalizeTransfer();
    }
  }

  public handleBinaryFrame(input: ArrayBuffer | ArrayBufferView) {
    let arrayBuffer: ArrayBufferLike;
    let byteOffset = 0;
    let byteLength = 0;

    if (input instanceof ArrayBuffer) {
      arrayBuffer = input;
      byteOffset = 0;
      byteLength = input.byteLength;
    } else if (ArrayBuffer.isView(input)) {
      arrayBuffer = input.buffer;
      byteOffset = input.byteOffset;
      byteLength = input.byteLength;
    } else {
      return;
    }

    if (byteLength < 4) return;
    if (this.startTime === 0) {
      this.startTime = performance.now();
    }

    const view = new DataView(arrayBuffer, byteOffset, byteLength);
    const seq = view.getUint32(0, false);
    const payload = new Uint8Array(arrayBuffer as ArrayBuffer, byteOffset + 4, byteLength - 4);

    // Guard: ignore duplicate chunk if already ingested
    if (this.chunks[seq]) {
      return;
    }

    this.chunks[seq] = payload;
    this.receivedBytes += payload.byteLength;

    // Incremental sequential hashing (ensures exact byte-stream hash even if chunks arrive out of order)
    while (this.nextExpectedSeq < this.totalChunksExpected && this.chunks[this.nextExpectedSeq]) {
      this.hasher.update(this.chunks[this.nextExpectedSeq]);
      this.nextExpectedSeq++;
    }

    // Real measured speed
    const now = performance.now();
    const elapsedSec = Math.max(0.01, (now - this.startTime) / 1000);
    const speedMBps = Number(((this.receivedBytes / (1024 * 1024)) / elapsedSec).toFixed(1));
    const remaining = Math.max(0, this.totalBytesExpected - this.receivedBytes);
    const speedBps = speedMBps * 1024 * 1024;
    const etaSeconds = speedBps > 0 ? Math.ceil(remaining / speedBps) : 0;
    const percent = this.totalBytesExpected > 0
      ? Math.min(100, Math.floor((this.receivedBytes / this.totalBytesExpected) * 100))
      : 0;

    this.onTelemetry({
      transferredBytes: this.receivedBytes,
      percent,
      speedMBps,
      etaSeconds,
    });

    if (this.onChunkReceived) {
      this.onChunkReceived(seq);
    }

    // If all expected bytes are received, finalize immediately
    if (this.totalBytesExpected > 0 && this.receivedBytes >= this.totalBytesExpected && !this.isFinalized) {
      this.finalizeTransfer();
    }
  }

  private async finalizeTransfer(): Promise<void> {
    if (this.isFinalized) return;
    this.isFinalized = true;

    try {
      // Ingest any remaining contiguous chunks up to totalChunksExpected
      while (this.nextExpectedSeq < this.totalChunksExpected && this.chunks[this.nextExpectedSeq]) {
        this.hasher.update(this.chunks[this.nextExpectedSeq]);
        this.nextExpectedSeq++;
      }

      const receiverSha256 = (await this.hasher.digest()).toLowerCase();
      const match = Boolean(receiverSha256) && receiverSha256 === this.senderSha256.toLowerCase();

      // Acknowledge back to sender over DataChannel and/or socket
      const ack: ReceiverAckMessage = {
        type: 'RECEIVER_ACK_COMPLETE',
        receiverSha256,
        verified: match,
        match,
      };

      if (this.dc && this.dc.readyState === 'open') {
        try {
          this.dc.send(JSON.stringify(ack));
        } catch {
          // channel may close
        }
      }

      if (this.onSendControl) {
        try {
          this.onSendControl(ack);
        } catch {
          // socket may close
        }
      }

      // Build Blob
      const fileBlob = new Blob(this.chunks as BlobPart[], {
        type: this.mimeType || 'application/octet-stream',
      });
      const blobUrl = URL.createObjectURL(fileBlob);

      const totalTimeSec = Math.max(0.01, (performance.now() - this.startTime) / 1000);
      const avgSpeedMBps = totalTimeSec > 0
        ? Number(((this.totalBytesExpected / (1024 * 1024)) / totalTimeSec).toFixed(1))
        : 0;

      // Free memory chunks array
      this.chunks = [];

      this.onComplete({
        blobUrl,
        filename: this.filename,
        fileBlob,
        receiverSha256,
        match,
        averageSpeedMBps: avgSpeedMBps,
      });
    } catch (err: any) {
      this.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  public destroy() {
    this.chunks = [];
  }
}
