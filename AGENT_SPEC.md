# PEERLINK — MASTER ZERO-TO-100 ANTIGRAVITY BUILD SPECIFICATION & PROMPT (`AGENT_SPEC.md`)

> **HOW TO USE THIS FILE IN ANTIGRAVITY:**
> 1. Extract your Google Stitch archive (`stitch_peerlink_p2p_file_transfer.zip` containing `code.html`, `DESIGN.md`, and `screen.png`) into your project root folder (e.g., inside a folder named `stitch_prototype/` or directly in the root).
> 2. Save this entire file as `AGENT_SPEC.md` in the root of your workspace.
> 3. Copy the **Master Kickoff Command** in Section 0 below and paste it into Antigravity.

---

## SECTION 0: MASTER KICKOFF COMMAND TO PASTE INTO ANTIGRAVITY

Copy and paste the block below directly into Antigravity's chat prompt:

```text
Read `AGENT_SPEC.md`, `DESIGN.md`, and `code.html` in full before writing any code.

You are building PeerLink from 0 to 100% completion as a real, production-grade, 100% functional full-stack browser-to-browser file transfer web application that works reliably between a Laptop browser and a Mobile Phone browser.

Strictly follow every architectural rule, file structure, database schema, API endpoint, Socket.IO event, WebRTC chunking/backpressure rule, incremental SHA-256 hashing rule, and the Mandatory Tutor-Style Code Commenting Standard defined in `AGENT_SPEC.md`.

Execute the build sequentially through Phases 1 to 5 in `AGENT_SPEC.md` without stopping at stubs, placeholders, or `// TODO` comments. Preserve 100% of the "Kinetic Block" visual aesthetic, Tailwind utility classes, and 13 route layouts from `code.html` and `DESIGN.md`, while replacing all simulated timers and hardcoded arrays with real MongoDB persistence, JWT authentication, Socket.IO signalling, and genuine WebRTC DataChannel file transfers. Verify that both `server` and `client` compile cleanly with zero TypeScript errors.
```

---

## SECTION 1: CORE NON-NEGOTIABLE ENGINEERING RULES FOR ANTIGRAVITY

1. **Zero Placeholders, Zero Stubs, Zero Simulated Transfers:**
   - Do **not** port the simulated `setInterval` progress loop (`App.startSim`), fake 400ms `setTimeout` handle lookup (`App.lookupHandle`), fake STUN probe (`App.probeStun`), or hardcoded SHA-256 string (`9a2f7c03881efb04...`) from `code.html` into the production application.
   - Remove the prototype-only `FAST-FORWARD COMPLETE` button (`App.forceCompleteTransfer`) and the floating bottom route-switcher bar (`<aside>` on Lines 155–170 of `code.html`).
   - Every transfer must stream real binary slices of the selected file over an `RTCDataChannel`, compute real incremental SHA-256 digests over the actual bytes on both sender and receiver, and save the reconstructed file to the receiver's device (working seamlessly on both Desktop laptops and iOS/Android mobile browsers).

2. **100% Laptop-to-Phone Compatibility Requirements:**
   - **Unified Origin / Proxy Support for Mobile Testing & Production:** Configure Vite (`vite.config.ts`) to proxy `/api` and `/socket.io` to the Express backend in development and configure Express to serve the compiled `client/dist` static bundle in production. This allows the user to expose a single port (via HTTPS tunnel like `cloudflared` / `ngrok`, local `mkcert` HTTPS, or Render deployment) so a mobile phone and laptop share the exact same origin with zero CORS or mixed-content failures.
   - **Mobile Browser File Saving Compatibility:** Mobile browsers (iOS Safari, Android Chrome) do **not** reliably support `window.showSaveFilePicker()`. The receiver file reconstruction engine MUST implement a dual-strategy saver:
     1. *Optional Desktop Streaming:* If `window.showSaveFilePicker` is available and user opts in on desktop for multi-GB files, stream chunks to disk.
     2. *Universal Cross-Device Default (Laptop + Phone 100% Compatible):* Collect incoming `Uint8Array` chunks in sequence order, verify the incremental SHA-256 hash upon receiving the `EOF` frame, construct a `new Blob(receivedChunks, { type: mimeType })`, generate an object URL via `URL.createObjectURL(blob)`, trigger an automatic `<a download={filename}>` click (plus provide an explicit **"DOWNLOAD SAVED FILE"** button on `#/transfer/:id/result` in case mobile Safari blocks auto-clicks without a user tap!), and free the chunk array memory after download.
   - **Cross-Browser SCTP Chunk Size (`64 KB` Frames):** While the Stitch UI displays logical 512 KB slice telemetry, cross-browser WebRTC `RTCDataChannel` between desktop Chrome and mobile Safari/Chrome has a strict maximum SCTP message size limit (typically 64 KB to 256 KB). Use **`CHUNK_SIZE = 65536` (64 KB)** per `dc.send()` binary frame with `dc.bufferedAmountLowThreshold = 262144` (256 KB) and a high-water mark pause at `MAX_BUFFERED_AMOUNT = 1048576` (1 MB) so mobile buffers never overflow.

3. **Mandatory Tutor-Style Code Commenting Standard (CRITICAL REQUIREMENT):**
   - The developer reading this codebase is using it to learn full-stack architecture and defend the project in an academic/engineering showcase.
   - **Every single file** (`.ts`, `.tsx`) MUST begin with a structured multi-line JSDoc header block explaining:
     - `FILE PURPOSE`: What this file does in plain English.
     - `ARCHITECTURAL LAYER`: Where it sits (Frontend UI / WebRTC Service / Web Worker / Express Route / Controller / Mongoose Model / Socket.IO Signalling).
     - `CONNECTED MODULES`: Which files import or call this file, and which files/APIs/events this file calls out to.
   - **Every function, React hook, Express controller, Socket event handler, and WebRTC callback** MUST have a detailed comment block directly above it and inline comments inside it explaining:
     - `WHAT IT DOES`: Step-by-step logic in simple, clear terms.
     - `CALLED BY`: Which UI button, lifecycle hook, REST endpoint, or socket event triggers this function.
     - `CALLS OUT TO`: Which downstream functions, database models, or browser APIs it invokes and what they are expected to return.
     - `WHY THIS MATTERS`: The engineering reason behind key lines (e.g., why we check `bufferedAmount`, why we queue ICE candidates before `remoteDescription` is set, why the backend never receives file bytes).

---

## SECTION 2: WHAT EXISTS IN `code.html` & `DESIGN.md` (YOUR VISUAL REFERENCE)

Before building, inspect `code.html` (1,706 lines) and `DESIGN.md` (214 lines):

### 2.1 "Kinetic Block" Design System Tokens (Must Preserve 100% in Tailwind)
From `code.html` (Lines 12–88) and `DESIGN.md`:
- **Colors:**
  - `cobalt`: `#1F3BFF` (Electric primary header, hero bands, online badges, progress bar)
  - `cream`: `#F4F1EA` (Primary poster paper background)
  - `ink`: `#0E0E10` (2px solid structural borders, dark bands, active transfer background, typography)
  - `sand`: `#E3DCCB` (Secondary structural neutral panels, table headers, input backgrounds)
  - `coral`: `#FF7A59` (Primary action pill buttons, incoming offer badges, urgent callouts)
  - `cream-muted`: `rgba(244, 241, 234, 0.72)`
  - `ink-muted`: `#55534E`
  - `cream-hairline`: `rgba(244, 241, 234, 0.16)`
  - `ink-hairline`: `rgba(14, 14, 16, 0.14)`
- **Typography:**
  - Google Fonts: `'Space Grotesk'` (weights 400, 500, 700, 800) for `font-sans` headlines/body, and `'Space Mono'` (weights 400, 700) for `font-mono` technical labels, hashes, and telemetry counters.
  - Global `font-variant-numeric: tabular-nums` on `body`.
- **Custom Utility Classes (from `code.html` Lines 45–88):**
  - `.outline-wordmark`: `fill: #1F3BFF; -webkit-text-stroke: 4px #F4F1EA; paint-order: stroke fill;`
  - `.avatar-hatch`: `background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 10px);`
  - `.hard-shadow-coral`: `box-shadow: 3px 3px 0px #0E0E10;`
  - `.hard-shadow-ink`: `box-shadow: 4px 4px 0px #0E0E10;`
  - `.animate-disc-spin` (24s linear infinite rotation) and `.animate-disc-fast` (6s linear infinite rotation).
- **Geometry:**
  - Cards, inputs, modals, and tables have `0px` border radius and `border-2 border-ink`.
  - Action buttons use full capsule geometry (`rounded-full border-2 border-ink`).

### 2.2 All 13 Routes / Modals from `code.html` to Implement in React Router
1. **Persistent Top Bar (`Header.tsx`, `code.html` Lines 93–131):**
   - Left: `PEERLINK` wordmark + `V0.9.4-P2P` badge + nav links (`TRANSFERS` -> `/dashboard`, `PEERS` -> `/peers`, `TELEMETRY` -> active transfer or `/logs`, `LOGS` -> `/logs`).
   - Right: Live STUN status (`STUN:LIVE` / `STUN:OFFLINE`), `PAIR CODE` button (opens `#pair-modal`), `CONNECT PEER` button (`/peers/add`), incoming transfer offer badge count (`#request-chip`), and 40px user initials avatar block linking to `/settings` (or Sign In/Up buttons when unauthenticated).
2. **Persistent Footer (`Footer.tsx`, `code.html` Lines 139–152):**
   - Links to Protocol Spec (`/`), STUN Status (`/dashboard`), SHA-256 Integrity (`/logs`), and `DISCONNECT ALL` button (closes active WebRTC connections and logs out or resets active conduits).
3. **Route 1 — Landing (`/`, `Views.landing`, Lines 285–457):**
   - Cobalt Hero with `PEERLINK` outline wordmark, rotating SVG status disc, `INITIALIZE NODE` button, `VIEW LIVE TELEMETRY` button, Cream `01 // SPECIFICATIONS & BENCHMARKS` 4-cell grid (`SCTP`, `∞ GB`, `0 BYTES`, `SHA-256`), and Ink `HOW THE MESH STACK OPERATES` band + Sovereignty Guarantee card.
4. **Route 2 — Sign In (`/signin`, `Views.signin`, Lines 1239–1274):**
   - Split Ink/Cream card with `HANDLE OR EMAIL` and `KEY PASSPHRASE` inputs calling `POST /api/auth/login`.
5. **Route 3 — Sign Up (`/signup`, `Views.signup`, Lines 1277–1317):**
   - Split Ink/Cream card with `EMAIL`, `PROPOSED HANDLE` (`3-20 chars · letters, numbers, dot, underscore`), and `PASSPHRASE` (`Min 8 characters`) calling `POST /api/auth/register`.
6. **Route 4 — Dashboard (`/dashboard`, `Views.dashboard`, Lines 460–586):**
   - Cobalt welcome banner with real logged-in user handle (`WELCOME, <HANDLE>`) and discovered STUN reflexive IP (`STUN REFLEXIVE: <ip:port>`).
   - Left column (`lg:col-span-7`): `01 // RECENT TRANSMISSIONS` table fetched from MongoDB (`GET /api/transfers/history`) with clickable session links to `/transfer/:id/details`.
   - Right column (`lg:col-span-5`): `02 // PENDING REQUESTS` (showing real incoming file transfer offers and/or pending contact requests with `ACCEPT` and `REJECT` buttons) and `03 // PEERS` grid (showing accepted contacts with live Cobalt `ONLINE` or Sand `OFFLINE` indicators and `SEND ↗` buttons linking to `/send?peer=<peerUserId>`).
7. **Route 5 — Peer Directory (`/peers`, `Views.peers`, Lines 589–715):**
   - Ink header + 4 tabs: `PEERS` (accepted contacts with live online status, RTT latency, `SEND` button, and `BLOCK` button), `INCOMING` (incoming contact requests and incoming transfer offers with `ACCEPT` / `REJECT`), `OUTGOING` (outgoing pending contact requests and staged outgoing offers with `CANCEL`), and `BLOCKED` (blocked users with `UNBLOCK` button).
8. **Route 6 — Add a Peer (`/peers/add`, `Views.addPeer`, Lines 718–757):**
   - Exact handle input (`#add-peer-handle-input`) + `RESOLVE` button calling `GET /api/users/lookup?handle=...`.
   - Displays discovered peer card with `SEND REQUEST` button calling `POST /api/contacts/request`.
   - Also includes the `ALTERNATIVE: 6-DIGIT INSTANT PIN` section to generate or enter a 6-digit pairing PIN (`POST /api/contacts/pair-pin`).
9. **Route 7 — Send a File (`/send`, `Views.send`, Lines 760–831):**
   - Left (`1. CHOOSE A PEER`): Selectable grid of accepted contacts (auto-selects peer from `?peer=<id>` query parameter; highlights selected peer with `ring-4 ring-cobalt`).
   - Right (`2. PAYLOAD STAGING`): Drag-and-drop / click file dropzone (`#send-dropzone`) + hidden `<input type="file">`.
   - When a file is chosen, immediately displays the `STAGED AUDIT` card (`FILE`, `SIZE`, `SLICES`, and real pre-computed `SHA-256` from the Web Worker) and the `TRANSMIT REQUEST` button.
   - Clicking `TRANSMIT REQUEST` calls `POST /api/transfers/request`, transitions to waiting/negotiating state, and once the receiver accepts, navigates both users to `/transfer/:id`.
10. **Route 8 — Active Transfer (`/transfer/:id`, `Views.transfer`, Lines 834–935):**
    - Full-height Ink screen showing `SENDING` or `RECEIVING` badge, `YOU ↘ PEER` (or `YOU ↖ PEER`), conduit badge (`DIRECT SCTP` or `TURN RELAY`), `DETAILS` link, and `CANCEL TRANSFER` button.
    - Large filename headline + fast-spinning SVG disc showing real-time `percent%`.
    - Animated Cobalt progress bar + 4-cell telemetry grid (`TRANSFERRED`, `PERCENT`, `SPEED` in MB/s, `ETA` in seconds) driven by real `RTCDataChannel` byte counters.
    - Footer bar showing the live SHA-256 hash being computed/verified.
11. **Route 9 — Transfer Result (`/transfer/:id/result`, `Views.result`, Lines 938–1009):**
    - Displays actual terminal outcome (`TRANSMISSION COMPLETE`, `TRANSMISSION CANCELLED`, `TRANSMISSION FAILED`, or `TRANSMISSION REJECTED`) — fixing the prototype bug where Cancel showed Complete!
    - Shows payload total, actual average transfer rate (`MB/S OVER WEBRTC`), protocol conduit (`WebRTC SCTP / DTLS 1.3`), packet loss (`0.00% LOSS`), and the `SHA-256 CRYPTOGRAPHIC INTEGRITY MATCH` box.
    - For the **Receiver**, triggers automatic file download AND provides a prominent **"DOWNLOAD RECEIVED FILE"** pill button so mobile phone users can always save or re-save the received file with a tap.
12. **Route 10 — Exhaustive Metadata Audit Details (`/transfer/:id/details`, `Views.details`, Lines 1012–1081):**
    - Fetches the specific transfer record from `GET /api/transfers/:id` (by MongoDB `_id` or `sessionCode` like `TR-9014`).
    - Displays Transmission ID, Conduit, Dispatcher (`nodeId` + `@handle`), Recipient (`nodeId` + `@handle`), and the **Side-by-Side Integrity Attestation** (`SENDER SHA-256` vs. `RECEIVER REASSEMBLED` with `MATCH 100% CONFIRMED · ZERO BIT CORRUPTION DETECTED` or mismatch warning), plus `DOWNLOAD AUDIT CSV`.
13. **Route 11 — Transmission Logs (`/logs`, `Views.logs`, Lines 1084–1148):**
    - Search bar (`SEARCH LOGS BY FILENAME OR PEER...`), direction filter buttons (`ALL`, `SENT` / `OUTGOING`, `RECEIVED` / `INCOMING`), `EXPORT CSV` button, and 9-column table (`SESSION ID`, `DIR`, `PEER`, `PAYLOAD`, `SIZE`, `RATE`, `TIMESTAMP`, `STATUS`, `PURGE` `✕` button calling `DELETE /api/transfers/:id`).
14. **Route 12 — Settings (`/settings`, `Views.settings`, Lines 1151–1236):**
    - `1. NODE PROFILE`: Permanent `LOCAL NODE ID`, editable `OPERATOR HANDLE` with a `SAVE HANDLE` button (`PATCH /api/users/me`), and deterministic avatar block.
    - `2. NETWORK TRANSPORT (ICE / STUN)`: Checkboxes for `ALLOW DIRECT LAN HOST CANDIDATES` (toggles `iceTransportPolicy` between `'all'` and `'relay'`) and `REFLEXIVE STUN`, plus a real `PROBE STUN` button that opens a real temporary `RTCPeerConnection` to `stun:stun.l.google.com:19302`, measures actual millisecond latency until the first `srflx` candidate arrives, and displays the real RTT and discovered public IP!
    - `3. POSTER APPEARANCE`: `LIGHT (CREAM)`, `DARK (INK)`, `SYSTEM` mode switcher.
    - `4. BLOCKED NODES`: List of blocked contacts with `UNBLOCK` buttons.
    - `5. PURGE LOCAL WEBRTC LOGS`: `PURGE EVERYTHING` button calling `DELETE /api/transfers/purge-all` to clear the user's transfer history.
15. **Global Modals (`IncomingRequestModal.tsx` & `PairPinModal.tsx`):**
    - **Incoming Transfer Modal (`#request-modal`, Lines 173–214):** Automatically pops up anywhere in the app whenever Socket.IO receives `transfer:incoming_offer` (or when clicking the top-bar `#request-chip`). Shows sender handle, avatar, filename, formatted size, slice count, MIME type, SHA-256 badge, security caution note, and `ACCEPT & STREAM` / `REJECT` buttons.
    - **Instant Pair PIN Modal (`#pair-modal`, Lines 217–234):** Allows a user to generate a temporary 6-digit numeric PIN (valid for 5 minutes in backend memory/DB) or enter another user's 6-digit PIN to immediately establish an `ACCEPTED` contact relationship across devices (super convenient when pairing your Laptop and Phone!).

---

## SECTION 3: EXACT MONOREPO DIRECTORY STRUCTURE

Create the following clean monorepo structure:

```text
peerlink/
├── package.json                  # Root workspace scripts (dev, build, start)
├── .env.example                  # Documented environment variables template
├── server/                       # Node.js + Express + Socket.IO + Mongoose Backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                      # Pre-configured local environment defaults
│   └── src/
│       ├── index.ts              # HTTP + Express + Socket.IO server entry point
│       ├── config/
│       │   └── db.ts             # MongoDB connection with automatic in-memory fallback
│       ├── models/
│       │   ├── User.ts           # Mongoose User schema & model
│       │   ├── Contact.ts        # Mongoose Contact (consent & block) schema & model
│       │   ├── Transfer.ts       # Mongoose Transfer metadata & state machine model
│       │   └── PairPin.ts        # Mongoose ephemeral 6-digit PIN pairing model (TTL 5m)
│       ├── middleware/
│       │   ├── authMiddleware.ts # JWT verification middleware for Express routes
│       │   └── errorHandler.ts   # Centralized Express error formatting middleware
│       ├── utils/
│       │   └── stateMachine.ts   # Deterministic 8-state Transfer transition validator
│       ├── routes/
│       │   ├── authRoutes.ts     # POST /register, POST /login, GET /me, PATCH /me
│       │   ├── contactRoutes.ts  # GET /lookup, GET /, POST /request, PATCH /:id/respond, POST /:id/block, DELETE /:id/block, POST /pair-pin/generate, POST /pair-pin/redeem
│       │   └── transferRoutes.ts # POST /request, PATCH /:id/respond, PATCH /:id/status, POST /:id/complete, GET /history, GET /:id, DELETE /:id, DELETE /purge/all
│       └── socket/
│           └── socketManager.ts  # Authenticated Socket.IO presence, offer alerts, & WebRTC SDP/ICE relay
└── client/                       # React 18 + TypeScript + Vite + Tailwind Frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts            # Vite config with /api and /socket.io proxy + host: true for LAN phone access
    ├── tailwind.config.js        # Kinetic Block colors & Space Grotesk / Space Mono fonts
    ├── postcss.config.js
    ├── index.html                # Loads Google Fonts & Material Symbols Outlined
    └── src/
        ├── main.tsx              # React DOM entry point
        ├── App.tsx               # React Router + Auth/Socket/WebRTC Context Providers + Global Modals
        ├── index.css             # Tailwind directives + Kinetic Block custom classes
        ├── types/
        │   └── peerlink.ts       # All shared TypeScript interfaces (User, Contact, Transfer, Signal, Telemetry)
        ├── api/
        │   └── httpClient.ts     # Typed fetch wrapper attaching JWT Authorization header
        ├── context/
        │   ├── AuthContext.tsx   # Manages current user, JWT token, login, signup, logout
        │   └── TransferContext.tsx # Coordinates Socket.IO events, WebRTC manager, File streamer, & active transfer state
        ├── services/
        │   ├── socketService.ts  # Singleton Socket.IO client with JWT handshake auth
        │   ├── webrtcService.ts  # RTCPeerConnection, ICE candidate queue, STUN/TURN config, & DataChannel setup
        │   ├── fileTransferService.ts # 64KB File.slice() sender with bufferedAmount backpressure & receiver Blob/Stream reassembler
        │   └── stunProbeService.ts # Real WebRTC STUN candidate RTT measurement utility
        ├── workers/
        │   └── sha256.worker.ts  # Incremental SHA-256 Web Worker using hash-wasm
        ├── components/
        │   ├── Header.tsx        # Persistent Cobalt top bar
        │   ├── Footer.tsx        # Persistent Ink footer
        │   ├── IncomingRequestModal.tsx # Real-time incoming file offer modal (#request-modal)
        │   ├── PairPinModal.tsx  # 6-digit generate/redeem instant pairing modal (#pair-modal)
        │   └── Toast.tsx         # Kinetic Block system notification toast
        └── pages/
            ├── LandingPage.tsx         # #/
            ├── SignInPage.tsx          # #/signin
            ├── SignUpPage.tsx          # #/signup
            ├── DashboardPage.tsx       # #/dashboard
            ├── PeersPage.tsx           # #/peers
            ├── AddPeerPage.tsx         # #/peers/add
            ├── SendFilePage.tsx        # #/send
            ├── ActiveTransferPage.tsx  # #/transfer/:id
            ├── TransferResultPage.tsx  # #/transfer/:id/result
            ├── TransferDetailsPage.tsx # #/transfer/:id/details
            ├── LogsPage.tsx            # #/logs
            └── SettingsPage.tsx        # #/settings
```

---

## SECTION 4: DATABASE CONNECTION & ZERO-FRICTION FALLBACK (`server/src/config/db.ts`)

To guarantee the application works 100% out-of-the-box whether the user provides a cloud `MONGODB_URI` (MongoDB Atlas) **or** runs it locally right away without MongoDB installed:
1. If `process.env.MONGODB_URI` is set and reachable, connect Mongoose directly to `process.env.MONGODB_URI`.
2. If `process.env.MONGODB_URI` is not set (or if local `mongodb://127.0.0.1:27017/peerlink` is unreachable during local testing), automatically fall back to `mongodb-memory-server` (`MongoMemoryServer.create()`) so the real Mongoose schemas, unique indexes, queries, and state transitions work 100% identically with zero setup failure! Log clearly in the terminal whether connected to MongoDB Atlas or the local embedded MongoDB instance.

---

## SECTION 5: COMPLETE BACKEND & WEBRTC TECHNICAL SPECIFICATION

### 5.1 Mongoose Models (`server/src/models/`)

1. **`User.ts`:**
   - `nodeId`: `String`, required, unique (e.g., `NODE-77-DELTA` generated deterministically on signup).
   - `handle`: `String`, required, unique, lowercase, trim, match `/^[a-z0-9._]{3,20}$/`.
   - `email`: `String`, required, unique, lowercase, trim.
   - `passwordHash`: `String`, required (`select: false` by default).
   - `avatar`: `String`, required, 2 uppercase chars (e.g., first 2 chars of handle).
   - `allowLanHost`: `Boolean`, default `true`.
   - `stunServer`: `String`, default `'stun:stun.l.google.com:19302'`.

2. **`Contact.ts`:**
   - `requester`: `ObjectId` ref `'User'`, required.
   - `recipient`: `ObjectId` ref `'User'`, required.
   - `status`: `String` enum `['PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED']`, default `'PENDING'`.
   - `blockedBy`: `ObjectId` ref `'User'`, default `null`.
   - `blockReason`: `String`, default `null`.
   - Compound unique index on `{ requester: 1, recipient: 1 }`.

3. **`PairPin.ts` (for the Top-Bar `PAIR CODE` & `/peers/add` 6-Digit PIN Feature):**
   - `pin`: `String`, required, unique (6-digit numeric string, e.g., `'849201'`).
   - `creator`: `ObjectId` ref `'User'`, required.
   - `expiresAt`: `Date`, required, indexed with TTL (`{ expireAfterSeconds: 0 }`, set to `Date.now() + 5 * 60 * 1000`).
   - When User B redeems User A's 6-digit PIN via `POST /api/contacts/pair-pin/redeem`, the backend automatically creates or updates the `Contact` between User A and User B to `status: 'ACCEPTED'`, deletes the consumed PIN, and notifies both users via Socket.IO (`contact:updated`) so their devices immediately appear in each other's `PEERS` list!

4. **`Transfer.ts`:**
   - `sessionCode`: `String`, required, unique, indexed (format `TR-XXXX`, e.g., `TR-9014`).
   - `sender`: `ObjectId` ref `'User'`, required, indexed.
   - `recipient`: `ObjectId` ref `'User'`, required, indexed.
   - `filename`: `String`, required, trim.
   - `sizeBytes`: `Number`, required, min `1`.
   - `mimeType`: `String`, default `'application/octet-stream'`.
   - `totalChunks`: `Number`, required, min `1`.
   - `senderSha256`: `String`, required, match `/^[a-f0-9]{64}$/`.
   - `receiverSha256`: `String`, default `null`.
   - `integrityVerified`: `Boolean`, default `false`.
   - `averageSpeedMBps`: `Number`, default `0`.
   - `conduitType`: `String`, enum `['DIRECT_SCTP', 'TURN_RELAY', 'UNKNOWN']`, default `'DIRECT_SCTP'`.
   - `status`: `String`, enum `['PENDING', 'ACCEPTED', 'TRANSFERRING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED', 'EXPIRED']`, default `'PENDING'`.
   - `failureReason`: `String`, default `null`.
   - `expiresAt`: `Date`, required (5 minutes from creation for `PENDING` offers).
   - `completedAt`: `Date`, default `null`.

### 5.2 Authenticated Socket.IO Signalling Protocol (`server/src/socket/socketManager.ts`)

- **Authentication Middleware (`io.use`):**
  - Reads JWT from `socket.handshake.auth.token`. Verifies with `JWT_SECRET` and attaches `socket.data.userId` and `socket.data.handle`.
- **Presence Management:**
  - Maintains `onlineUsers: Map<string, Set<string>>` mapping `userId -> Set<socketId>` (supporting users open on multiple tabs) and `busyUsers: Set<string>` (users currently in `TRANSFERRING` state).
  - Joins `socket.join(\`user:\${userId}\`)`.
  - Helper `broadcastPresenceToContacts(userId)` queries all `ACCEPTED` contacts of `userId` and emits `peer:presence_update` (`{ userId, handle, status: 'ONLINE' | 'BUSY' | 'OFFLINE' }`) to their rooms.
- **Signalling & Transfer Control Events:**
  1. `webrtc:signal`: Payload `{ transferId, targetUserId, type: 'SDP_OFFER' | 'SDP_ANSWER' | 'ICE_CANDIDATE', data }`.
     - Server validates that `Transfer` exists, `status` is `'ACCEPTED'` or `'TRANSFERRING'`, and `socket.data.userId` and `targetUserId` are the sender and recipient.
     - Emits `webrtc:signal` to `user:${targetUserId}`.
  2. `transfer:progress_sync`: Payload `{ transferId, targetUserId, percent, transferredBytes, speedMBps }`.
     - Optional lightweight telemetry sync (throttled to once per 500ms) or direct DataChannel ack so both sender and receiver screens show synchronized speed/progress.
  3. `transfer:cancel`: Payload `{ transferId }`.
     - Validates participant, updates `Transfer.status = 'CANCELLED'`, and emits `transfer:cancelled` to both `user:${sender}` and `user:${recipient}` rooms.
  4. `peer:ping_request` & `peer:ping_response`:
     - Measures real-time Socket/Peer RTT in milliseconds so contact cards display real latency (e.g., `14ms`) instead of hardcoded strings.

### 5.3 WebRTC & File Streaming Engine (`client/src/services/webrtcService.ts` & `fileTransferService.ts`)

1. **ICE Server Configuration:**
   - Default STUN servers: `stun:stun.l.google.com:19302` and `stun:stun1.l.google.com:19302`.
   - Support optional `VITE_TURN_URL`, `VITE_TURN_USERNAME`, and `VITE_TURN_CREDENTIAL` environment variables so TURN relay works automatically when configured.
2. **Early ICE Candidate Queueing (Critical Bug Prevention):**
   - On both Sender and Receiver, maintain `pendingCandidates: RTCIceCandidateInit[] = []`.
   - If an `ICE_CANDIDATE` arrives over Socket.IO before `pc.remoteDescription` is set, push it to `pendingCandidates`.
   - Immediately after `await pc.setRemoteDescription(...)` resolves, loop through `pendingCandidates` and call `await pc.addIceCandidate(new RTCIceCandidate(c))`, then clear the queue.
3. **Binary Chunk Framing & Flow Control (`64 KB` SCTP Messages):**
   - Set `dc.binaryType = 'arraybuffer'` and `dc.bufferedAmountLowThreshold = 256 * 1024` (256 KB).
   - **Control Messages (JSON Strings over DataChannel):**
     - `{"type": "FILE_HEADER", "filename": "...", "sizeBytes": 12345, "mimeType": "...", "totalChunks": 200, "senderSha256": "..."}` sent first when `dc.onopen` fires.
     - `{"type": "EOF", "totalChunks": 200, "totalBytes": 12345, "senderSha256": "..."}` sent after the last binary chunk.
     - `{"type": "RECEIVER_VERIFIED", "receiverSha256": "...", "match": true}` sent back from Receiver to Sender over the DataChannel once the Receiver finishes hashing and reconstructing the file, ensuring the Sender does not close the connection before the Receiver's network buffer has completely drained!
   - **Binary Data Frames (`ArrayBuffer`):**
     - Each binary frame is `[4-byte UInt32 Big-Endian Sequence Number][Up to 65,536 bytes of File Slice]`.
     - Before reading each slice via `await file.slice(offset, offset + 65536).arrayBuffer()`, check `if (dc.bufferedAmount >= 1024 * 1024)` (1 MB). If true, `await` a Promise that resolves on `dc.onbufferedamountlow`.
4. **Incremental SHA-256 Hashing (`client/src/workers/sha256.worker.ts`):**
   - Use `hash-wasm` (`createSHA256()`).
   - On Sender: When the user selects a file on `/send`, stream the file in 1 MB slices through the Web Worker to compute the real 64-character `senderSha256` before clicking `TRANSMIT REQUEST` (showing live `"HASHING: XX%"` on the Staged Audit Card so even large files hash smoothly without freezing the UI).
   - On Receiver: Initialize `createSHA256()` when the transfer starts, call `hasher.update(chunkPayload)` on every incoming 64 KB binary chunk in sequence order, and call `hasher.digest('hex')` when `EOF` arrives. Compare `receiverSha256 === senderSha256`.

---

## SECTION 6: SEQUENTIAL 5-PHASE EXECUTION PLAN FOR ANTIGRAVITY

Execute these five phases in order:

- **Phase 1 — Workspace & Backend Foundation:**
  - Create root `package.json`, `server/package.json`, `server/tsconfig.json`, and install dependencies (`express`, `cors`, `dotenv`, `mongoose`, `mongodb-memory-server`, `bcryptjs`, `jsonwebtoken`, `socket.io`, `express-rate-limit` + `@types/*` and `tsx`).
  - Implement `db.ts`, `User.ts`, `Contact.ts`, `Transfer.ts`, `PairPin.ts`, `stateMachine.ts`, `authMiddleware.ts`, and `errorHandler.ts` with full tutor-level comments.
- **Phase 2 — Backend REST Routes & Socket.IO Signalling Server:**
  - Implement `authRoutes.ts`, `contactRoutes.ts` (including exact handle lookup and 6-digit PIN generate/redeem), `transferRoutes.ts`, `socketManager.ts`, and `server/src/index.ts`.
  - Verify the backend compiles (`npm run build --prefix server`) and starts cleanly.
- **Phase 3 — Frontend Scaffolding, Types, Incremental SHA-256 Worker & WebRTC Services:**
  - Create `client/package.json`, `vite.config.ts` (with `--host` enabled and `/api` + `/socket.io` proxy to `http://localhost:4000`), `tailwind.config.js`, `index.html`, and `src/index.css` matching `code.html` and `DESIGN.md`.
  - Install dependencies (`react`, `react-dom`, `react-router-dom`, `socket.io-client`, `hash-wasm`, `tailwindcss`, `postcss`, `autoprefixer`, `typescript`, `vite`, `@vitejs/plugin-react`).
  - Implement `types/peerlink.ts`, `api/httpClient.ts`, `workers/sha256.worker.ts`, `services/socketService.ts`, `services/stunProbeService.ts`, `services/webrtcService.ts`, `services/fileTransferService.ts`, `context/AuthContext.tsx`, and `context/TransferContext.tsx` with full tutor-level comments.
- **Phase 4 — All 12 Kinetic Block Pages & Global Modals:**
  - Implement `Header.tsx`, `Footer.tsx`, `Toast.tsx`, `IncomingRequestModal.tsx`, `PairPinModal.tsx`, and all 12 page components inside `client/src/pages/` preserving the exact visual structure of `code.html` while binding every form, table, tab, badge, and button to live backend/WebRTC state.
- **Phase 5 — End-to-End Build Verification & Laptop-to-Phone Launch Guide:**
  - Run `npm run build` across both `client` and `server` and fix any TypeScript or bundler errors.
  - Create a clear `README.md` with 1-command startup (`npm run dev`) and exact instructions for testing Laptop-to-Phone transfers over local Wi-Fi / HTTPS tunnel (`npx cloudflared tunnel --url http://localhost:5173`) and deploying to Render.
