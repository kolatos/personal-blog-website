import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { loginRateLimiter } from '../rateLimiter';

/**
 * Integration-style tests for loginRateLimiter.
 *
 * Uses a minimal Express app + supertest to exercise the real middleware
 * without a running server.  This is the only reliable way to test
 * express-rate-limit behaviour because its internal state is encapsulated.
 *
 * Requirements: 7.5, 7.6
 */
function buildApp() {
  const app = express();
  app.use(loginRateLimiter);
  app.get('/test', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('loginRateLimiter middleware', () => {
  // ── Requirement 7.5 / 7.6: under the limit ───────────────────────────────

  it('passes through requests when under the rate limit', async () => {
    const app = buildApp();
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('includes RateLimit-* standard headers in the response', async () => {
    const app = buildApp();
    const res = await request(app).get('/test');
    // express-rate-limit with standardHeaders:true adds these headers
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
  });

  // ── Requirement 7.5 / 7.6: exceeding the limit ───────────────────────────

  it('returns 429 with RATE_LIMIT_EXCEEDED error after exceeding 10 requests', async () => {
    const app = buildApp();

    // Exhaust the 10-request window (all from the same IP via supertest)
    for (let i = 0; i < 10; i++) {
      await request(app).get('/test');
    }

    // 11th request should be rate limited
    const res = await request(app).get('/test');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please wait',
      },
    });
  });
});
