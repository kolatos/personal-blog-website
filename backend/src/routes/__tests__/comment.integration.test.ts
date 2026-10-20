/**
 * Integration tests untuk Comment routes — sistem komentar generik dengan balasan
 * Task 6 — Personal Blog Website
 *
 * Skenario yang dicakup:
 *  1. POST komentar via endpoint generik (contentType='post') → 201; GET mengembalikannya
 *  2. POST reply ke komentar level atas → 201; GET mengembalikan reply di bawah parent
 *  3. POST reply ke reply → 400 REPLY_DEPTH_EXCEEDED
 *  4. DELETE komentar parent → replies terhapus cascade
 *  5. Admin dapat DELETE komentar siapapun; user hanya dapat DELETE komentar sendiri
 *  6. Backward-compat: POST /api/posts/:postId/comments masih berfungsi → 201
 *  7. Visitor tanpa token → 401
 *  8. Draft post via alias endpoint → 404
 *  9. Validasi konten (kosong, whitespace, terlalu panjang) → 400
 *  10. Admin JWT via legacy endpoint → 201
 *
 * Requirements: 4.1–4.4, 6.1–6.7
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

  app.set('trust proxy', 1);

  await cleanAllTables();

  const { v4: uuidv4 } = await import('uuid');

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
// 1. POST komentar via endpoint generik → 201; GET mengembalikannya bersarang
// Requirements: 6.1, 6.3
// ─────────────────────────────────────────────────────────────────────────────

describe('POST komentar generik (contentType=post) → 201; GET mengembalikannya (Req 6.1, 6.3)', () => {
  let publishedPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Komentar Generik',
        slug: 'post-untuk-test-komentar-generik',
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

  it('POST /api/comments — berhasil menambah komentar dengan contentType=post → 201', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        contentType: 'post',
        contentId: publishedPostId,
        content: 'Komentar pertama via endpoint generik.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      contentType: 'post',
      contentId: publishedPostId,
      authorId: regularUserId,
      content: 'Komentar pertama via endpoint generik.',
      parentId: null,
    });
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.authorUsername).toBe(TEST_USER_USERNAME);
    expect(Array.isArray(res.body.data.replies)).toBe(true);
  });

  it('GET /api/comments?contentType=post&contentId= — mengembalikan komentar bersarang', async () => {
    if (!dbAvailable) return;

    // Tambah komentar dulu
    await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        contentType: 'post',
        contentId: publishedPostId,
        content: 'Komentar untuk diambil via GET generik.',
      });

    const res = await request(app)
      .get(`/api/comments?contentType=post&contentId=${publishedPostId}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const comment = res.body.data[0];
    expect(comment).toHaveProperty('id');
    expect(comment).toHaveProperty('contentType', 'post');
    expect(comment).toHaveProperty('contentId', publishedPostId);
    expect(comment).toHaveProperty('authorId');
    expect(comment).toHaveProperty('authorUsername');
    expect(comment).toHaveProperty('content');
    expect(comment).toHaveProperty('parentId');
    expect(comment).toHaveProperty('createdAt');
    expect(Array.isArray(comment.replies)).toBe(true);
  });

  it('GET /api/comments — tanpa query params mendapat 400', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/comments');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST reply ke komentar level atas → 201; GET mengembalikan reply di bawah parent
// Requirements: 6.1, 6.2
// ─────────────────────────────────────────────────────────────────────────────

describe('POST reply ke komentar level atas → 201; GET mengembalikan reply bersarang (Req 6.1, 6.2)', () => {
  let publishedPostId: string;
  let topLevelCommentId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Reply',
        slug: 'post-untuk-test-reply',
        content: 'Konten post.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedPostId = post.id;

    // Buat komentar level atas langsung ke DB
    const topLevelComment = await prisma.comment.create({
      data: {
        contentType: 'post',
        contentId: publishedPostId,
        authorId: regularUserId,
        content: 'Komentar level atas.',
        parentId: null,
      },
    });
    topLevelCommentId = topLevelComment.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('POST /api/comments dengan parentId → 201 (reply berhasil)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        contentType: 'post',
        contentId: publishedPostId,
        content: 'Balasan untuk komentar level atas.',
        parentId: topLevelCommentId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      contentType: 'post',
      contentId: publishedPostId,
      authorId: regularUser2Id,
      content: 'Balasan untuk komentar level atas.',
      parentId: topLevelCommentId,
    });
    expect(res.body.data.authorUsername).toBe(TEST_USER2_USERNAME);
  });

  it('GET /api/comments — reply muncul di dalam array replies milik parent', async () => {
    if (!dbAvailable) return;

    // Pastikan ada reply
    await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        contentType: 'post',
        contentId: publishedPostId,
        content: 'Balasan kedua.',
        parentId: topLevelCommentId,
      });

    const res = await request(app)
      .get(`/api/comments?contentType=post&contentId=${publishedPostId}`);

    expect(res.status).toBe(200);
    const comments = res.body.data as Array<{ id: string; replies: Array<{ parentId: string }> }>;

    // Hanya komentar level atas yang muncul di daftar utama
    const parent = comments.find((c) => c.id === topLevelCommentId);
    expect(parent).toBeDefined();
    expect(Array.isArray(parent!.replies)).toBe(true);
    expect(parent!.replies.length).toBeGreaterThan(0);

    // Semua replies memiliki parentId yang sesuai
    for (const reply of parent!.replies) {
      expect(reply.parentId).toBe(topLevelCommentId);
    }

    // Reply tidak muncul di level atas (periksa berdasarkan ID reply, bukan parentId)
    const replyItemIds = parent!.replies.map((r: { id: string }) => r.id);
    const topLevelIds = comments.map((c) => c.id);
    for (const rid of replyItemIds) {
      expect(topLevelIds).not.toContain(rid);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST reply ke reply → 400 REPLY_DEPTH_EXCEEDED
// Requirements: 6.1
// ─────────────────────────────────────────────────────────────────────────────

describe('POST reply ke reply → 400 REPLY_DEPTH_EXCEEDED', () => {
  let publishedPostId: string;
  let replyCommentId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Depth',
        slug: 'post-untuk-test-depth',
        content: 'Konten post.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedPostId = post.id;

    // Buat komentar level atas
    const topLevel = await prisma.comment.create({
      data: {
        contentType: 'post',
        contentId: publishedPostId,
        authorId: regularUserId,
        content: 'Komentar level atas.',
        parentId: null,
      },
    });

    // Buat reply (level 1)
    const reply = await prisma.comment.create({
      data: {
        contentType: 'post',
        contentId: publishedPostId,
        authorId: regularUser2Id,
        content: 'Reply level 1.',
        parentId: topLevel.id,
      },
    });
    replyCommentId = reply.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('POST /api/comments dengan parentId = reply → 400 REPLY_DEPTH_EXCEEDED', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        contentType: 'post',
        contentId: publishedPostId,
        content: 'Mencoba reply ke reply — harus ditolak.',
        parentId: replyCommentId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REPLY_DEPTH_EXCEEDED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. DELETE komentar parent → replies terhapus cascade
// Requirements: 6.4
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE komentar parent → replies terhapus cascade', () => {
  let publishedPostId: string;
  let parentCommentId: string;
  let replyId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Cascade Delete',
        slug: 'post-untuk-test-cascade-delete',
        content: 'Konten post.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedPostId = post.id;

    const parentComment = await prisma.comment.create({
      data: {
        contentType: 'post',
        contentId: publishedPostId,
        authorId: regularUserId,
        content: 'Parent comment yang akan dihapus.',
        parentId: null,
      },
    });
    parentCommentId = parentComment.id;

    const replyComment = await prisma.comment.create({
      data: {
        contentType: 'post',
        contentId: publishedPostId,
        authorId: regularUser2Id,
        content: 'Reply yang seharusnya ikut terhapus.',
        parentId: parentCommentId,
      },
    });
    replyId = replyComment.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('DELETE /api/comments/:id (parent) → 204; replies ikut terhapus cascade', async () => {
    if (!dbAvailable) return;

    // Verifikasi reply ada sebelum delete
    const replyBefore = await prisma.comment.findUnique({ where: { id: replyId } });
    expect(replyBefore).not.toBeNull();

    const res = await request(app)
      .delete(`/api/comments/${parentCommentId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(204);

    // Verifikasi parent terhapus
    const parentDeleted = await prisma.comment.findUnique({ where: { id: parentCommentId } });
    expect(parentDeleted).toBeNull();

    // Verifikasi reply ikut terhapus (cascade)
    const replyDeleted = await prisma.comment.findUnique({ where: { id: replyId } });
    expect(replyDeleted).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Admin DELETE komentar siapapun; user hanya DELETE miliknya
// Requirements: 6.4, 6.5, 6.6
// ─────────────────────────────────────────────────────────────────────────────

describe('Admin dapat DELETE komentar siapapun; user hanya DELETE miliknya (Req 6.4, 6.5, 6.6)', () => {
  let publishedPostId: string;
  let commentByUser1Id: string;
  let commentByUser2Id: string;
  let commentForAdminId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

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

    const commentByUser1 = await prisma.comment.create({
      data: {
        contentType: 'post',
        contentId: publishedPostId,
        authorId: regularUserId,
        content: 'Komentar milik user 1.',
      },
    });
    commentByUser1Id = commentByUser1.id;

    const commentByUser2 = await prisma.comment.create({
      data: {
        contentType: 'post',
        contentId: publishedPostId,
        authorId: regularUser2Id,
        content: 'Komentar milik user 2.',
      },
    });
    commentByUser2Id = commentByUser2.id;

    const commentForAdmin = await prisma.comment.create({
      data: {
        contentType: 'post',
        contentId: publishedPostId,
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

  it('DELETE /api/comments/:id — user lain (bukan owner, bukan admin) mendapat 403 (Req 6.5)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/comments/${commentByUser1Id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('DELETE /api/comments/:id — owner berhasil hapus komentar miliknya → 204 (Req 6.4)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/comments/${commentByUser2Id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const deleted = await prisma.comment.findUnique({ where: { id: commentByUser2Id } });
    expect(deleted).toBeNull();
  });

  it('DELETE /api/comments/:id — admin berhasil hapus komentar milik siapapun → 204 (Req 6.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/comments/${commentForAdminId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const deleted = await prisma.comment.findUnique({ where: { id: commentForAdminId } });
    expect(deleted).toBeNull();
  });

  it('DELETE /api/comments/:id — hapus komentar yang tidak ada mendapat 404', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete('/api/comments/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE /api/comments/:id — tanpa token mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/comments/${commentByUser1Id}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Backward-compat: POST /api/posts/:postId/comments masih berfungsi
// Requirements: 6.1, 6.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Backward-compat: POST /api/posts/:postId/comments masih berfungsi (Req 6.1, 6.3)', () => {
  let publishedPostId: string;
  let draftPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Legacy Endpoint',
        slug: 'post-untuk-test-legacy-endpoint',
        content: 'Konten post published.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedPostId = post.id;

    const draft = await prisma.post.create({
      data: {
        title: 'Post Draft untuk Legacy Test',
        slug: 'post-draft-untuk-legacy-test',
        content: 'Konten draft.',
        status: 'draft',
      },
    });
    draftPostId = draft.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();
  });

  it('POST /api/posts/:postId/comments — masih berfungsi sebagai alias → 201', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Komentar via legacy endpoint.' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      contentType: 'post',
      contentId: publishedPostId,
      authorId: regularUserId,
      content: 'Komentar via legacy endpoint.',
    });
    expect(res.body.data.authorUsername).toBe(TEST_USER_USERNAME);
  });

  it('POST /api/posts/:postId/comments — Admin JWT berhasil → 201 (Req 4.1)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${publishedPostId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Komentar admin via legacy endpoint.' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      contentType: 'post',
      contentId: publishedPostId,
      authorId: adminUserId,
    });
    expect(res.body.data.authorUsername).toBe(TEST_ADMIN_USERNAME);
  });

  it('POST /api/posts/:postId/comments — draft post → 404 (Req 6.3)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`/api/posts/${draftPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Komentar pada draft.' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/posts/:postId/comments — masih berfungsi → 200', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get(`/api/posts/${publishedPostId}/comments`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('DELETE /api/posts/:postId/comments/:commentId — masih berfungsi → 204', async () => {
    if (!dbAvailable) return;

    // Buat komentar untuk dihapus
    const comment = await prisma.comment.create({
      data: {
        contentType: 'post',
        contentId: publishedPostId,
        authorId: regularUserId,
        content: 'Komentar yang akan dihapus via legacy.',
      },
    });

    const res = await request(app)
      .delete(`/api/posts/${publishedPostId}/comments/${comment.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(204);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Visitor tanpa token → 401
// Requirements: 6.2
// ─────────────────────────────────────────────────────────────────────────────

describe('Visitor tanpa token → 401 (Req 6.2)', () => {
  let publishedPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Visitor',
        slug: 'post-untuk-test-visitor-unauth',
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

  it('POST /api/comments — tanpa token mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .send({
        contentType: 'post',
        contentId: publishedPostId,
        content: 'Komentar tanpa autentikasi.',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/comments — dengan token tidak valid mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', 'Bearer token-tidak-valid')
      .send({
        contentType: 'post',
        contentId: publishedPostId,
        content: 'Komentar dengan token salah.',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Validasi konten komentar
// Requirements: 6.7
// ─────────────────────────────────────────────────────────────────────────────

describe('Validasi konten komentar (Req 6.7)', () => {
  let publishedPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanCommentTables();

    const post = await prisma.post.create({
      data: {
        title: 'Post untuk Test Validasi',
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
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ contentType: 'post', contentId: publishedPostId, content: '' });

    expect(res.status).toBe(400);
  });

  it('POST — konten hanya spasi mendapat 400 (Req 6.7)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ contentType: 'post', contentId: publishedPostId, content: '   ' });

    expect(res.status).toBe(400);
  });

  it('POST — konten melebihi 2000 karakter mendapat 400 (Req 6.7)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        contentType: 'post',
        contentId: publishedPostId,
        content: 'a'.repeat(2001),
      });

    expect(res.status).toBe(400);
  });

  it('POST — konten tepat 2000 karakter berhasil → 201', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        contentType: 'post',
        contentId: publishedPostId,
        content: 'a'.repeat(2000),
      });

    expect(res.status).toBe(201);
  });

  it('POST — tanpa field content mendapat 400 (Req 6.7)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ contentType: 'post', contentId: publishedPostId });

    expect(res.status).toBe(400);
  });

  it('POST — tanpa contentType mendapat 400', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ contentId: publishedPostId, content: 'Komentar tanpa contentType.' });

    expect(res.status).toBe(400);
  });

  it('POST — tanpa contentId mendapat 400', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ contentType: 'post', content: 'Komentar tanpa contentId.' });

    expect(res.status).toBe(400);
  });

  it('POST — contentId bukan UUID mendapat 400', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ contentType: 'post', contentId: 'bukan-uuid', content: 'Komentar.' });

    expect(res.status).toBe(400);
  });
});
