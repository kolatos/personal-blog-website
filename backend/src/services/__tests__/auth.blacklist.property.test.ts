// Feature: personal-blog-website, Property 9: JWT blacklist prevents reuse after logout

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { Request, Response, NextFunction } from 'express';

// ── Module mocks ──────────────────────────────────────────────────────────────
// Mocks must be hoisted before real module imports.

vi.mock('../../lib/prisma', () => ({
  default: {
    tokenBlacklist: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
    decode: vi.fn(),
  },
}));

// bcrypt has a native binding that may not be available in the test environment;
// mock it so the service module can be loaded without the native addon.
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { logout, isTokenBlacklisted } from '../auth.service';
import { authenticateJWT } from '../../middleware/authenticateJWT';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal Express-like response mock. */
function buildRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

/** Build a minimal Express-like request mock with an Authorization header. */
function buildReq(token: string): Partial<Request> {
  return {
    headers: { authorization: `Bearer ${token}` },
    user: undefined,
  } as Partial<Request>;
}

/**
 * Arbitrary: generates a valid-looking JWT jti (UUID-like string).
 * We use printable ASCII strings of length 10–36 to represent JTI values.
 */
const jtiArb = fc.stringOf(
  fc.mapToConstant(
    { num: 26, build: (n) => String.fromCharCode(97 + n) }, // a-z
    { num: 10, build: (n) => String.fromCharCode(48 + n) }, // 0-9
    { num: 1, build: () => '-' },
  ),
  { minLength: 10, maxLength: 36 },
);

/**
 * Arbitrary: generates a plausible raw JWT string (three base64url segments).
 * Real JWTs won't be verified because we mock jwt.verify, so format is enough.
 */
const tokenArb = fc.tuple(
  fc.base64String({ minLength: 1, maxLength: 20 }),
  fc.base64String({ minLength: 1, maxLength: 60 }),
  fc.base64String({ minLength: 1, maxLength: 60 }),
).map(([header, payload, sig]) => `${header}.${payload}.${sig}`);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 9: JWT blacklist prevents reuse after logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-for-property-tests';
  });

  // ── Part 1: isTokenBlacklisted returns true after logout ─────────────────

  describe('isTokenBlacklisted returns true for every blacklisted jti', () => {
    /**
     * **Validates: Requirements 1.6**
     *
     * For any (token, jti) pair, after calling logout() the Prisma
     * tokenBlacklist.upsert is called, and subsequent calls to
     * isTokenBlacklisted(jti) return true.
     */
    it('always returns true when jti exists in the blacklist', async () => {
      await fc.assert(
        fc.asyncProperty(jtiArb, tokenArb, async (jti, token) => {
          vi.clearAllMocks();

          // logout() calls jwt.decode to extract exp; return a future expiry
          vi.mocked(jwt.decode).mockReturnValue({
            exp: Math.floor(Date.now() / 1000) + 86400,
          });

          // logout() calls prisma.tokenBlacklist.upsert
          vi.mocked(prisma.tokenBlacklist.upsert).mockResolvedValue({} as never);

          await logout(token, jti);

          // After logout, simulate that the blacklist record exists
          vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue({
            id: 'some-id',
            jti,
            tokenHash: 'some-hash',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 86400_000),
          } as never);

          const result = await isTokenBlacklisted(jti);
          expect(result).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('always returns false when jti does NOT exist in the blacklist', async () => {
      await fc.assert(
        fc.asyncProperty(jtiArb, async (jti) => {
          vi.clearAllMocks();

          // Simulate no record found → not blacklisted
          vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue(null);

          const result = await isTokenBlacklisted(jti);
          expect(result).toBe(false);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 2: authenticateJWT middleware rejects blacklisted tokens with 401 ─

  describe('authenticateJWT rejects every blacklisted token with HTTP 401', () => {
    /**
     * **Validates: Requirements 1.6**
     *
     * For any JWT whose jti has been added to the blacklist, the
     * authenticateJWT middleware must respond 401 and not call next().
     */
    it('returns 401 for any token whose jti is in the blacklist', async () => {
      await fc.assert(
        fc.asyncProperty(jtiArb, tokenArb, async (jti, rawToken) => {
          vi.clearAllMocks();

          const payload = {
            sub: 'user-abc',
            username: 'testuser',
            role: 'user' as const,
            jti,
            iat: Math.floor(Date.now() / 1000) - 60,
            exp: Math.floor(Date.now() / 1000) + 3600,
          };

          // jwt.verify succeeds (token is structurally valid)
          vi.mocked(jwt.verify).mockReturnValue(payload as never);

          // The jti IS in the blacklist → middleware must reject
          vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue({
            jti,
            createdAt: new Date(),
          } as never);

          const req = buildReq(rawToken);
          const res = buildRes();
          const next: NextFunction = vi.fn();

          await authenticateJWT(req as Request, res, next);

          // Must not reach the next handler
          expect(next).not.toHaveBeenCalled();

          // Must return 401
          expect(res.status).toHaveBeenCalledWith(401);
          expect(res.json).toHaveBeenCalledWith({
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });
        }),
        { numRuns: 100 },
      );
    });

    it('calls next() for any token whose jti is NOT in the blacklist', async () => {
      await fc.assert(
        fc.asyncProperty(jtiArb, tokenArb, async (jti, rawToken) => {
          vi.clearAllMocks();

          const payload = {
            sub: 'user-abc',
            username: 'testuser',
            role: 'user' as const,
            jti,
            iat: Math.floor(Date.now() / 1000) - 60,
            exp: Math.floor(Date.now() / 1000) + 3600,
          };

          // jwt.verify succeeds
          vi.mocked(jwt.verify).mockReturnValue(payload as never);

          // The jti is NOT in the blacklist
          vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue(null);

          const req = buildReq(rawToken);
          const res = buildRes();
          const next: NextFunction = vi.fn();

          await authenticateJWT(req as Request, res, next);

          // Must proceed to the next handler
          expect(next).toHaveBeenCalledOnce();
          expect(res.status).not.toHaveBeenCalled();
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 3: logout calls upsert and tokens with no exp get a fallback ─────

  describe('logout stores every token in the blacklist regardless of exp claim', () => {
    /**
     * **Validates: Requirements 1.6**
     *
     * logout() must always upsert into tokenBlacklist, even when the
     * decoded token has no exp field (uses fallback expiry).
     */
    it('calls tokenBlacklist.upsert for tokens with a valid exp claim', async () => {
      await fc.assert(
        fc.asyncProperty(
          jtiArb,
          tokenArb,
          fc.integer({ min: 1, max: 86400 * 365 }),
          async (jti, token, ttlSeconds) => {
            vi.clearAllMocks();

            vi.mocked(jwt.decode).mockReturnValue({
              exp: Math.floor(Date.now() / 1000) + ttlSeconds,
            });
            vi.mocked(prisma.tokenBlacklist.upsert).mockResolvedValue({} as never);

            await logout(token, jti);

            expect(prisma.tokenBlacklist.upsert).toHaveBeenCalledOnce();

            // The upsert create payload must contain the jti
            const callArgs = vi.mocked(prisma.tokenBlacklist.upsert).mock.calls[0][0];
            expect(callArgs.where).toEqual({ jti });
            expect(callArgs.create.jti).toBe(jti);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('calls tokenBlacklist.upsert even when the token has no exp field (fallback path)', async () => {
      await fc.assert(
        fc.asyncProperty(jtiArb, tokenArb, async (jti, token) => {
          vi.clearAllMocks();

          // Decoded token has no exp → triggers the fallback expiry path
          vi.mocked(jwt.decode).mockReturnValue({});
          vi.mocked(prisma.tokenBlacklist.upsert).mockResolvedValue({} as never);

          await logout(token, jti);

          expect(prisma.tokenBlacklist.upsert).toHaveBeenCalledOnce();
          const callArgs = vi.mocked(prisma.tokenBlacklist.upsert).mock.calls[0][0];
          expect(callArgs.create.jti).toBe(jti);
        }),
        { numRuns: 100 },
      );
    });
  });
});
