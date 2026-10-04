import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    loginAttempts: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';
import { accountLockoutMiddleware } from '../accountLockout';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function buildReq(body: Record<string, string> = {}): Partial<Request> {
  return { body } as Partial<Request>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('accountLockoutMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  // ── Requirement 1.4: no lockout record ───────────────────────────────────

  describe('account not locked', () => {
    it('calls next() when no LoginAttempts record exists for the identifier', async () => {
      vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue(null);

      const req = buildReq({ username: 'alice' });
      const res = buildRes();

      await accountLockoutMiddleware(req as Request, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when record exists but lockedUntil is null', async () => {
      vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
        lockedUntil: null,
      } as never);

      const req = buildReq({ username: 'alice' });
      const res = buildRes();

      await accountLockoutMiddleware(req as Request, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when lockedUntil is in the past (lockout expired)', async () => {
      const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
      vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
        lockedUntil: pastDate,
      } as never);

      const req = buildReq({ username: 'alice' });
      const res = buildRes();

      await accountLockoutMiddleware(req as Request, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── Requirement 1.4: account is locked ───────────────────────────────────

  describe('account locked', () => {
    it('returns 409 ACCOUNT_LOCKED when lockedUntil is in the future (username lookup)', async () => {
      const futureDate = new Date(Date.now() + 15 * 60_000); // 15 minutes from now
      vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
        lockedUntil: futureDate,
      } as never);

      const req = buildReq({ username: 'alice' });
      const res = buildRes();

      await accountLockoutMiddleware(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked. Try again in 15 minutes.',
        },
      });
    });

    it('returns 409 ACCOUNT_LOCKED when lockedUntil is in the future (email lookup)', async () => {
      const futureDate = new Date(Date.now() + 15 * 60_000);
      vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
        lockedUntil: futureDate,
      } as never);

      // Uses email as the identifier when username is absent
      const req = buildReq({ email: 'alice@example.com' });
      const res = buildRes();

      await accountLockoutMiddleware(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('queries the DB with the correct identifier (username takes precedence over email)', async () => {
      vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue(null);

      const req = buildReq({ username: 'alice', email: 'alice@example.com' });
      const res = buildRes();

      await accountLockoutMiddleware(req as Request, res, next);

      // username should be used when both are present (nullish coalescing picks first)
      expect(prisma.loginAttempts.findUnique).toHaveBeenCalledWith({
        where: { username: 'alice' },
        select: { lockedUntil: true },
      });
    });
  });

  // ── No identifier provided ───────────────────────────────────────────────

  describe('missing identifier', () => {
    it('calls next() without querying the DB when neither username nor email is in the body', async () => {
      const req = buildReq({});
      const res = buildRes();

      await accountLockoutMiddleware(req as Request, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(prisma.loginAttempts.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── Database error (fail open) ───────────────────────────────────────────

  describe('database error', () => {
    it('calls next() (fail open) when Prisma throws during lockout lookup', async () => {
      vi.mocked(prisma.loginAttempts.findUnique).mockRejectedValue(new Error('DB down'));

      const req = buildReq({ username: 'alice' });
      const res = buildRes();

      await accountLockoutMiddleware(req as Request, res, next);

      // Fail open: legitimate users should not be blocked on DB errors
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
