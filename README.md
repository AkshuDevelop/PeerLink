# PEERLINK // Direct WebRTC Mesh // Zero Intermediary

A production-grade, 100% functional, full-stack browser-to-browser file transfer web application designed to work reliably between a Laptop browser and a Mobile Phone browser (iOS Safari and Android Chrome).

Built with React 18, TypeScript, Tailwind CSS, Express, Socket.IO, WebRTC SCTP DataChannels, and MongoDB (with automatic in-memory fallback).

---

## 🚀 Key Architectural Features

1. **True Peer-to-Peer Zero-Intermediary Streaming:**
   - Files are sliced into **64 KB binary frames** (`[4-byte UInt32 sequence number] + [slice bytes]`).
   - Binary data flows purely over encrypted WebRTC `RTCDataChannel` (DTLS 1.3).
   - Zero file bytes are ever uploaded, staged, or cached on the server.

2. **Laptop-to-Phone Cross-Device Compatibility:**
   - Universal dual-strategy saving: collects chunks sequentially into a `Blob`, calculates SHA-256 integrity, triggers automatic download, and displays a permanent **"DOWNLOAD SAVED FILE"** button for mobile browser tap compliance.
   - Built-in SCTP backpressure management (`MAX_BUFFERED_AMOUNT = 1MB`, `bufferedAmountLowThreshold = 256KB`) preventing mobile buffer exhaustion.
   - Early ICE candidate queueing preventing race-condition drops before remote SDP is negotiated.

3. **Incremental Cryptographic Integrity:**
   - Hash-wasm Web Worker pipeline computing true client-side SHA-256 digests on both sender and receiver without blocking the UI thread.
   - Verified before sender closes the DataChannel via reciprocal `RECEIVER_VERIFIED` control frames.

4. **Zero-Friction Database:**
   - Supports cloud MongoDB Atlas via `MONGODB_URI`.
   - Automatically provisions an embedded `mongodb-memory-server` instance if no cloud database is configured.

---

## 🛠 Quickstart Guide

### 1. Installation
Install dependencies for both `server` and `client`:
```bash
npm run install:all
```

### 2. Run Development Servers (Laptop & Phone on same Wi-Fi)
```bash
npm run dev
```
- Client runs at: `http://localhost:5173` (and your local Wi-Fi IP `http://192.168.x.x:5173`)
- Server runs at: `http://localhost:4000`

### 3. Testing between Laptop and Mobile Phone
1. Connect your Laptop and Mobile Phone to the same Wi-Fi network.
2. Find your laptop's local IP (e.g. `192.168.1.50`).
3. Open `http://localhost:5173` on your Laptop browser. Sign up as `@laptop_node`.
4. Open `http://192.168.1.50:5173` on your Mobile Phone browser (Safari / Chrome). Sign up as `@phone_node`.
5. Tap **PAIR CODE** in the top bar on both devices:
   - Generate a 6-digit PIN on one device.
   - Enter that PIN on the other device and tap **CONNECT PIN**.
6. Both devices will instantly appear in each other's **PEERS** list.
7. Select a file on your Laptop and transmit to `@phone_node`. Watch real-time 64 KB SCTP chunk streaming, SHA-256 verification, and immediate file saving on your mobile phone!

*Optional HTTPS Tunnel (Cloudflare):*
```bash
npx cloudflared tunnel --url http://localhost:5173
```
This gives you an external HTTPS URL accessible across any cellular/4G/5G carrier network.

---

## 🌐 Production Deployment & Persistent Cloud Database

PeerLink is designed with a dual-mode persistence architecture:
- **Local Dev:** Auto-starts an embedded in-memory MongoDB instance with zero setup required.
- **Production:** Connects to any cloud MongoDB database (such as **MongoDB Atlas Free M0**) by providing `MONGODB_URI`. All user accounts, hashed passwords, sessions, friend lists (contacts), and transfer audit logs persist permanently across restarts and deployments.

### 1. Set Up Free MongoDB Atlas Database (Free Forever)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and create a free account.
2. Click **Create Deployment** → Select **M0 Free Tier** (choose the AWS region closest to your users, e.g., N. Virginia `us-east-1` or Mumbai `ap-south-1`).
3. Under **Security Quickstart**:
   - Create a **Username & Password** (e.g. `peerlink_admin` / `YourSecurePassword123`).
   - Under **Where would you like to connect from?**, select **Cloud Environment** or add IP Address `0.0.0.0/0` (Description: *Allow Access from Anywhere*).
   > **Note:** Cloud hosts like Render, Railway, and Heroku assign dynamic egress IPs to containers. `0.0.0.0/0` is required so your server can connect to Atlas. Access is guarded by your username & password.
4. Go to **Clusters** → Click **Connect** → Choose **Drivers** (Node.js).
5. Copy the connection string. It looks like:
   ```text
   mongodb+srv://peerlink_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
6. Replace `<password>` with your database user password and specify the database name (`/peerlink`):
   ```text
   mongodb+srv://peerlink_admin:YourSecurePassword123@cluster0.abcde.mongodb.net/peerlink?retryWrites=true&w=majority
   ```

---

### 2. Deploy to Render from GitHub (One-Click / Blueprint)

PeerLink includes a pre-configured `render.yaml` Blueprint file.

#### Method A: Render Blueprint (Automated)
1. Push your PeerLink code to a private or public GitHub repository.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint**.
3. Connect your GitHub repository.
4. Render will read `render.yaml` and configure the Web Service automatically:
   - **Build Command:** `npm run install:all && npm run build`
   - **Start Command:** `npm start`
   - **Auto-generated:** `JWT_SECRET`
5. Under Environment Variables, paste your `MONGODB_URI` from MongoDB Atlas.
6. Click **Apply**. Render will build the TypeScript server, build the Vite React client, and launch the unified production server!

#### Method B: Manual Web Service Setup on Render
If you prefer creating a Web Service manually:
1. In Render, click **New +** → **Web Service** → Connect your GitHub repo.
2. Set the following fields:
   - **Name:** `peerlink`
   - **Runtime:** `Node`
   - **Build Command:** `npm run install:all && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
3. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGODB_URI`: `<your-mongodb-atlas-connection-string>`
   - `JWT_SECRET`: `<any-random-32-character-secret>`
   - `CLIENT_DIST_PATH`: `../client/dist`
4. Click **Deploy Web Service**. Once live, you will get a free HTTPS URL:
   `https://peerlink-xxxx.onrender.com`
   Both you on PC and your friends on mobile phones can visit this URL, create persistent user accounts, add each other with 6-digit PINs, and transfer files!

---

## 📂 Monorepo Structure

```text
peerlink/
├── server/
│   ├── src/
│   │   ├── config/db.ts             # MongoDB Atlas + in-memory fallback
│   │   ├── models/                  # User, Contact, Transfer, PairPin
│   │   ├── middleware/              # JWT auth and centralized error handler
│   │   ├── routes/                  # authRoutes, contactRoutes, transferRoutes
│   │   ├── socket/socketManager.ts  # Socket.IO signalling & presence
│   │   └── index.ts                 # Express + Socket.IO server
├── client/
│   ├── src/
│   │   ├── api/httpClient.ts        # Typed fetch wrapper with JWT
│   │   ├── context/                 # AuthContext & TransferContext
│   │   ├── services/                # webrtcService, fileTransferService, stunProbeService
│   │   ├── workers/sha256.worker.ts # hash-wasm incremental Web Worker
│   │   ├── components/              # Header, Footer, Modals, Toast
│   │   └── pages/                   # All 12 Kinetic Block pages
```
