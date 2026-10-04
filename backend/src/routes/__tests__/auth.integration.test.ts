/**
 * Integration tests for Auth routes
 * Task 3.5 — Personal Blog Website
 *
 * Flows covered:
 *  1. Full flow: register → login → access protected route → logout → reuse token (expect 401)
 *  2. Rate limiting: 10+ requests within 60 seconds → expect 429
 *  3. Account lockout: 5× failed login → 409 → after lockout expires → login succeeds
 *
 * Requirements: 1.1–1.7, 2.1–2.6, 7.5, 7.6
 *
 * Setup:
 *  - Requires a live PostgreSQL database.
 *  - Set DATABASE_URL (or TEST_DATABASE_URL) in your .env, pointing to a test database.
 *  - Run `npx prisma migrate deploy` before running these tests.
 *  - Tests auto-skip when the database is unreachable.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../app';
import prisma from '../../lib/prisma';

// ─── Connectivity guard ───────────────────────────────────────────────────────

/**
 * Returns true when the database is reachable; false otherwise.
 * Used to skip the entire suite when no test DB is available.
 */
async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ─── Test database helpers ────────────────────────────────────────────────────

/**
 * Cleans auth-related tables between test groups to avoid cross-test pollution.
 * Order matters: token_blacklist and login_attempts before users.
 */
async function cleanAuthTables(): Promise<void> {
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.loginAttempts.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.user.deleteMany({});
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEST_ADMIN = {
  username: 'testadmin',
  email: 'testadmin@example.com',
  password: 'AdminPass123!',
};

const TEST_USER = {
  username: 'testuser',
  email: 'testuser@example.com',
  password: 'UserPass456!',
};

// ─── IP allocation per test group ─────────────────────────────────────────────
// Each describe block that exercises the rate limiter uses a different IP
// so tests remain isolated from each other's rate-limit counters.
// We enable trust-proxy for the app so X-Forwarded-For is respected.

const IP = {
  fullFlow: '10.0.1.1',
  rateLimitLogin: '10.0.2.1',
  rateLimitRegister: '10.0.3.1',
  lockout: '10.0.4.1',
  misc: '10.0.5.1',
};

// ─── Global setup / teardown ──────────────────────────────────────────────────

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    console.warn(
      '\n⚠  Integration tests skipped: PostgreSQL is not reachable at the configured DATABASE_URL.\n' +
        '   Start a PostgreSQL instance and ensure DATABASE_URL is set correctly.\n'
    );
    return;
  }

  // Enable trust proxy so X-Forwarded-For is used as req.ip by express-rate-limit.
  // Use numeric value (1) instead of boolean true to avoid express-rate-limit
  // ERR_ERL_PERMISSIVE_TRUST_PROXY validation error.
  app.set('trust proxy', 1);

  // Clean state from any previous test run
  await cleanAuthTables();

  // Seed an admin user directly into the DB (role: 'admin')
  const hash = await bcrypt.hash(TEST_ADMIN.password, 12);
  await prisma.user.create({
    data: {
      username: TEST_ADMIN.username,
      email: TEST_ADMIN.email,
      passwordHash: hash,
      role: 'admin',
    },
  });
});

afterAll(async () => {
  if (dbAvailable) {
    await cleanAuthTables();
  }
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Full flow: register → login → access protected → logout → reuse token
// Requirements: 1.1, 1.6, 2.1, 2.4
// ─────────────────────────────────────────────────────────────────────────────

describe('Full auth flow (register → login → protected route → logout → token reuse)', () => {
  let userToken: string;

  beforeAll(() => {
    if (!dbAvailable) return;
  });

  it('POST /api/auth/register — creates a new user account (Req 2.1)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', IP.fullFlow)
      .send(TEST_USER);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      username: TEST_USER.username,
      email: TEST_USER.email,
      role: 'user',
    });
    // Password must never be returned
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.password).toBeUndefined();
  });

  it('POST /api/auth/login — authenticates Registered_User and returns 7-day JWT (Req 2.4)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.fullFlow)
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.expiresIn).toBe(7 * 24 * 60 * 60); // 7 days in seconds
    userToken = res.body.data.token;
  });

  it('POST /api/auth/logout — 401 without a token (verifies route IS protected)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('X-Forwarded-For', IP.fullFlow);

    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout — invalidates active JWT (Req 1.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${userToken}`)
      .set('X-Forwarded-For', IP.fullFlow);

    expect(res.status).toBe(204);
  });

  // Property 9: JWT blacklist prevents reuse after logout (Requirements 1.6)
  it('POST /api/auth/logout — reusing blacklisted token returns 401 (Req 1.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${userToken}`)
      .set('X-Forwarded-For', IP.fullFlow);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Admin login flow
// Requirements: 1.1, 7.1
// ─────────────────────────────────────────────────────────────────────────────

describe('Admin login', () => {
  it('POST /api/auth/login — authenticates admin and returns 24-hour JWT (Req 1.1)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.misc)
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Registration error cases
// Requirements: 2.2, 2.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Registration validation', () => {
  it('POST /api/auth/register — 409 when email is already taken (Req 2.2)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', IP.misc)
      .send({
        email: TEST_USER.email, // already registered in the full-flow suite
        username: 'differentuser',
        password: 'AnotherPass789!',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_FIELD');
    expect(res.body.error.fields).toHaveProperty('email');
  });

  it('POST /api/auth/register — 409 when username is already taken (Req 2.2)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', IP.misc)
      .send({
        email: 'unique-email@example.com',
        username: TEST_USER.username, // already taken
        password: 'AnotherPass789!',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_FIELD');
    expect(res.body.error.fields).toHaveProperty('username');
  });

  it('POST /api/auth/register — 400 when password is too short (Req 2.3)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', IP.misc)
      .send({
        email: 'short-pass@example.com',
        username: 'shortpassuser',
        password: 'short', // fewer than 8 characters
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/auth/register — 400 when required fields are missing', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', IP.misc)
      .send({ email: 'missing-fields@example.com' }); // username and password missing

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Login error cases
// Requirements: 1.3, 2.5
// ─────────────────────────────────────────────────────────────────────────────

describe('Login credential validation', () => {
  it('POST /api/auth/login — 401 with wrong password (Req 1.3, 2.5)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.misc)
      .send({ email: TEST_USER.email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    // Must not reveal which field is wrong (Req 1.3, 2.5)
    expect(res.body.error.fields).toBeUndefined();
  });

  it('POST /api/auth/login — 401 with non-existent email (Req 1.3, 2.5)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.misc)
      .send({ email: 'nobody@nowhere.com', password: 'SomePass123!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.fields).toBeUndefined();
  });

  it('POST /api/auth/login — can login using username instead of email (Req 2.4)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.misc)
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Rate limiting on /login and /register
// Requirements: 7.5, 7.6
// ─────────────────────────────────────────────────────────────────────────────

describe('Rate limiting — login endpoint (Req 7.5, 7.6)', () => {
  /**
   * Send 10 requests (the max allowed) then verify the 11th is rejected.
   * Each request uses the same IP so the rate-limit counter accumulates.
   * We use a unique IP reserved for this suite to avoid counter pollution.
   */
  it('returns 429 on the 11th request within 60 seconds from the same IP', async () => {
    if (!dbAvailable) return;

    const payload = { email: 'nobody@test.com', password: 'pass' };

    // Send 10 requests — each will get 401 (bad creds) but NOT 429 yet
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', IP.rateLimitLogin)
        .send(payload);
      // Should be 400 (validation) or 401 or 409 (lockout), but not 429
      expect(res.status).not.toBe(429);
    }

    // 11th request must be rate-limited
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.rateLimitLogin)
      .send(payload);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('Rate limiting — register endpoint (Req 7.5, 7.6)', () => {
  it('returns 429 on the 11th registration request within 60 seconds from the same IP', async () => {
    if (!dbAvailable) return;

    // Send 10 requests — most will fail with 400/409, but not 429
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/register')
        .set('X-Forwarded-For', IP.rateLimitRegister)
        .send({
          email: `ratelimit${i}@test.com`,
          username: `ratelimituser${i}`,
          password: 'ValidPass123!',
        });
      expect(res.status).not.toBe(429);
    }

    // 11th request must be rate-limited
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', IP.rateLimitRegister)
      .send({
        email: 'ratelimit10@test.com',
        username: 'ratelimituser10',
        password: 'ValidPass123!',
      });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Account lockout: 5× failed login → 409 → unlock after 15 min
// Requirements: 1.4
// ─────────────────────────────────────────────────────────────────────────────

describe('Account lockout (Req 1.4)', () => {
  // Use a dedicated user for lockout tests so we don't pollute other tests
  const LOCKOUT_USER = {
    username: 'lockoutuser',
    email: 'lockout@example.com',
    password: 'LockoutPass789!',
  };

  beforeAll(async () => {
    if (!dbAvailable) return;

    // Register the lockout test user
    const existing = await prisma.user.findUnique({
      where: { email: LOCKOUT_USER.email },
    });
    if (!existing) {
      const hash = await bcrypt.hash(LOCKOUT_USER.password, 12);
      await prisma.user.create({
        data: {
          username: LOCKOUT_USER.username,
          email: LOCKOUT_USER.email,
          passwordHash: hash,
          role: 'user',
        },
      });
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await prisma.loginAttempts.deleteMany({
      where: { username: LOCKOUT_USER.email },
    });
    await prisma.user.deleteMany({ where: { email: LOCKOUT_USER.email } });
  });

  beforeEach(async () => {
    if (!dbAvailable) return;
    // Clean up lockout-related state before each test in this block
    await prisma.loginAttempts.deleteMany({
      where: { username: LOCKOUT_USER.email },
    });
  });

  it('first 4 failed attempts return 401 (not yet locked)', async () => {
    if (!dbAvailable) return;

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', IP.lockout)
        .send({ email: LOCKOUT_USER.email, password: 'WrongPass!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('5th failed attempt locks the account and returns 409 ACCOUNT_LOCKED', async () => {
    if (!dbAvailable) return;

    // Seed 4 prior failed attempts directly in DB for determinism
    await prisma.loginAttempts.upsert({
      where: { username: LOCKOUT_USER.email },
      create: {
        username: LOCKOUT_USER.email,
        attemptCount: 4,
        lockedUntil: null,
        lastAttemptAt: new Date(),
      },
      update: {
        attemptCount: 4,
        lockedUntil: null,
        lastAttemptAt: new Date(),
      },
    });

    // The 5th failed attempt (via HTTP) should trigger the lockout
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.lockout)
      .send({ email: LOCKOUT_USER.email, password: 'WrongPass!' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('subsequent attempts while locked return 409 ACCOUNT_LOCKED', async () => {
    if (!dbAvailable) return;

    // Set up a locked account directly in DB
    await prisma.loginAttempts.upsert({
      where: { username: LOCKOUT_USER.email },
      create: {
        username: LOCKOUT_USER.email,
        attemptCount: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
        lastAttemptAt: new Date(),
      },
      update: {
        attemptCount: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
        lastAttemptAt: new Date(),
      },
    });

    // Even with correct password, the account is locked
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.lockout)
      .send({ email: LOCKOUT_USER.email, password: LOCKOUT_USER.password });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('login succeeds after the lockout period expires (Req 1.4)', async () => {
    if (!dbAvailable) return;

    // Simulate a lockout that has already expired (lockedUntil is in the past)
    await prisma.loginAttempts.upsert({
      where: { username: LOCKOUT_USER.email },
      create: {
        username: LOCKOUT_USER.email,
        attemptCount: 5,
        lockedUntil: new Date(Date.now() - 1000), // expired 1 second ago
        lastAttemptAt: new Date(Date.now() - 15 * 60 * 1000),
      },
      update: {
        attemptCount: 5,
        lockedUntil: new Date(Date.now() - 1000), // expired
        lastAttemptAt: new Date(Date.now() - 15 * 60 * 1000),
      },
    });

    // Should succeed because the lockout period has passed
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.lockout)
      .send({ email: LOCKOUT_USER.email, password: LOCKOUT_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.expiresIn).toBe(7 * 24 * 60 * 60);
  });

  it('failed attempts counter resets after a successful login', async () => {
    if (!dbAvailable) return;

    // Start with 4 failed attempts
    await prisma.loginAttempts.upsert({
      where: { username: LOCKOUT_USER.email },
      create: {
        username: LOCKOUT_USER.email,
        attemptCount: 4,
        lockedUntil: null,
        lastAttemptAt: new Date(),
      },
      update: {
        attemptCount: 4,
        lockedUntil: null,
        lastAttemptAt: new Date(),
      },
    });

    // Login successfully — this should reset the counter
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.lockout)
      .send({ email: LOCKOUT_USER.email, password: LOCKOUT_USER.password });

    expect(loginRes.status).toBe(200);

    // Verify the counter was reset in the DB
    const record = await prisma.loginAttempts.findUnique({
      where: { username: LOCKOUT_USER.email },
    });
    expect(record?.attemptCount).toBe(0);
    expect(record?.lockedUntil).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. JWT blacklist — blacklisted token rejected on all protected routes
// Requirements: 1.5, 1.6
// ─────────────────────────────────────────────────────────────────────────────

describe('JWT blacklist — blacklisted token rejected on protected routes (Req 1.5, 1.6)', () => {
  let token: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    // Login to get a fresh token
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', IP.misc)
      .send({ email: TEST_USER.email, password: TEST_USER.password });
    token = res.body.data?.token;
  });

  it('token is valid before logout', async () => {
    if (!dbAvailable) return;
    expect(token).toBeTruthy();
  });

  it('token is rejected after logout with 401', async () => {
    if (!dbAvailable) return;

    // Logout first
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', IP.misc);
    expect(logoutRes.status).toBe(204);

    // Reuse the blacklisted token → must get 401
    const reuseRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', IP.misc);
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe('UNAUTHORIZED');
  });
});
