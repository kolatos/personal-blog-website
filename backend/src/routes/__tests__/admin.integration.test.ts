/**
 * Integration tests untuk Admin routes
 * Task 11 — Stage 1 Blog Improvements
 *
 * Skenario yang dicakup:
 *  1. GET /api/admin/stats — mengembalikan shape yang benar
 *  2. GET /api/admin/users — mengembalikan daftar dipaginasi dengan commentCount
 *  3. DELETE /api/admin/users/:id — menghapus user dan cascade comments
 *  4. GET /api/admin/comments — mengembalikan semua komentar di semua content type
 *
 * Requirements: 7.1, 7.3, 7.4, 7.6
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
  beforeEach,
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

async function cleanAllTables(): Promise<void> {
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.loginAttempts.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.postTag.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.user.deleteMany({});
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEST_ADMIN_EMAIL = 'admintest-admin@example.com';
const TEST_ADMIN_USERNAME = 'admintest-admin';
const TEST_USER_EMAIL = 'admintest-user@example.com';
const TEST_USER_USERNAME = 'admintest-user';
const TEST_USER2_EMAIL = 'admintest-user2@example.com';
const TEST_USER2_USERNAME = 'admintest-user2';

// ─── Global state ─────────────────────────────────────────────────────────────

let dbAvailable = false;
let adminToken: string;
let userToken: string;
let adminId: string;
let userId: string;
let user2Id: string;
let postId: string;

// ─── Global setup ─────────────────────────────────────────────────────────────

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

  const hash = await bcrypt.hash('TestPassword123!', 12);
  const { v4: uuidv4 } = await import('uuid');

  // Buat admin
  const admin = await prisma.user.create({
    data: {
      username: TEST_ADMIN_USERNAME,
      email: TEST_ADMIN_EMAIL,
      passwordHash: hash,
      role: 'admin',
    },
  });
  adminId = admin.id;

  // Buat user pertama
  const user = await prisma.user.create({
    data: {
      username: TEST_USER_USERNAME,
      email: TEST_USER_EMAIL,
      passwordHash: hash,
      role: 'user',
    },
  });
  userId = user.id;

  // Buat user kedua (akan dihapus di test DELETE)
  const user2 = await prisma.user.create({
    data: {
      username: TEST_USER2_USERNAME,
      email: TEST_USER2_EMAIL,
      passwordHash: hash,
      role: 'user',
    },
  });
  user2Id = user2.id;

  adminToken = signToken(
    { sub: adminId, username: TEST_ADMIN_USERNAME, role: 'admin', jti: uuidv4() },
    '24h'
  );

  userToken = signToken(
    { sub: userId, username: TEST_USER_USERNAME, role: 'user', jti: uuidv4() },
    '7d'
  );

  // Buat post untuk test
  const post = await prisma.post.create({
    data: {
      title: 'Test Post Admin',
      slug: 'test-post-admin',
      content: '# Test',
      status: 'published',
      publishedAt: new Date(),
    },
  });
  postId = post.id;

  // Buat komentar dari user di post tersebut
  await prisma.comment.create({
    data: {
      contentType: 'post',
      contentId: postId,
      authorId: userId,
      content: 'Komentar pertama dari user 1',
    },
  });

  // Buat komentar dari user2 di post tersebut
  await prisma.comment.create({
    data: {
      contentType: 'post',
      contentId: postId,
      authorId: user2Id,
      content: 'Komentar dari user 2 yang akan dihapus',
    },
  });
});

afterAll(async () => {
  if (dbAvailable) {
    await cleanAllTables();
  }
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/admin/stats
// Requirements: 7.1
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  it('mengembalikan shape yang benar dengan semua field yang diperlukan', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Verifikasi top-level keys
    expect(res.body).toHaveProperty('totalPosts');
    expect(res.body).toHaveProperty('totalComments');
    expect(res.body).toHaveProperty('totalUsers');
    expect(res.body).toHaveProperty('totalProjects');
    expect(res.body).toHaveProperty('totalFunPosts');
    expect(res.body).toHaveProperty('recentPosts');
    expect(res.body).toHaveProperty('recentComments');
    expect(res.body).toHaveProperty('recentUsers');

    // Verifikasi tipe
    expect(typeof res.body.totalPosts).toBe('number');
    expect(typeof res.body.totalComments).toBe('number');
    expect(typeof res.body.totalUsers).toBe('number');
    expect(typeof res.body.totalProjects).toBe('number');
    expect(typeof res.body.totalFunPosts).toBe('number');
    expect(Array.isArray(res.body.recentPosts)).toBe(true);
    expect(Array.isArray(res.body.recentComments)).toBe(true);
    expect(Array.isArray(res.body.recentUsers)).toBe(true);
  });

  it('mengembalikan totalProjects dan totalFunPosts sebagai angka non-negatif', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalProjects).toBeGreaterThanOrEqual(0);
    expect(res.body.totalFunPosts).toBeGreaterThanOrEqual(0);
  });

  it('mengembalikan nilai aggregate yang benar', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Setidaknya data yang kita buat di beforeAll harus terhitung
    expect(res.body.totalPosts).toBeGreaterThanOrEqual(1);
    expect(res.body.totalComments).toBeGreaterThanOrEqual(2);
    // 3 users: admin + user + user2
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(3);
  });

  it('recentPosts berisi field yang benar', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    if (res.body.recentPosts.length > 0) {
      const post = res.body.recentPosts[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('slug');
      expect(post).toHaveProperty('status');
      expect(post).toHaveProperty('updatedAt');
    }
  });

  it('recentComments berisi field yang benar termasuk authorUsername dan contentTitle', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    if (res.body.recentComments.length > 0) {
      const comment = res.body.recentComments[0];
      expect(comment).toHaveProperty('id');
      expect(comment).toHaveProperty('content');
      expect(comment).toHaveProperty('authorUsername');
      expect(comment).toHaveProperty('contentType');
      expect(comment).toHaveProperty('contentId');
      expect(comment).toHaveProperty('contentTitle');
      expect(comment).toHaveProperty('createdAt');
      // contentTitle harus terisi untuk komentar di post
      expect(comment.contentTitle).toBe('Test Post Admin');
    }
  });

  it('recentUsers berisi field yang benar', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    if (res.body.recentUsers.length > 0) {
      const user = res.body.recentUsers[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('createdAt');
    }
  });

  it('mengembalikan 403 jika user bukan admin', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('mengembalikan 401 tanpa JWT', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/admin/stats');

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/admin/users
// Requirements: 7.3
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('mengembalikan daftar dipaginasi dengan commentCount', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Verifikasi struktur paginasi
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('pageSize');
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('setiap user mengandung commentCount', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    for (const u of res.body.data) {
      expect(u).toHaveProperty('id');
      expect(u).toHaveProperty('username');
      expect(u).toHaveProperty('email');
      expect(u).toHaveProperty('role');
      expect(u).toHaveProperty('createdAt');
      expect(u).toHaveProperty('commentCount');
      expect(typeof u.commentCount).toBe('number');
    }
  });

  it('commentCount mencerminkan jumlah komentar yang benar', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // user1 membuat 1 komentar
    const user1Data = res.body.data.find((u: { id: string }) => u.id === userId);
    expect(user1Data).toBeDefined();
    expect(user1Data.commentCount).toBeGreaterThanOrEqual(1);
  });

  it('mendukung paginasi melalui query param page', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/users?page=1&pageSize=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
    // 3 users total, pageSize 2 → totalPages harus 2
    expect(res.body.totalPages).toBeGreaterThanOrEqual(2);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it('mengembalikan 403 jika user bukan admin', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DELETE /api/admin/users/:id
// Requirements: 7.4
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/admin/users/:id', () => {
  it('menghapus user dan cascade comments — mengembalikan 204', async () => {
    if (!dbAvailable) return;

    // Pastikan user2 dan komentarnya ada sebelum dihapus
    const commentsBefore = await prisma.comment.count({ where: { authorId: user2Id } });
    expect(commentsBefore).toBeGreaterThanOrEqual(1);

    const res = await request(app)
      .delete(`/api/admin/users/${user2Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // User harus sudah dihapus
    const deletedUser = await prisma.user.findUnique({ where: { id: user2Id } });
    expect(deletedUser).toBeNull();

    // Komentarnya juga ikut terhapus (cascade)
    const commentsAfter = await prisma.comment.count({ where: { authorId: user2Id } });
    expect(commentsAfter).toBe(0);
  });

  it('mengembalikan 404 jika user tidak ditemukan', async () => {
    if (!dbAvailable) return;

    const { v4: uuidv4 } = await import('uuid');
    const nonExistentId = uuidv4();

    const res = await request(app)
      .delete(`/api/admin/users/${nonExistentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('tidak dapat menghapus diri sendiri (admin)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_DELETE_SELF');
  });

  it('mengembalikan 403 jika user bukan admin', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('mengembalikan 401 tanpa JWT', async () => {
    if (!dbAvailable) return;

    const res = await request(app).delete(`/api/admin/users/${userId}`);

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/admin/comments
// Requirements: 7.6
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/comments', () => {
  it('mengembalikan semua komentar dipaginasi', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/comments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('pageSize');
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('setiap komentar mengandung field yang benar termasuk authorUsername dan contentTitle', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/comments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    for (const c of res.body.data) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('content');
      expect(c).toHaveProperty('authorUsername');
      expect(c).toHaveProperty('contentType');
      expect(c).toHaveProperty('contentId');
      expect(c).toHaveProperty('contentTitle');
      expect(c).toHaveProperty('parentId');
      expect(c).toHaveProperty('createdAt');
    }
  });

  it('mendukung filter opsional ?contentType=post', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/comments?contentType=post')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Semua komentar yang dikembalikan harus memiliki contentType = 'post'
    for (const c of res.body.data) {
      expect(c.contentType).toBe('post');
    }
  });

  it('mengembalikan array kosong jika tidak ada komentar untuk contentType yang difilter', async () => {
    if (!dbAvailable) return;

    // 'module' belum ada di Stage 1
    const res = await request(app)
      .get('/api/admin/comments?contentType=module')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('mendukung paginasi', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/comments?page=1&pageSize=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('mengembalikan 403 jika user bukan admin', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/comments')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('mengembalikan 401 tanpa JWT', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/admin/comments');

    expect(res.status).toBe(401);
  });
});
