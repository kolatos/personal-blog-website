import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import type {
  RegisterDto,
  LoginDto,
  AuthTokens,
  JwtPayload,
  LockoutStatus,
  UserProfile,
} from '../types/index';

// ─── Constants ──────────────────────────────────────────────────────────────

const BCRYPT_COST = 12;
const ADMIN_JWT_EXPIRY_SECONDS = 24 * 60 * 60;        // 24 hours
const USER_JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;     // 7 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;           // 15 minutes

// ─── Error helpers ──────────────────────────────────────────────────────────

/**
 * Creates an error object following the ErrorResponse interface.
 * Attach to `throw` with a status code set on the error object.
 */
function createError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>
): Error & { status: number; code: string; fields?: Record<string, string> } {
  const err = new Error(message) as Error & {
    status: number;
    code: string;
    fields?: Record<string, string>;
  };
  err.status = status;
  err.code = code;
  if (fields) err.fields = fields;
  return err;
}

// ─── JWT helpers ────────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw createError(500, 'INTERNAL_ERROR', 'JWT_SECRET is not configured');
  }
  return secret;
}

function signToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresInSeconds: number
): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresInSeconds,
  });
}

// ─── AuthService implementation ─────────────────────────────────────────────

/**
 * Registers a new Registered_User account.
 *
 * Requirements: 2.1, 2.2, 2.6
 */
export async function registerUser(data: RegisterDto): Promise<UserProfile> {
  const { email, username, password } = data;

  // Check for existing email or username in a single query to minimise round-trips
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username } }),
  ]);

  if (existingEmail || existingUsername) {
    const fields: Record<string, string> = {};
    if (existingEmail) fields['email'] = 'Email is already in use';
    if (existingUsername) fields['username'] = 'Username is already taken';

    throw createError(
      409,
      'DUPLICATE_FIELD',
      'Email or username already exists',
      fields
    );
  }

  // Hash password with bcrypt cost 12 (Req 2.6)
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      role: 'user',
    },
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as 'admin' | 'user',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Authenticates an Admin and returns a JWT with 24-hour expiry.
 *
 * Requirements: 1.1, 1.3, 7.1
 */
export async function loginAdmin(credentials: LoginDto): Promise<AuthTokens> {
  return _login(credentials, 'admin', ADMIN_JWT_EXPIRY_SECONDS);
}

/**
 * Authenticates a Registered_User and returns a JWT with 7-day expiry.
 *
 * Requirements: 2.4, 2.5, 7.1
 */
export async function loginUser(credentials: LoginDto): Promise<AuthTokens> {
  return _login(credentials, 'user', USER_JWT_EXPIRY_SECONDS);
}

/**
 * Shared login logic used by both loginAdmin and loginUser.
 *
 * Returns a generic 401 error when credentials are invalid — never reveals
 * which field is wrong (Req 1.3, 2.5).
 */
async function _login(
  credentials: LoginDto,
  expectedRole: 'admin' | 'user',
  expiresInSeconds: number
): Promise<AuthTokens> {
  const GENERIC_AUTH_ERROR = createError(
    401,
    'INVALID_CREDENTIALS',
    'Invalid credentials'
  );

  const { email, username, password } = credentials;

  // Look up the user by email or username
  let user: Awaited<ReturnType<typeof prisma.user.findUnique>> | null = null;

  if (email) {
    user = await prisma.user.findUnique({ where: { email } });
  } else if (username) {
    user = await prisma.user.findUnique({ where: { username } });
  }

  if (!user) {
    // Perform a dummy bcrypt compare to prevent timing attacks
    await bcrypt.compare(password, '$2b$12$invalidhashplaceholderxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    throw GENERIC_AUTH_ERROR;
  }

  // Verify the user has the expected role
  if (user.role !== expectedRole) {
    await bcrypt.compare(password, '$2b$12$invalidhashplaceholderxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    throw GENERIC_AUTH_ERROR;
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw GENERIC_AUTH_ERROR;
  }

  // Build JWT payload with role and jti claims (Req 7.1)
  const jti = uuidv4();
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    username: user.username,
    role: user.role as 'admin' | 'user',
    jti,
  };

  const token = signToken(payload, expiresInSeconds);

  return {
    token,
    expiresIn: expiresInSeconds,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role as 'admin' | 'user',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

/**
 * Invalidates an active JWT by hashing it (SHA-256) and storing the hash
 * along with the jti and expires_at in the token_blacklist table.
 *
 * Requirements: 1.6
 */
export async function logout(token: string, jti: string): Promise<void> {
  // Decode without verification to get expiry (we trust the jti passed from middleware)
  let expiresAt: Date;
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      expiresAt = new Date(decoded.exp * 1000);
    } else {
      // Fallback: treat as expiring in 24h if we cannot determine expiry
      expiresAt = new Date(Date.now() + ADMIN_JWT_EXPIRY_SECONDS * 1000);
    }
  } catch {
    expiresAt = new Date(Date.now() + ADMIN_JWT_EXPIRY_SECONDS * 1000);
  }

  // SHA-256 hash of the raw token
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Upsert: if somehow the same token is logged out twice, ignore silently
  await prisma.tokenBlacklist.upsert({
    where: { jti },
    create: {
      tokenHash,
      jti,
      expiresAt,
    },
    update: {},
  });
}

/**
 * Verifies and decodes a JWT, checking the blacklist.
 *
 * Requirements: 1.5
 */
export async function validateToken(token: string): Promise<JwtPayload> {
  const secret = getJwtSecret();

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, secret) as JwtPayload;
  } catch {
    throw createError(401, 'UNAUTHORIZED', 'Token is invalid or expired');
  }

  const blacklisted = await isTokenBlacklisted(decoded.jti);
  if (blacklisted) {
    throw createError(401, 'UNAUTHORIZED', 'Token has been invalidated');
  }

  return decoded;
}

/**
 * Checks whether a token (by jti) has been added to the blacklist.
 *
 * Requirements: 1.6
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const record = await prisma.tokenBlacklist.findUnique({
    where: { jti },
    select: { id: true },
  });
  return record !== null;
}

/**
 * Records a failed login attempt for the given username/email identifier.
 * After MAX_FAILED_ATTEMPTS (5) consecutive failures, sets locked_until
 * to NOW + 15 minutes.
 *
 * Requirements: 1.4
 */
export async function recordFailedAttempt(username: string): Promise<void> {
  const now = new Date();

  const current = await prisma.loginAttempts.findUnique({
    where: { username },
  });

  const newCount = (current?.attemptCount ?? 0) + 1;
  const lockedUntil =
    newCount >= MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
      : null;

  await prisma.loginAttempts.upsert({
    where: { username },
    create: {
      username,
      attemptCount: newCount,
      lockedUntil,
      lastAttemptAt: now,
    },
    update: {
      attemptCount: newCount,
      lockedUntil,
      lastAttemptAt: now,
    },
  });
}

/**
 * Checks whether the given username/email is currently locked out.
 *
 * Requirements: 1.4
 */
export async function checkAccountLockout(
  username: string
): Promise<LockoutStatus> {
  const record = await prisma.loginAttempts.findUnique({
    where: { username },
  });

  if (!record) {
    return { isLocked: false, attemptCount: 0 };
  }

  const now = new Date();
  const isLocked =
    record.lockedUntil !== null && record.lockedUntil > now;

  return {
    isLocked,
    lockedUntil: record.lockedUntil ?? undefined,
    attemptCount: record.attemptCount,
  };
}

/**
 * Resets the failed attempt counter for a username after a successful login.
 * Not part of the AuthService interface but used internally by controllers.
 */
export async function resetFailedAttempts(username: string): Promise<void> {
  await prisma.loginAttempts.upsert({
    where: { username },
    create: {
      username,
      attemptCount: 0,
      lockedUntil: null,
      lastAttemptAt: new Date(),
    },
    update: {
      attemptCount: 0,
      lockedUntil: null,
    },
  });
}
