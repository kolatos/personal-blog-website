/**
 * Integration tests untuk Subscription routes
 * Task 10 — Stage 1 Blog Improvements
 *
 * Skenario yang dicakup:
 *  1. POST /api/subscriptions → 201; panggil kedua → 409 ALREADY_SUBSCRIBED
 *  2. DELETE /api/subscriptions → 204; panggil kedua → 404 NOT_SUBSCRIBED
 *  3. GET /api/subscriptions/status → mengembalikan boolean yang benar sebelum dan sesudah subscribe
 *  4. Endpoint memerlukan auth — tanpa JWT → 401
 *
 * Requirements: 6.1, 6.2, 6.3
 * Property 4: Subscription Uniqueness
 *
 * Setup:
 *  - Memerlukan PostgreSQL yang berjalan dan dapat diakses.
 *  - Set DATABASE_URL di .env.test yang mengarah ke database test.
 *  - Jalankan `npx prisma migrate deploy` sebelum menjalankan test ini.
 *  - Test otomatis dilewati jika database tidak dapat dijangkau.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../../app';
import prisma from '../../lib/prisma';
import type { JwtPayload } from '../../types/index';

// ─── Connectivity guard ───────────────────────────────────────────────────────

async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ─── JWT helper ───────────────────────────────────────────────────────────────

function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresIn: string | number): string {
  const secret = process.env['JWT_SECRET'] ?? 'test-jwt-secret-key';
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

// ─── Cleanup helpers ──────────────────────────────────────────────────────────

async function cleanSubscriptionTables(): Promise<void> {
  await prisma.subscription.deleteMany({});
}

async function cleanAllTables(): Promise<void> {
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.loginAttempts.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.user.deleteMany({});
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEST_USER_EMAIL = 'subtest-user@example.com';
const TEST_USER_USERNAME = 'subtest-user';
const TEST_USER_PASSWORD = 'UserSubTest456!';

const TEST_USER2_EMAIL = 'subtest-user2@example.com';
const TEST_USER2_USERNAME = 'subtest-user2';

// ─── Global setup / teardown ──────────────────────────────────────────────────

let dbAvailable = false;
let userToken: string;
let user2Token: string;
let userId: string;
let user2Id: string;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    console.warn(
      '\n⚠  Integration tests dilewati: PostgreSQL tidak dapat dijangkau pada DATABASE_URL yang dikonfigurasi.\n' +
        '   Jalankan instance PostgreSQL dan pastikan DATABASE_URL sudah diatur dengan benar.\n'
    );
    return;
  }

  await cleanAllTables();

  // Buat user pertama
  const userHash = await bcrypt.hash(TEST_USER_PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      username: TEST_USER_USERNAME,
      email: TEST_USER_EMAIL,
      passwordHash: userHash,
      role: 'user',
    },
  });
  userId = user.id;

  // Buat user kedua
  const user2 = await prisma.user.create({
    data: {
      username: TEST_USER2_USERNAME,
      email: TEST_USER2_EMAIL,
      passwordHash: userHash,
      role: 'user',
    },
  });
  user2Id = user2.id;

  const { v4: uuidv4 } = await import('uuid');

  userToken = signToken(
    { sub: userId, username: TEST_USER_USERNAME, role: 'user', jti: uuidv4() },
    '7d'
  );

  user2Token = signToken(
    { sub: user2Id, username: TEST_USER2_USERNAME, role: 'user', jti: uuidv4() },
    '7d'
  );
});

afterAll(async () => {
  if (dbAvailable) {
    await cleanAllTables();
  }
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /api/subscriptions
// Requirements: 6.1
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/subscriptions', () => {
  beforeAll(async () => {
    if (dbAvailable) await cleanSubscriptionTables();
  });

  it('mengembalikan 201 dan { subscribed: true } saat berlangganan pertama kali', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ subscribed: true });
  });

  it('mengembalikan 409 ALREADY_SUBSCRIBED pada panggilan kedua', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_SUBSCRIBED');
  });

  it('mengembalikan 401 tanpa JWT', async () => {
    if (!dbAvailable) return;

    const res = await request(app).post('/api/subscriptions');

    expect(res.status).toBe(401);
  });

  it('memverifikasi hanya satu Subscription record dibuat (Property 4: Subscription Uniqueness)', async () => {
    if (!dbAvailable) return;

    const count = await prisma.subscription.count({ where: { userId } });
    expect(count).toBe(1);
  });

  it('user berbeda dapat berlangganan secara independen', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ subscribed: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DELETE /api/subscriptions
// Requirements: 6.2
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/subscriptions', () => {
  beforeAll(async () => {
    if (!dbAvailable) return;
    // Pastikan user sudah berlangganan
    await cleanSubscriptionTables();
    await prisma.subscription.create({ data: { userId } });
  });

  it('mengembalikan 204 saat berhenti berlangganan', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete('/api/subscriptions')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('mengembalikan 404 NOT_SUBSCRIBED pada panggilan kedua', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete('/api/subscriptions')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_SUBSCRIBED');
  });

  it('mengembalikan 401 tanpa JWT', async () => {
    if (!dbAvailable) return;

    const res = await request(app).delete('/api/subscriptions');

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/subscriptions/status
// Requirements: 6.3
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/subscriptions/status', () => {
  beforeAll(async () => {
    if (!dbAvailable) return;
    // Pastikan user TIDAK berlangganan di awal
    await cleanSubscriptionTables();
  });

  it('mengembalikan { subscribed: false } sebelum berlangganan', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/subscriptions/status')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscribed: false });
  });

  it('mengembalikan { subscribed: true } setelah berlangganan', async () => {
    if (!dbAvailable) return;

    // Subscribe dulu
    await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${userToken}`);

    const res = await request(app)
      .get('/api/subscriptions/status')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscribed: true });
  });

  it('mengembalikan { subscribed: false } setelah berhenti berlangganan', async () => {
    if (!dbAvailable) return;

    // Unsubscribe dulu
    await request(app)
      .delete('/api/subscriptions')
      .set('Authorization', `Bearer ${userToken}`);

    const res = await request(app)
      .get('/api/subscriptions/status')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscribed: false });
  });

  it('mengembalikan 401 tanpa JWT', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/subscriptions/status');

    expect(res.status).toBe(401);
  });
});
