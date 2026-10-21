/**
 * Integration tests untuk Fun routes
 * Task 18 — Stage 2 New Content Sections
 *
 * Skenario yang dicakup:
 *  1. Create → publish → GET /api/fun mengembalikannya
 *  2. Draft fun post → GET /api/fun/:slug → 404 untuk unauthenticated
 *  3. Filter kombinasi type + tag bekerja dengan benar (AND condition)
 *  4. Update fun post published → auto-revert ke draft
 *  5. Duplicate publish → 409
 *  6. Komentar fun post via POST /api/comments dengan contentType: 'fun' → 201
 *  7. Access control: endpoint admin-only 403/401 untuk non-admin
 *  8. Admin stats menyertakan totalFunPosts
 *  9. PBT — Property 3: Fun feed filter correctness
 *
 * Requirements: 4.1–4.5 (Stage 2)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fc from 'fast-check';
import app from '../../app.js';
import prisma from '../../lib/prisma.js';
import type { JwtPayload } from '../../types/index.js';

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

function signToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn: string | number
): string {
  const secret = process.env['JWT_SECRET'] ?? 'test-jwt-secret-key';
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

// ─── Test database helpers ────────────────────────────────────────────────────

async function cleanFunTables(): Promise<void> {
  await prisma.comment.deleteMany({ where: { contentType: 'fun' } });
  await prisma.funTag.deleteMany({});
  await prisma.funPost.deleteMany({});
}

async function cleanAllTables(): Promise<void> {
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.loginAttempts.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.funTag.deleteMany({});
  await prisma.funPost.deleteMany({});
  await prisma.projectTag.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.postTag.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.aboutSection.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.user.deleteMany({});
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_ADMIN_EMAIL = 'funtest-admin@example.com';
const TEST_ADMIN_USERNAME = 'funtest-admin';

const TEST_USER_EMAIL = 'funtest-user@example.com';
const TEST_USER_USERNAME = 'funtest-user';

// ─── Global setup / teardown ──────────────────────────────────────────────────

let dbAvailable = false;
let adminToken: string;
let userToken: string;
let adminUserId: string;
let regularUserId: string;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    console.warn('\n⚠  Integration tests dilewati: PostgreSQL tidak dapat dijangkau.\n');
    return;
  }

  app.set('trust proxy', true);

  await cleanAllTables();

  const { v4: uuidv4 } = await import('uuid');

  const adminHash = await bcrypt.hash('AdminFunTest123!', 12);
  const adminUser = await prisma.user.create({
    data: {
      username: TEST_ADMIN_USERNAME,
      email: TEST_ADMIN_EMAIL,
      passwordHash: adminHash,
      role: 'admin',
    },
  });
  adminUserId = adminUser.id;

  const userHash = await bcrypt.hash('UserFunTest456!', 12);
  const regularUser = await prisma.user.create({
    data: {
      username: TEST_USER_USERNAME,
      email: TEST_USER_EMAIL,
      passwordHash: userHash,
      role: 'user',
    },
  });
  regularUserId = regularUser.id;

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
// 1. Create → publish → GET /api/fun
// Requirements: 4.1, 4.2 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Create → publish → GET /api/fun dan GET /api/fun/:slug', () => {
  let funPostId: string;
  let funPostSlug: string;

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanFunTables();
  });

  it('POST /api/fun — membuat fun post baru dalam status draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/fun')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Review: Buku Pemrograman Terbaik',
        content: '## Review\n\nBuku yang luar biasa tentang pemrograman.',
        type: 'review',
        tags: ['books', 'programming'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Review: Buku Pemrograman Terbaik',
      status: 'draft',
      type: 'review',
    });
    // excerpt auto-generated
    expect(res.body.data.excerpt).toBeTruthy();
    expect(res.body.data.contentHtml).toBeTruthy();
    funPostId = res.body.data.id;
    funPostSlug = res.body.data.slug;
  });

  it('GET /api/fun — draft fun post tidak muncul di daftar publik', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/fun');

    expect(res.status).toBe(200);
    const ids = res.body.data.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(funPostId);
  });

  it('PATCH /api/fun/:id/publish — mempublikasikan fun post', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/fun/${funPostId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).not.toBeNull();
  });

  it('GET /api/fun — fun post published muncul di daftar publik', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/fun');

    expect(res.status).toBe(200);
    const found = res.body.data.find((p: { id: string }) => p.id === funPostId);
    expect(found).toBeDefined();
    expect(found.status).toBe('published');
    expect(found.type).toBe('review');
  });

  it('GET /api/fun/:slug — mengembalikan detail fun post published', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(`/api/fun/${funPostSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: funPostId,
      slug: funPostSlug,
      title: 'Review: Buku Pemrograman Terbaik',
      status: 'published',
      type: 'review',
    });
    expect(res.body.data.contentHtml).toBeDefined();
    expect(typeof res.body.data.contentHtml).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Draft fun post → GET /api/fun/:slug → 404 untuk unauthenticated
// Property 1: Content Draft Isolation
// Requirements: 4.3 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Draft fun post → GET /api/fun/:slug → 404 untuk unauthenticated', () => {
  let draftSlug: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/fun')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Secret Draft Fun Post',
        content: 'Draft yang tidak boleh terekspos kepada publik.',
        type: 'text',
      });
    draftSlug = res.body.data.slug;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanFunTables();
  });

  it('GET /api/fun/:slug tanpa auth mengembalikan 404 untuk draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(`/api/fun/${draftSlug}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/fun/:slug dengan user token juga mengembalikan 404 untuk draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get(`/api/fun/${draftSlug}`)
      .set('Authorization', `Bearer ${userToken}`);

    // Public endpoint tidak menggunakan auth — draft tetap 404
    expect(res.status).toBe(404);
  });

  it('GET /api/fun tidak menampilkan slug draft di daftar publik', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/fun');

    expect(res.status).toBe(200);
    const slugs = res.body.data.map((p: { slug: string }) => p.slug);
    expect(slugs).not.toContain(draftSlug);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Filter kombinasi type + tag bekerja dengan benar (AND condition)
// Requirements: 4.2 (Stage 2) — Property 3: Fun feed filter correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('Filter type + tag bekerja dengan benar (AND condition)', () => {
  let reviewPostId: string;
  let imagePostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    // Post 1: type=review, tags=[books]
    const review = await request(app)
      .post('/api/fun')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Review Buku Sains',
        content: 'Ulasan buku sains yang bagus.',
        type: 'review',
        tags: ['books'],
      });
    reviewPostId = review.body.data.id;
    await request(app)
      .patch(`/api/fun/${reviewPostId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Post 2: type=image, tags=[photography]
    const image = await request(app)
      .post('/api/fun')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Foto Alam Indah',
        content: 'Koleksi foto alam.',
        type: 'image',
        tags: ['photography'],
      });
    imagePostId = image.body.data.id;
    await request(app)
      .patch(`/api/fun/${imagePostId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanFunTables();
  });

  it('GET /api/fun?type=review mengembalikan hanya type=review', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/fun?type=review');

    expect(res.status).toBe(200);
    const types = res.body.data.map((p: { type: string }) => p.type);
    expect(types.every((t: string) => t === 'review')).toBe(true);
    expect(res.body.data.some((p: { id: string }) => p.id === reviewPostId)).toBe(true);
    expect(res.body.data.some((p: { id: string }) => p.id === imagePostId)).toBe(false);
  });

  it('GET /api/fun?type=image mengembalikan hanya type=image', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/fun?type=image');

    expect(res.status).toBe(200);
    const types = res.body.data.map((p: { type: string }) => p.type);
    expect(types.every((t: string) => t === 'image')).toBe(true);
    expect(res.body.data.some((p: { id: string }) => p.id === imagePostId)).toBe(true);
    expect(res.body.data.some((p: { id: string }) => p.id === reviewPostId)).toBe(false);
  });

  it('GET /api/fun?type=review&tag=books mengembalikan hanya review dengan tag books', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/fun?type=review&tag=books');

    expect(res.status).toBe(200);
    expect(res.body.data.some((p: { id: string }) => p.id === reviewPostId)).toBe(true);
    // image post tidak termasuk karena type berbeda
    expect(res.body.data.some((p: { id: string }) => p.id === imagePostId)).toBe(false);
    // semua hasil harus type=review
    const types = res.body.data.map((p: { type: string }) => p.type);
    expect(types.every((t: string) => t === 'review')).toBe(true);
  });

  it('GET /api/fun?type=image&tag=books menghasilkan 0 hasil (AND condition)', async () => {
    if (!dbAvailable) return;

    // review post has books tag but type=image doesn't match
    const res = await request(app).get('/api/fun?type=image&tag=books');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.data.length).toBe(0);
  });

  it('GET /api/fun?type=text mengembalikan 0 hasil (tidak ada post type text)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/fun?type=text');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Update fun post published → auto-revert ke draft
// Requirements: 4.5 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Update fun post published → auto-revert ke draft', () => {
  let funPostId: string;
  let funPostSlug: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    const createRes = await request(app)
      .post('/api/fun')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Revert Test Fun Post',
        content: 'Konten untuk test auto-revert.',
        type: 'text',
      });
    funPostId = createRes.body.data.id;
    funPostSlug = createRes.body.data.slug;

    await request(app)
      .patch(`/api/fun/${funPostId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanFunTables();
  });

  it('PUT /api/fun/:id pada fun post published → status berubah ke draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .put(`/api/fun/${funPostId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Konten yang diperbarui.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.publishedAt).toBeNull();
  });

  it('GET /api/fun/:slug mengembalikan 404 setelah auto-revert ke draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(`/api/fun/${funPostSlug}`);

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Duplicate publish → 409
// Requirements: 4.5 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Duplicate publish/unpublish → 409 STATUS_CONFLICT', () => {
  let funPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/fun')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Conflict Test Fun Post',
        content: 'Konten untuk test 409.',
        type: 'text',
      });
    funPostId = res.body.data.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanFunTables();
  });

  it('PATCH /:id/unpublish pada draft → 409 STATUS_CONFLICT', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/fun/${funPostId}/unpublish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STATUS_CONFLICT');
  });

  it('PATCH /:id/publish berhasil pertama kali', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/fun/${funPostId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
  });

  it('PATCH /:id/publish kedua kali → 409 STATUS_CONFLICT', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/fun/${funPostId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STATUS_CONFLICT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Komentar fun post via POST /api/comments → 201
// Requirements: 4.7 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Komentar fun post via POST /api/comments dengan contentType: fun', () => {
  let funPostId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    const createRes = await request(app)
      .post('/api/fun')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Commentable Fun Post',
        content: 'Fun post untuk test komentar.',
        type: 'review',
      });
    funPostId = createRes.body.data.id;

    await request(app)
      .patch(`/api/fun/${funPostId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanFunTables();
  });

  it('POST /api/comments dengan contentType fun → 201', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        contentType: 'fun',
        contentId: funPostId,
        content: 'Komentar pada fun post ini sangat menarik!',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      contentType: 'fun',
      contentId: funPostId,
      content: 'Komentar pada fun post ini sangat menarik!',
    });
  });

  it('GET /api/comments?contentType=fun&contentId=:id mengembalikan komentar', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(
      `/api/comments?contentType=fun&contentId=${funPostId}`
    );

    expect(res.status).toBe(200);
    const comments = res.body.data;
    expect(Array.isArray(comments)).toBe(true);
    expect(comments.length).toBeGreaterThan(0);
    expect(comments[0].contentType).toBe('fun');
    expect(comments[0].contentId).toBe(funPostId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Access control
// ─────────────────────────────────────────────────────────────────────────────

describe('Access control: endpoint admin-only mengembalikan 403/401 untuk non-admin', () => {
  it('POST /api/fun → 403 untuk user biasa', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/fun')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Test', content: 'Test', type: 'text' });

    expect(res.status).toBe(403);
  });

  it('POST /api/fun → 401 tanpa token', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/fun')
      .send({ title: 'Test', content: 'Test', type: 'text' });

    expect(res.status).toBe(401);
  });

  it('GET /api/fun → 200 tanpa token (publik)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/fun');
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Admin stats menyertakan totalFunPosts
// Requirements: 6.3 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/stats menyertakan totalFunPosts', () => {
  it('response menyertakan field totalFunPosts bertipe number', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.totalFunPosts).toBe('number');
    expect(res.body.totalFunPosts).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Property 3: Fun feed filter correctness
// Feature: stage-2-new-sections, Property 3: Fun feed filter correctness
// Validates: Requirement 4.2 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 3: Fun feed filter correctness — GET /api/fun?type=T returns only type=T', () => {
  const FUN_POST_TYPES = ['text', 'review', 'image', 'drawing', 'music', 'interactive'] as const;

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanFunTables();
  });

  it(
    /**
     * **Validates: Requirement 4.2 (Stage 2)**
     *
     * For any active type filter T, GET /api/fun?type=T returns only records
     * with type = T. No record with a different type is included in the response.
     *
     * Feature: stage-2-new-sections, Property 3: Fun feed filter correctness
     */
    'untuk sembarang filter type T, semua hasil GET /api/fun?type=T memiliki type = T (min 100 iterasi)',
    async () => {

      if (!dbAvailable) return;

      await fc.assert(
        fc.asyncProperty(
          // Pick a random subset of types to create posts for
          fc.array(fc.constantFrom(...FUN_POST_TYPES), { minLength: 2, maxLength: 4 }),
          // Pick a type to filter by
          fc.constantFrom(...FUN_POST_TYPES),
          async (typesToCreate, filterType) => {
            // Create one published post for each selected type
            for (const type of typesToCreate) {
              const title = `PBT Post ${type} ${Date.now()}`;
              const createRes = await request(app)
                .post('/api/fun')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ title, content: `Konten untuk ${type}.`, type });

              if (createRes.status === 201) {
                await request(app)
                  .patch(`/api/fun/${createRes.body.data.id}/publish`)
                  .set('Authorization', `Bearer ${adminToken}`);
              }
            }

            // Apply the type filter
            const res = await request(app).get(`/api/fun?type=${filterType}`);

            expect(res.status).toBe(200);

            // Core property: every item in the response must match the filter type
            const types = res.body.data.map((p: { type: string }) => p.type);
            for (const type of types) {
              expect(type).toBe(filterType);
            }

            // Cleanup for next iteration
            await cleanFunTables();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );
});
