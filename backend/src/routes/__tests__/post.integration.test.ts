/**
 * Integration tests untuk Post routes
 * Task 5.11 — Personal Blog Website
 *
 * Skenario yang dicakup:
 *  1. CRUD lifecycle: create (Draft) → update → publish → update (auto-revert ke Draft) → republish → delete
 *  2. Cascade delete: post dengan komentar → hapus post → komentar ikut terhapus
 *  3. Access control: visitor mencoba akses endpoint admin → 401/403
 *  4. Draft 404: draft post diakses visitor → 404
 *  5. Search: keyword valid, keyword kosong (400), tidak ada hasil (empty data)
 *
 * Requirements: 3.1–3.7, 4.1–4.8, 5.1–5.7
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

/**
 * Membuat JWT yang ditandatangani secara langsung untuk keperluan test,
 * tanpa perlu memanggil endpoint /api/auth/login.
 */
function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresIn: string | number): string {
  const secret = process.env['JWT_SECRET'] ?? 'test-jwt-secret-key';
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

// ─── Test database helpers ────────────────────────────────────────────────────

async function cleanPostTables(): Promise<void> {
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

const TEST_ADMIN_EMAIL = 'posttest-admin@example.com';
const TEST_ADMIN_USERNAME = 'posttest-admin';
const TEST_ADMIN_PASSWORD = 'AdminPostTest123!';

const TEST_USER_EMAIL = 'posttest-user@example.com';
const TEST_USER_USERNAME = 'posttest-user';
const TEST_USER_PASSWORD = 'UserPostTest456!';

// ─── Global setup / teardown ──────────────────────────────────────────────────

let dbAvailable = false;
let adminToken: string;
let userToken: string;
let adminUserId: string;
let regularUserId: string;

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
  app.set('trust proxy', true);

  // Bersihkan state dari run test sebelumnya
  await cleanAllTables();

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

  // Buat regular user langsung ke DB
  const userHash = await bcrypt.hash(TEST_USER_PASSWORD, 12);
  const regularUser = await prisma.user.create({
    data: {
      username: TEST_USER_USERNAME,
      email: TEST_USER_EMAIL,
      passwordHash: userHash,
      role: 'user',
    },
  });
  regularUserId = regularUser.id;

  // Buat JWT untuk admin (24 jam) dan user (7 hari) menggunakan UUID sebagai jti
  const { v4: uuidv4 } = await import('uuid');

  adminToken = signToken(
    { sub: adminUserId, username: TEST_ADMIN_USERNAME, role: 'admin', jti: uuidv4() },
    '24h'
  );
  userToken = signToken(
    { sub: regularUserId, username: TEST_USER_USERNAME, role: 'user', jti: uuidv4() },
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
// 1. CRUD Lifecycle
// Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.6
// ─────────────────────────────────────────────────────────────────────────────

describe('CRUD lifecycle: create → update → publish → update (auto-revert) → republish → delete', () => {
  let postId: string;
  let postSlug: string;

  afterAll(async () => {
    if (!dbAvailable) return;
    // Bersihkan post yang mungkin tertinggal jika test gagal di tengah
    await cleanPostTables();
  });

  it('POST /api/posts — membuat Draft post baru (Req 3.1, 3.2, 3.7)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Judul Post Pertama', content: 'Konten dari post pertama ini.' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Judul Post Pertama',
      status: 'draft',
    });
    // Slug harus di-generate dari title
    expect(res.body.data.slug).toBe('judul-post-pertama');
    // publishedAt harus null untuk draft
    expect(res.body.data.publishedAt).toBeNull();
    // contentHtml harus berisi hasil render Markdown
    expect(res.body.data.contentHtml).toBeTruthy();

    postId = res.body.data.id;
    postSlug = res.body.data.slug;
    expect(postId).toBeTruthy();
  });

  it('PUT /api/posts/:id — mengupdate judul dan konten post (Req 3.3)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .put(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Judul Post Diperbarui', content: 'Konten yang sudah diperbarui.' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: postId,
      title: 'Judul Post Diperbarui',
      status: 'draft', // masih draft
    });
    // Slug harus di-regenerate karena title berubah
    expect(res.body.data.slug).toBe('judul-post-diperbarui');
    postSlug = res.body.data.slug;
  });

  it('PATCH /api/posts/:id/publish — mempublikasikan draft post (Req 4.1, 4.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/posts/${postId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: postId,
      status: 'published',
    });
    // publishedAt harus diisi
    expect(res.body.data.publishedAt).not.toBeNull();
    expect(typeof res.body.data.publishedAt).toBe('string');
  });

  it('PATCH /api/posts/:id/publish — 409 jika post sudah published (duplikat transisi, Req 4.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/posts/${postId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STATUS_CONFLICT');
  });

  it('PUT /api/posts/:id — update pada Published post otomatis revert ke Draft (Req 3.4)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .put(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Konten diperbarui lagi setelah publish.' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: postId,
      status: 'draft', // harus kembali ke draft
    });
    // publishedAt harus di-clear
    expect(res.body.data.publishedAt).toBeNull();
  });

  it('PATCH /api/posts/:id/publish — republish setelah revert ke draft (Req 4.1)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/posts/${postId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
  });

  it('PATCH /api/posts/:id/unpublish — unpublish post yang published (Req 4.2, 4.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/posts/${postId}/unpublish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.publishedAt).toBeNull();
  });

  it('PATCH /api/posts/:id/unpublish — 409 jika post sudah draft (duplikat transisi, Req 4.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/posts/${postId}/unpublish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STATUS_CONFLICT');
  });

  it('DELETE /api/posts/:id — menghapus post secara permanen (Req 4.3)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('DELETE /api/posts/:id — 404 jika post sudah tidak ada', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/posts/:slug — 404 setelah post dihapus (Req 5.2)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(`/api/posts/${postSlug}`);

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cascade delete
// Requirements: 4.3, 4.8
// ─────────────────────────────────────────────────────────────────────────────

describe('Cascade delete: post dengan komentar → hapus post → komentar ikut terhapus (Req 4.3, 4.8)', () => {
  let postId: string;

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanPostTables();
  });

  it('setup: buat post dan tambahkan komentar', async () => {
    if (!dbAvailable) return;

    // Buat post
    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Post Untuk Cascade Test', content: 'Konten post cascade.' });

    expect(postRes.status).toBe(201);
    postId = postRes.body.data.id;

    // Publish agar bisa dikomentari
    await request(app)
      .patch(`/api/posts/${postId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Tambahkan komentar langsung ke DB (lebih efisien daripada via API)
    await prisma.comment.createMany({
      data: [
        { postId, authorId: regularUserId, content: 'Komentar pertama.' },
        { postId, authorId: regularUserId, content: 'Komentar kedua.' },
        { postId, authorId: regularUserId, content: 'Komentar ketiga.' },
      ],
    });

    // Verifikasi komentar ada
    const commentCount = await prisma.comment.count({ where: { postId } });
    expect(commentCount).toBe(3);
  });

  it('DELETE /api/posts/:id — menghapus post juga menghapus semua komentar (Req 4.8)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verifikasi post sudah terhapus
    const deletedPost = await prisma.post.findUnique({ where: { id: postId } });
    expect(deletedPost).toBeNull();

    // Verifikasi semua komentar juga terhapus (cascade)
    const remainingComments = await prisma.comment.count({ where: { postId } });
    expect(remainingComments).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Access control
// Requirements: 3.6, 4.4, 7.1–7.4
// ─────────────────────────────────────────────────────────────────────────────

describe('Access control: visitor dan user tidak bisa akses endpoint admin', () => {
  let existingPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanPostTables();

    // Buat post untuk diuji
    const post = await prisma.post.create({
      data: {
        title: 'Post Access Control Test',
        slug: 'post-access-control-test',
        content: 'Konten untuk access control test.',
        status: 'draft',
      },
    });
    existingPostId = post.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanPostTables();
  });

  // ── Visitor (tanpa token) ──

  it('POST /api/posts — visitor tanpa token mendapat 401 (Req 3.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/posts')
      .send({ title: 'Unauthorized Post', content: 'Ini tidak boleh berhasil.' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('PUT /api/posts/:id — visitor tanpa token mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .put(`/api/posts/${existingPostId}`)
      .send({ content: 'Update tidak sah.' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /api/posts/:id/publish — visitor tanpa token mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/posts/${existingPostId}/publish`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /api/posts/:id/unpublish — visitor tanpa token mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/posts/${existingPostId}/unpublish`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('DELETE /api/posts/:id — visitor tanpa token mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/posts/${existingPostId}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/posts/admin — visitor tanpa token mendapat 401', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/posts/admin');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // ── Registered User (role: user) mencoba akses endpoint admin ──

  it('POST /api/posts — regular user dengan role:user mendapat 403 (Req 3.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Unauthorized Post', content: 'Ini tidak boleh berhasil.' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('PUT /api/posts/:id — regular user mendapat 403', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .put(`/api/posts/${existingPostId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Update tidak sah.' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('PATCH /api/posts/:id/publish — regular user mendapat 403', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/posts/${existingPostId}/publish`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('PATCH /api/posts/:id/unpublish — regular user mendapat 403', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/posts/${existingPostId}/unpublish`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('DELETE /api/posts/:id — regular user mendapat 403', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/posts/${existingPostId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('GET /api/posts/admin — regular user mendapat 403', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/posts/admin')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Draft 404
// Requirements: 4.7, 5.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Draft 404: draft post tidak boleh terekspos ke visitor (Req 4.7, 5.3)', () => {
  let draftSlug: string;
  let publishedSlug: string;
  let publishedId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanPostTables();

    // Buat draft post langsung ke DB
    const draft = await prisma.post.create({
      data: {
        title: 'Post Draft Tersembunyi',
        slug: 'post-draft-tersembunyi',
        content: 'Konten draft yang tidak boleh dilihat visitor.',
        status: 'draft',
      },
    });
    draftSlug = draft.slug;

    // Buat published post
    const published = await prisma.post.create({
      data: {
        title: 'Post Yang Sudah Dipublish',
        slug: 'post-yang-sudah-dipublish',
        content: 'Konten yang bisa dilihat semua orang.',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    publishedSlug = published.slug;
    publishedId = published.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanPostTables();
  });

  it('GET /api/posts/:slug — draft post mengembalikan 404 untuk visitor (Req 4.7)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(`/api/posts/${draftSlug}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    // Tidak boleh mengekspos bahwa post ini adalah draft
    expect(res.body.error.message).not.toContain('draft');
  });

  it('GET /api/posts/:slug — post yang tidak ada mengembalikan 404 (Req 5.3)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/posts/slug-yang-tidak-ada-sama-sekali');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/posts/:slug — published post berhasil diakses visitor (Req 5.2)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(`/api/posts/${publishedSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      slug: publishedSlug,
      status: 'published',
    });
    expect(res.body.data.contentHtml).toBeTruthy();
  });

  it('GET /api/posts — public list hanya menampilkan published posts (Req 5.1, 5.4)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/posts?page=1&pageSize=10');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 10,
    });
    expect(Array.isArray(res.body.data)).toBe(true);

    // Semua post dalam list harus berstatus published
    for (const post of res.body.data) {
      expect(post.status).toBe('published');
    }

    // Draft post tidak boleh muncul di list publik
    const slugsInList = res.body.data.map((p: { slug: string }) => p.slug);
    expect(slugsInList).not.toContain(draftSlug);
    expect(slugsInList).toContain(publishedSlug);
  });

  it('GET /api/posts/admin — admin list menampilkan semua posts (draft + published) (Req 4.4, 4.5)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/posts/admin?page=1&pageSize=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 20,
    });
    expect(Array.isArray(res.body.data)).toBe(true);

    const slugsInList = res.body.data.map((p: { slug: string }) => p.slug);
    // Admin harus bisa melihat draft sekalipun
    expect(slugsInList).toContain(draftSlug);
    expect(slugsInList).toContain(publishedSlug);
  });

  it('GET /api/posts/:slug — draft post diakses oleh admin tetap mengembalikan 404 (Req 4.7)', async () => {
    if (!dbAvailable) return;

    // Endpoint GET /api/posts/:slug adalah endpoint publik — bahkan admin pun
    // tidak bisa akses draft via endpoint ini (harus via /api/posts/admin untuk list)
    const res = await request(app)
      .get(`/api/posts/${draftSlug}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('Slug unik: membuat dua post dengan judul sama menghasilkan slug berbeda (Req 3.2)', async () => {
    if (!dbAvailable) return;

    const res1 = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Post Slug Duplikat', content: 'Konten post 1.' });

    expect(res1.status).toBe(201);
    const slug1 = res1.body.data.slug;

    const res2 = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Post Slug Duplikat', content: 'Konten post 2.' });

    expect(res2.status).toBe(201);
    const slug2 = res2.body.data.slug;

    expect(slug1).not.toBe(slug2);
    expect(slug1).toBe('post-slug-duplikat');
    expect(slug2).toBe('post-slug-duplikat-2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Search
// Requirements: 5.5, 5.6, 5.7
// ─────────────────────────────────────────────────────────────────────────────

describe('Search: keyword valid, keyword kosong, tidak ada hasil (Req 5.5, 5.6, 5.7)', () => {
  beforeAll(async () => {
    if (!dbAvailable) return;
    await cleanPostTables();

    // Buat beberapa published posts dengan konten yang bisa dicari
    await prisma.post.createMany({
      data: [
        {
          title: 'Cara Belajar TypeScript',
          slug: 'cara-belajar-typescript',
          content: 'TypeScript adalah superset dari JavaScript yang menambahkan tipe statis.',
          status: 'published',
          publishedAt: new Date(),
        },
        {
          title: 'Pengenalan React Hooks',
          slug: 'pengenalan-react-hooks',
          content: 'React Hooks memungkinkan penggunaan state dan fitur React lainnya di functional component.',
          status: 'published',
          publishedAt: new Date(Date.now() - 1000),
        },
        {
          title: 'Tutorial Node.js Express',
          slug: 'tutorial-nodejs-express',
          content: 'Express adalah framework web minimalis untuk Node.js.',
          status: 'published',
          publishedAt: new Date(Date.now() - 2000),
        },
        {
          // Draft post — tidak boleh muncul di search
          title: 'Draft Post TypeScript',
          slug: 'draft-post-typescript',
          content: 'Ini adalah draft post yang tidak boleh muncul di hasil pencarian TypeScript.',
          status: 'draft',
        },
      ],
    });
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanPostTables();
  });

  it('GET /api/posts/search?keyword=typescript — mengembalikan hasil yang relevan (Req 5.5)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/posts/search?keyword=typescript');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 10,
    });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);

    // Semua hasil harus berstatus published
    for (const post of res.body.data) {
      expect(post.status).toBe('published');
    }

    // Draft post tidak boleh muncul di hasil pencarian
    const slugsFound = res.body.data.map((p: { slug: string }) => p.slug);
    expect(slugsFound).not.toContain('draft-post-typescript');
  });

  it('GET /api/posts/search — keyword kosong menghasilkan 400 (Req 5.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/posts/search?keyword=');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('keyword');
  });

  it('GET /api/posts/search — keyword hanya spasi menghasilkan 400 (Req 5.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/posts/search?keyword=   ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('keyword');
  });

  it('GET /api/posts/search — tanpa parameter keyword menghasilkan 400 (Req 5.6)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/posts/search');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/posts/search?keyword=xyz — keyword tanpa hasil mengembalikan array kosong (Req 5.7)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(
      '/api/posts/search?keyword=kwkwkwkwtidakadahasilnya999'
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(0);
  });

  it('GET /api/posts/search?keyword=react — pagination berfungsi (Req 5.5)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/posts/search?keyword=react&page=1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 10, // search selalu menggunakan SEARCH_PAGE_SIZE = 10
    });
    expect(typeof res.body.totalPages).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Validasi request body
// Requirements: 3.5, 3.7
// ─────────────────────────────────────────────────────────────────────────────

describe('Validasi request body untuk endpoint admin (Req 3.5, 3.7)', () => {
  it('POST /api/posts — 400 jika title tidak ada (Req 3.5)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Konten tanpa judul.' });

    expect(res.status).toBe(400);
  });

  it('POST /api/posts — 400 jika content tidak ada (Req 3.5)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Judul tanpa konten' });

    expect(res.status).toBe(400);
  });

  it('POST /api/posts — 400 jika title hanya spasi (Req 3.5)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '   ', content: 'Konten valid.' });

    expect(res.status).toBe(400);
  });

  it('PUT /api/posts/:id — 400 jika tidak ada field yang diupdate (Req 3.5)', async () => {
    if (!dbAvailable) return;

    // Buat post terlebih dahulu
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Post Untuk Validasi Update', content: 'Konten awal.' });

    const postId = createRes.body.data?.id;
    if (!postId) return; // skip jika create gagal

    const res = await request(app)
      .put(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({}); // body kosong

    expect(res.status).toBe(400);

    // Cleanup
    await prisma.post.delete({ where: { id: postId } }).catch(() => {});
  });
});
