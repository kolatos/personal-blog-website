import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireRole } from './requireRole';
import type { JwtPayload } from '../types';

// Helper to build a minimal mock Express Request
function buildReq(user?: Partial<JwtPayload> | null): Partial<Request> {
  return { user: user === null ? undefined : (user as JwtPayload) } as Partial<Request>;
}

// Helper to build a minimal mock Express Response
function buildRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('requireRole middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  // ── Happy paths ──────────────────────────────────────────────────────────────

  it('calls next() when req.user.role matches required role "admin"', () => {
    const middleware = requireRole('admin');
    const req = buildReq({ sub: 'u1', username: 'owner', role: 'admin', jti: 'j1' });
    const res = buildRes();

    middleware(req as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when req.user.role matches required role "user"', () => {
    const middleware = requireRole('user');
    const req = buildReq({ sub: 'u2', username: 'alice', role: 'user', jti: 'j2' });
    const res = buildRes();

    middleware(req as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── Requirement 7.3: wrong role ───────────────────────────────────────────────

  it('returns 403 when Registered_User tries to access an admin-only endpoint', () => {
    const middleware = requireRole('admin');
    const req = buildReq({ sub: 'u3', username: 'alice', role: 'user', jti: 'j3' });
    const res = buildRes();

    middleware(req as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    });
  });

  it('returns 403 when Admin tries to access a user-only endpoint', () => {
    // Edge case: an admin hitting a route guarded with requireRole('user')
    const middleware = requireRole('user');
    const req = buildReq({ sub: 'u4', username: 'owner', role: 'admin', jti: 'j4' });
    const res = buildRes();

    middleware(req as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    });
  });

  // ── Requirement 7.2: missing / unrecognised role claim ───────────────────────

  it('returns 403 when req.user is undefined (no authenticated user)', () => {
    const middleware = requireRole('admin');
    const req = buildReq(null); // user is undefined
    const res = buildRes();

    middleware(req as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    });
  });

  it('returns 403 when role claim is an unrecognised value', () => {
    const middleware = requireRole('admin');
    // Cast to bypass TS type check — simulates a tampered JWT payload
    const req = buildReq({ sub: 'u5', username: 'hacker', role: 'superuser' as 'admin', jti: 'j5' });
    const res = buildRes();

    middleware(req as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    });
  });

  // ── Error response shape ─────────────────────────────────────────────────────

  it('always returns the standard FORBIDDEN error response shape on 403', () => {
    const middleware = requireRole('admin');
    const req = buildReq({ sub: 'u6', username: 'alice', role: 'user', jti: 'j6' });
    const res = buildRes();

    middleware(req as Request, res, next);

    const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      error: { code: string; message: string };
    };
    expect(jsonCall).toHaveProperty('error');
    expect(jsonCall.error).toHaveProperty('code', 'FORBIDDEN');
    expect(jsonCall.error).toHaveProperty('message', 'Insufficient permissions');
  });
});
