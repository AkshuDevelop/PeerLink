/**
 * ============================================================
 * FILE PURPOSE:
 *   Express router for authentication endpoints.
 *   Handles user registration, login, profile retrieval, and
 *   handle updates. Issues and validates JWTs for all protected routes.
 *
 * ARCHITECTURAL LAYER:
 *   Express Route Controller (REST API Layer)
 *
 * ENDPOINTS:
 *   POST   /api/auth/register — Create a new user account
 *   POST   /api/auth/login    — Authenticate and receive a JWT
 *   GET    /api/auth/me       — Fetch current user profile (protected)
 *   PATCH  /api/auth/me       — Update handle (protected)
 *
 * CONNECTED MODULES:
 *   - Uses: User model (Mongoose)
 *   - Uses: authMiddleware (JWT verification)
 *   - Uses: bcryptjs (password hashing)
 *   - Uses: jsonwebtoken (token creation)
 * ============================================================
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, generateNodeId } from '../models/User';
import { PairPin, generatePairPin } from '../models/PairPin';
import { authMiddleware } from '../middleware/authMiddleware';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/auth/register — Create a new user account.
 *
 * WHAT IT DOES:
 *   1. Validates email, handle, and password inputs.
 *   2. Checks for duplicate email or handle.
 *   3. Hashes the password with bcrypt (12 salt rounds).
 *   4. Generates a deterministic nodeId (e.g., "NODE-77-DELTA").
 *   5. Saves the new User document to MongoDB.
 *   6. Returns a signed JWT and the new user's public profile.
 *
 * CALLED BY: client/src/pages/SignUpPage.tsx form submit.
 *
 * CALLS OUT TO: User.create(), bcrypt.hash(), jwt.sign()
 */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { email, handle, password } = req.body;

  // --- Input validation ---
  if (!email || !handle || !password) {
    throw new AppError('EMAIL, HANDLE, AND PASSWORD ARE REQUIRED', 400);
  }

  if (password.length < 8) {
    throw new AppError('PASSPHRASE MUST BE AT LEAST 8 CHARACTERS', 400);
  }

  // Validate handle format: 3-20 chars, lowercase letters/numbers/dot/underscore
  const handleRegex = /^[a-z0-9._]{3,20}$/;
  const normalizedHandle = handle.toLowerCase().trim();
  if (!handleRegex.test(normalizedHandle)) {
    throw new AppError('HANDLE: 3-20 chars, letters/numbers/dot/underscore only', 400);
  }

  // --- Duplicate check ---
  const existing = await User.findOne({
    $or: [
      { email: email.toLowerCase().trim() },
      { handle: normalizedHandle },
    ],
  });

  if (existing) {
    if (existing.email === email.toLowerCase().trim()) {
      throw new AppError('EMAIL ALREADY REGISTERED', 409);
    }
    throw new AppError('HANDLE ALREADY CLAIMED', 409);
  }

  // --- Hash password (12 rounds is a good balance of security vs. speed) ---
  const passwordHash = await bcrypt.hash(password, 12);

  // --- Generate display data ---
  const nodeId = generateNodeId(normalizedHandle);
  // Avatar: first 2 chars of handle, uppercase (e.g., "kofi" → "KO")
  const avatar = normalizedHandle.substring(0, 2).toUpperCase();

  // --- Create user in database ---
  const user = await User.create({
    email: email.toLowerCase().trim(),
    handle: normalizedHandle,
    passwordHash,
    nodeId,
    avatar,
    allowLanHost: true,
    stunServer: 'stun:stun.l.google.com:19302',
  });

  // --- Sign a JWT (expires in 7 days) ---
  const secret = process.env.JWT_SECRET!;
  const token = jwt.sign(
    { userId: user._id.toString(), handle: user.handle },
    secret,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    token,
    user: {
      id: user._id.toString(),
      nodeId: user.nodeId,
      handle: user.handle,
      email: user.email,
      avatar: user.avatar,
      allowLanHost: user.allowLanHost,
      stunServer: user.stunServer,
      isGuest: user.isGuest,
    },
  });
}));

/**
 * POST /api/auth/guest — Instant 1-Click Guest Node.
 *
 * WHAT IT DOES:
 *   1. Zero parameters required.
 *   2. Creates a unique temporary Guest user in MongoDB with isGuest: true.
 *   3. Automatically generates an active 6-digit PairPin for instant pairing.
 *   4. Returns token (24-hour expiration), user profile, and pairPin.
 *
 * CALLED BY: LandingPage, SignInPage, SignUpPage "⚡ INSTANT GUEST NODE" button.
 */
router.post('/guest', asyncHandler(async (_req: Request, res: Response) => {
  // Generate random 4-digit suffix
  let handle = '';
  let attempts = 0;
  while (attempts < 10) {
    const num = Math.floor(1000 + Math.random() * 9000);
    handle = `guest_${num}`;
    const exists = await User.findOne({ handle });
    if (!exists) break;
    attempts++;
  }

  const randomPass = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const passwordHash = await bcrypt.hash(randomPass, 10);
  const nodeId = `GUEST-${handle.toUpperCase()}`;
  const avatar = `G${handle.slice(-1)}`;
  const email = `${handle}_${Date.now()}@ephemeral.peerlink`;

  const user = await User.create({
    email,
    handle,
    passwordHash,
    nodeId,
    avatar,
    allowLanHost: true,
    stunServer: 'stun:stun.l.google.com:19302',
    isGuest: true,
  });

  // Generate an instant 6-digit PairPin valid for 24 hours for guest convenience
  let pin = '';
  let pinAttempts = 0;
  while (pinAttempts < 5) {
    pin = generatePairPin();
    const existingPin = await PairPin.findOne({ pin });
    if (!existingPin) break;
    pinAttempts++;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const pairPin = await PairPin.create({
    pin,
    creator: user._id,
    expiresAt,
  });

  const secret = process.env.JWT_SECRET!;
  const token = jwt.sign(
    { userId: user._id.toString(), handle: user.handle },
    secret,
    { expiresIn: '24h' }
  );

  res.status(201).json({
    token,
    user: {
      id: user._id.toString(),
      nodeId: user.nodeId,
      handle: user.handle,
      email: user.email,
      avatar: user.avatar,
      allowLanHost: user.allowLanHost,
      stunServer: user.stunServer,
      isGuest: true,
    },
    pairPin: {
      pin: pairPin.pin,
      expiresAt: pairPin.expiresAt,
    },
  });
}));

/**
 * POST /api/auth/login — Authenticate existing user, return JWT.
 *
 * WHAT IT DOES:
 *   1. Accepts either handle or email as the identifier.
 *   2. Finds the user by handle or email (case-insensitive).
 *   3. Verifies password against the bcrypt hash.
 *   4. Returns a new signed JWT + user profile on success.
 *
 * CALLED BY: client/src/pages/SignInPage.tsx form submit.
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password } = req.body; // identifier = handle OR email

  if (!identifier || !password) {
    throw new AppError('IDENTIFIER AND PASSWORD REQUIRED', 400);
  }

  const normalized = identifier.toLowerCase().trim();

  // Find by handle OR email, and explicitly include passwordHash
  // (it's select:false by default, so we must ask for it here)
  const user = await User.findOne({
    $or: [{ handle: normalized }, { email: normalized }],
  }).select('+passwordHash');

  if (!user) {
    // Use a generic error message to prevent user enumeration
    throw new AppError('INVALID CREDENTIALS', 401);
  }

  // Verify password using the instance method from User model
  const passwordValid = await user.comparePassword(password);
  if (!passwordValid) {
    throw new AppError('INVALID CREDENTIALS', 401);
  }

  // Sign a fresh JWT
  const secret = process.env.JWT_SECRET!;
  const token = jwt.sign(
    { userId: user._id.toString(), handle: user.handle },
    secret,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user._id.toString(),
      nodeId: user.nodeId,
      handle: user.handle,
      email: user.email,
      avatar: user.avatar,
      allowLanHost: user.allowLanHost,
      stunServer: user.stunServer,
      isGuest: user.isGuest,
    },
  });
}));

/**
 * GET /api/auth/me — Return the authenticated user's profile.
 *
 * WHAT IT DOES:
 *   Looks up the user by the userId from the verified JWT payload,
 *   and returns their public profile data.
 *
 * CALLED BY: client/src/context/AuthContext.tsx on app load
 *   (to restore session from localStorage token).
 */
router.get('/me', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId);

  if (!user) {
    throw new AppError('USER NOT FOUND', 404);
  }

  res.json({
    id: user._id.toString(),
    nodeId: user.nodeId,
    handle: user.handle,
    email: user.email,
    avatar: user.avatar,
    allowLanHost: user.allowLanHost,
    stunServer: user.stunServer,
    isGuest: user.isGuest,
  });
}));

/**
 * PATCH /api/auth/me — Update the authenticated user's handle.
 *
 * WHAT IT DOES:
 *   1. Validates the new handle format.
 *   2. Checks for handle conflicts with other users.
 *   3. Updates the handle (and avatar, since avatar = first 2 chars of handle).
 *   4. Can also update allowLanHost preference.
 *
 * CALLED BY: client/src/pages/SettingsPage.tsx SAVE HANDLE button.
 */
router.patch('/me', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { handle, allowLanHost } = req.body;

  const user = await User.findById(req.user!.userId);
  if (!user) {
    throw new AppError('USER NOT FOUND', 404);
  }

  // Update handle if provided
  if (handle !== undefined) {
    const normalizedHandle = String(handle).toLowerCase().trim();
    const handleRegex = /^[a-z0-9._]{3,20}$/;

    if (!handleRegex.test(normalizedHandle)) {
      throw new AppError('HANDLE: 3-20 chars, letters/numbers/dot/underscore only', 400);
    }

    // Check for conflicts with other users
    const conflict = await User.findOne({
      handle: normalizedHandle,
      _id: { $ne: user._id },
    });

    if (conflict) {
      throw new AppError('HANDLE ALREADY CLAIMED BY ANOTHER NODE', 409);
    }

    user.handle = normalizedHandle;
    user.avatar = normalizedHandle.substring(0, 2).toUpperCase();
  }

  // Update ICE transport policy if provided
  if (allowLanHost !== undefined) {
    user.allowLanHost = Boolean(allowLanHost);
  }

  await user.save();

  res.json({
    id: user._id.toString(),
    nodeId: user.nodeId,
    handle: user.handle,
    email: user.email,
    avatar: user.avatar,
    allowLanHost: user.allowLanHost,
    stunServer: user.stunServer,
    isGuest: user.isGuest,
  });
}));

export default router;
