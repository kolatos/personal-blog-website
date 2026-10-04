import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from '../../types';

// ── Module mocks ─────────────────────────────────────────────────────────────
// Must be hoisted before any imports that pull in the real modules.

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

vi.mock('../../lib/prisma', () => ({
  default: {
    tokenBlacklist: {
      findUnique: vi.fn(),
    },
  },
}));

// Import after mocks are set up
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { authenticateJWT } from '../authenticateJWT';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function buildReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  } as Partial<Request>;
}

const VALID_PAYLOAD: JwtPayload = {
  sub: 'user-123',
  username: 'alice',
  role: 'user',
  jti: 'jwt-id-abc',
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const UNAUTHORIZED_BODY = {
  error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('authenticateJWT middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
    // Default: JWT_SECRET is set
    process.env.JWT_SECRET = 'test-secret';
  });

  // ── Requirement 1.5: valid token ─────────────────────────────────────────

  describe('valid token', () => {
    it('calls next() and sets req.user when token is valid and not blacklisted', async () => {
      vi.mocked(jwt.verify).mockReturnValue(VALID_PAYLOAD as never);
      vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue(null);

      const req = buildReq(`Bearer valid.jwt.token`);
      const res = buildRes();

      await authenticateJWT(req as Request, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toEqual(VALID_PAYLOAD);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── Requirement 1.5: missing / malformed Authorization header ────────────

  describe('missing or malformed Authorization header', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const req = buildReq(undefined);
      const res = buildRes();

      await authenticateJWT(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(UNAUTHORIZED_BODY);
    });

    it('returns 401 when Authorization header does not start with "Bearer "', async () => {
      const req = buildReq('Token some.jwt.here');
      const res = buildRes();

      await authenticateJWT(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(UNAUTHORIZED_BODY);
    });
  });

  // ── Expired token ────────────────────────────────────────────────────────

  describe('expired token', () => {
    it('returns 401 when jwt.verify throws TokenExpiredError', async () => {
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      vi.mocked(jwt.verify).mockImplementation(() => { throw expiredError; });

      const req = buildReq('Bearer expired.jwt.token');
      const res = buildRes();

      await authenticateJWT(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(UNAUTHORIZED_BODY);
    });
  });

  // ── Invalid / tampered token ─────────────────────────────────────────────

  describe('invalid token', () => {
    it('returns 401 when jwt.verify throws JsonWebTokenError (bad signature)', async () => {
      const invalidError = new Error('invalid signature');
      invalidError.name = 'JsonWebTokenError';
      vi.mocked(jwt.verify).mockImplementation(() => { throw invalidError; });

      const req = buildReq('Bearer tampered.jwt.token');
      const res = buildRes();

      await authenticateJWT(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(UNAUTHORIZED_BODY);
    });
  });

  // ── Blacklisted token (Requirement 1.5) ──────────────────────────────────

  describe('blacklisted token', () => {
    it('returns 401 when jti exists in TokenBlacklist', async () => {
      vi.mocked(jwt.verify).mockReturnValue(VALID_PAYLOAD as never);
      vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue({
        jti: VALID_PAYLOAD.jti,
        createdAt: new Date(),
      });

      const req = buildReq('Bearer blacklisted.jwt.token');
      const res = buildRes();

      await authenticateJWT(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(UNAUTHORIZED_BODY);
    });

    it('queries the blacklist using the jti from the decoded payload', async () => {
      vi.mocked(jwt.verify).mockReturnValue(VALID_PAYLOAD as never);
      vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue(null);

      const req = buildReq('Bearer valid.jwt.token');
      const res = buildRes();

      await authenticateJWT(req as Request, res, next);

      expect(prisma.tokenBlacklist.findUnique).toHaveBeenCalledWith({
        where: { jti: VALID_PAYLOAD.jti },
      });
    });
  });

  // ── JWT_SECRET missing ───────────────────────────────────────────────────

  describe('missing JWT_SECRET env var', () => {
    it('returns 401 when JWT_SECRET is not set', async () => {
      delete process.env.JWT_SECRET;

      const req = buildReq('Bearer some.jwt.token');
      const res = buildRes();

      await authenticateJWT(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(UNAUTHORIZED_BODY);
    });
  });

  // ── Database error (fail closed) ─────────────────────────────────────────

  describe('database error', () => {
    it('returns 401 (fail closed) when Prisma throws during blacklist lookup', async () => {
      vi.mocked(jwt.verify).mockReturnValue(VALID_PAYLOAD as never);
      vi.mocked(prisma.tokenBlacklist.findUnique).mockRejectedValue(new Error('DB down'));

      const req = buildReq('Bearer valid.jwt.token');
      const res = buildRes();

      await authenticateJWT(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(UNAUTHORIZED_BODY);
    });
  });
});
