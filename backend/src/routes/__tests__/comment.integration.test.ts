/**
 * Integration tests untuk Comment routes
 * Task 6.6 — Personal Blog Website
 *
 * Skenario yang dicakup:
 *  1. Tambah komentar: Registered_User pada Published post → 201
 *  2. Tambah komentar: visitor tanpa token → 401
 *  3. Tambah komentar: pada Draft post → 404
 *  4. Hapus komentar: owner hapus miliknya → 204
 *  5. Hapus komentar: user lain (bukan owner, bukan admin) → 403
 *  6. Hapus komentar: admin hapus milik siapapun → 204
 *  7. List komentar: GET pada published post → 200, urutan created_at ASC
 *  8. Validasi konten: konten kosong → 400, konten > 2000 karakter → 400
 *
 * Requirements: 6.1–6.7
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

// ─── Test database helpers ────────────────────────────────────────────────────

async function cleanCommentTables(): Promise<void> {
  await prisma.comment.deleteMany({});
  await prisma.post.deleteMany({});
}

async function cleanAllTables(): Promise<void> {
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.loginAttempts.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.user.deleteMany({});
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEST_ADMIN_EMAIL = 'commenttest-admin@example.com';
const TEST_ADMIN_USERNAME = 'commenttest-admin';
const TEST_ADMIN_PASSWORD = 'AdminCommentTest123!';

const TEST_USER_EMAIL = 'commenttest-user@example.com';
const TEST_USER_USERNAME = 'commenttest-user';

const TEST_USER2_EMAIL = 'commenttest-user2@example.com';
const TEST_USER2_USERNAME = 'commenttest-user2';

// ─── Global setup / teardown ──────────────────────────────────────────────────

let dbAvailable = false;
let adminToken: string;
let userToken: string;
let user2Token: string;
let adminUserId: string;
let regularUserId: string;
let regularUser2Id: string;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    console.warn(
      '\n⚠  Integration tests dilewati: PostgreSQL tidak dapat dijangkau pada DATABASE_URL yang dikonfigurasi.\n' +
        '   Jalankan instance PostgreSQL dan pastikan DATABASE_URL sudah diatur dengan benar.\n'
    );
    return;
  }

  // Aktifkan trust proxy agar X-Forwarded-For digunakan sebagai req.ip
  // Gunakan nilai numerik (1) bukan boolean true untuk menghindari
  // ERR_ERL_PERMISSIVE_TRUST_PROXY dari express-rate-limit.
  app.set('trust proxy', 1);

  // Bersihkan state dari run test sebelumnya
  await cleanAllTables();

  const { v4: uuidv4 } = await import('uuid');

  // Buat admin user langsung ke DB
  const adminHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 12);
  const adminUser = await prisma.user.create({
    data: {
      username: TEST_ADMIN_USERNAME,
      email: TEST_ADMIN_EMAIL,
      passwordHash: adminHash,
      role: 'admin',
    },
  });
  adminUserId = adminUser.id;

  // Buat regular user 1 langsung ke DB
  const userHash = await bcrypt.hash('UserCommentTest456!', 12);
  const regularUser = await prisma.user.create({
    data: {
      username: TEST_USER_USERNAME,
      email: TEST_USER_EMAIL,
      passwordHash: userHash,
      role: 'user',
    },
  });
  regularUserId = regularUser.id;

  // Buat regular user 2 (bukan owner komentar, bukan admin)
  const user2Hash = await bcrypt.hash('UserCommentTest789!', 12);
  const regularUser2 = await prisma.user.create({
    data: {
      username: TEST_USER2_USERNAME,
      email: TEST_USER2_EMAIL,
      passwordHash: user2Hash,
      role: 'user',
    },
  });
  regularUser2Id = regularUser2.id;

  // Buat JWT untuk setiap user
  adminToken = signToken(
    { sub: adminUserId, username: TEST_ADMIN_USERNAME, role: 'admin', jti: uuidv4() },
    '24h'
  );
  userToken = signToken(
    { sub: regularUserId, username: TEST_USER_USERNAME, role: 'user', jti: uuidv4() },
    '7d'
  );
  user2Token = signToken(
    { sub: regularUser2Id, username: TEST_USER2_USERNAME, role: 'user', jti: uuidv4() },
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
// 1. Tambah komentar — Registered_User pada Published post
// Requirements: 6.1, 6.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Tambah komentar: Registered_User pada Published post (Req 6.1, 6.3)', () => {
  let publishedPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    // Buat published post langsung ke DB
    const post = await prisma.post.create({
      data: {
        title: 'Post Published untuk Komentar',
        slug: 'post-published-untuk-komentar',
        content: 'Konten post yang sudah dipublish.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedPostId = post.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('POST /api/posts/:postId/comments — Registered_User berhasil menambah komentar → 201 (Req 6.1)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Komentar pertama saya pada post ini.' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      postId: publishedPostId,
      authorId: regularUserId,
      content: 'Komentar pertama saya pada post ini.',
    });
    expect(res.body.data.id).toBeTruthy();
    expect(typeof res.body.data.createdAt).toBe('string');
  });

  it('POST /api/posts/:postId/comments — response menyertakan authorUsername (Req 6.1)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Komentar dengan username.' });

    expect(res.status).toBe(201);
    // authorUsername dikembalikan sesuai requirement
    expect(res.body.data.authorUsername).toBe(TEST_USER_USERNAME);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Tambah komentar — visitor tanpa token
// Requirements: 6.2
// ─────────────────────────────────────────────────────────────────────────────

describe('Tambah komentar: visitor tanpa token → 401 (Req 6.2)', () => {
  let publishedPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Visitor',
        slug: 'post-untuk-test-visitor',
        content: 'Konten post.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedPostId = post.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('POST /api/posts/:postId/comments — tanpa token mendapat 401 (Req 6.2)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .send({ content: 'Komentar tanpa autentikasi.' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/posts/:postId/comments — dengan token tidak valid mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', 'Bearer token-tidak-valid')
      .send({ content: 'Komentar dengan token salah.' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Tambah komentar — pada Draft post
// Requirements: 6.3 (post harus published)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tambah komentar: pada Draft post → 404 (Req 6.3)', () => {
  let draftPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    // Buat draft post (tidak dipublish)
    const post = await prisma.post.create({
      data: {
        title: 'Post Draft Tidak Bisa Dikomentari',
        slug: 'post-draft-tidak-bisa-dikomentari',
        content: 'Konten draft.',
        status: 'draft',
      },
    });
    draftPostId = post.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('POST /api/posts/:postId/comments — komentar pada Draft post mendapat 404 (Req 6.3)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${draftPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Mencoba komentar pada draft post.' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/posts/:postId/comments — komentar pada post yang tidak ada mendapat 404', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/posts/00000000-0000-0000-0000-000000000000/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Komentar pada post yang tidak ada.' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Hapus komentar — owner, user lain, admin
// Requirements: 6.4, 6.5, 6.6
// ─────────────────────────────────────────────────────────────────────────────

describe('Hapus komentar: owner, user lain, admin (Req 6.4, 6.5, 6.6)', () => {
  let publishedPostId: string;
  let commentByUser1Id: string;
  let commentByUser2Id: string;
  let commentForAdminId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    // Buat published post
    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Hapus Komentar',
        slug: 'post-untuk-test-hapus-komentar',
        content: 'Konten post hapus komentar.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedPostId = post.id;

    // Buat komentar dari user1 (untuk diuji owner delete dan unauthorized delete)
    const commentByUser1 = await prisma.comment.create({
      data: {
        postId: publishedPostId,
        authorId: regularUserId,
        content: 'Komentar milik user 1.',
      },
    });
    commentByUser1Id = commentByUser1.id;

    // Buat komentar dari user2 (untuk diuji admin delete)
    const commentByUser2 = await prisma.comment.create({
      data: {
        postId: publishedPostId,
        authorId: regularUser2Id,
        content: 'Komentar milik user 2.',
      },
    });
    commentByUser2Id = commentByUser2.id;

    // Buat komentar tambahan untuk admin delete test
    const commentForAdmin = await prisma.comment.create({
      data: {
        postId: publishedPostId,
        authorId: regularUserId,
        content: 'Komentar untuk dihapus admin.',
      },
    });
    commentForAdminId = commentForAdmin.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('DELETE /:commentId — user lain (bukan owner, bukan admin) mendapat 403 (Req 6.5)', async () => {
    if (!dbAvailable) return;

    // user2 mencoba hapus komentar milik user1
    const res = await request(app)
      .delete(`/api/posts/${publishedPostId}/comments/${commentByUser1Id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('DELETE /:commentId — owner berhasil hapus komentar miliknya → 204 (Req 6.4)', async () => {
    if (!dbAvailable) return;

    // user2 hapus komentar miliknya sendiri
    const res = await request(app)
      .delete(`/api/posts/${publishedPostId}/comments/${commentByUser2Id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    // Verifikasi komentar benar-benar terhapus di DB
    const deleted = await prisma.comment.findUnique({ where: { id: commentByUser2Id } });
    expect(deleted).toBeNull();
  });

  it('DELETE /:commentId — admin berhasil hapus komentar milik siapapun → 204 (Req 6.6)', async () => {
    if (!dbAvailable) return;

    // Admin hapus komentar milik user1
    const res = await request(app)
      .delete(`/api/posts/${publishedPostId}/comments/${commentForAdminId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    // Verifikasi komentar benar-benar terhapus di DB
    const deleted = await prisma.comment.findUnique({ where: { id: commentForAdminId } });
    expect(deleted).toBeNull();
  });

  it('DELETE /:commentId — hapus komentar yang tidak ada mendapat 404', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/posts/${publishedPostId}/comments/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE /:commentId — tanpa token mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/posts/${publishedPostId}/comments/${commentByUser1Id}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. List komentar — GET, urutan created_at ASC
// Requirements: 6.1, 6.2
// ─────────────────────────────────────────────────────────────────────────────

describe('List komentar: GET pada published post, diurutkan created_at ASC (Req 6.1, 6.2)', () => {
  let publishedPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    // Buat published post
    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test List Komentar',
        slug: 'post-untuk-test-list-komentar',
        content: 'Konten post list komentar.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedPostId = post.id;

    // Tambahkan komentar dengan delay kecil agar urutan created_at berbeda
    await prisma.comment.create({
      data: {
        postId: publishedPostId,
        authorId: regularUserId,
        content: 'Komentar pertama (paling lama).',
        createdAt: new Date(Date.now() - 2000),
      },
    });
    await prisma.comment.create({
      data: {
        postId: publishedPostId,
        authorId: regularUser2Id,
        content: 'Komentar kedua (tengah).',
        createdAt: new Date(Date.now() - 1000),
      },
    });
    await prisma.comment.create({
      data: {
        postId: publishedPostId,
        authorId: adminUserId,
        content: 'Komentar ketiga (paling baru).',
        createdAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('GET /api/posts/:postId/comments — visitor berhasil mengambil daftar komentar → 200 (Req 6.1)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get(`/api/posts/${publishedPostId}/comments`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(3);
  });

  it('GET /api/posts/:postId/comments — komentar diurutkan berdasarkan created_at ASC (Req 6.2)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get(`/api/posts/${publishedPostId}/comments`);

    expect(res.status).toBe(200);
    const comments = res.body.data;
    expect(comments.length).toBeGreaterThanOrEqual(2);

    // Verifikasi urutan ASC: setiap komentar tidak lebih lama dari berikutnya
    for (let i = 0; i < comments.length - 1; i++) {
      const current = new Date(comments[i].createdAt).getTime();
      const next = new Date(comments[i + 1].createdAt).getTime();
      expect(current).toBeLessThanOrEqual(next);
    }

    // Verifikasi konten urutan yang benar
    expect(comments[0].content).toBe('Komentar pertama (paling lama).');
    expect(comments[1].content).toBe('Komentar kedua (tengah).');
    expect(comments[2].content).toBe('Komentar ketiga (paling baru).');
  });

  it('GET /api/posts/:postId/comments — setiap komentar menyertakan authorUsername (Req 6.1)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get(`/api/posts/${publishedPostId}/comments`);

    expect(res.status).toBe(200);
    const comments = res.body.data;

    for (const comment of comments) {
      expect(comment).toHaveProperty('id');
      expect(comment).toHaveProperty('postId');
      expect(comment).toHaveProperty('authorId');
      expect(comment).toHaveProperty('authorUsername');
      expect(comment).toHaveProperty('content');
      expect(comment).toHaveProperty('createdAt');
      expect(typeof comment.authorUsername).toBe('string');
      expect(comment.authorUsername.length).toBeGreaterThan(0);
    }
  });

  it('GET /api/posts/:postId/comments — post tanpa komentar mengembalikan array kosong', async () => {
    if (!dbAvailable) return;

    // Buat post baru tanpa komentar
    const emptyPost = await prisma.post.create({
      data: {
        title: 'Post Kosong Tanpa Komentar',
        slug: 'post-kosong-tanpa-komentar',
        content: 'Tidak ada komentar di sini.',
        status: 'published',
        publishedAt: new Date(),
      },
    });

    const res = await request(app)
      .get(`/api/posts/${emptyPost.id}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);

    // Cleanup
    await prisma.post.delete({ where: { id: emptyPost.id } }).catch(() => {});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Validasi konten komentar
// Requirements: 6.7
// ─────────────────────────────────────────────────────────────────────────────

describe('Validasi konten komentar (Req 6.7)', () => {
  let publishedPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Validasi Komentar',
        slug: 'post-untuk-test-validasi-komentar',
        content: 'Konten post.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedPostId = post.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('POST — konten kosong (string kosong) mendapat 400 (Req 6.7)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
  });

  it('POST — konten hanya spasi mendapat 400 (Req 6.7)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: '   ' });

    expect(res.status).toBe(400);
  });

  it('POST — konten melebihi 2000 karakter mendapat 400 (Req 6.7)', async () => {
    if (!dbAvailable) return;

    const longContent = 'a'.repeat(2001);

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: longContent });

    expect(res.status).toBe(400);
  });

  it('POST — konten tepat 2000 karakter berhasil → 201 (batas atas valid)', async () => {
    if (!dbAvailable) return;

    const maxContent = 'a'.repeat(2000);

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: maxContent });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe(maxContent);
  });

  it('POST — tanpa field content mendapat 400 (Req 6.7)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
