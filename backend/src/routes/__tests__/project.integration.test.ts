/**
 * Integration tests untuk Project routes
 * Task 16 — Stage 2 New Content Sections
 *
 * Skenario yang dicakup:
 *  1. Create → publish → GET /api/projects mengembalikannya
 *  2. GET /api/projects/:slug mengembalikan detail project published
 *  3. Draft project → GET /api/projects/:slug → 404 untuk unauthenticated
 *  4. Update project published → auto-revert ke draft
 *  5. Duplicate publish → 409
 *  6. Komentar project via POST /api/comments dengan contentType: 'project' → 201
 *  7. Access control: endpoint admin-only 403 untuk non-admin
 *  8. Admin stats menyertakan totalProjects
 *  9. PBT — Property 2: Slug Uniqueness
 *
 * Requirements: 3.1–3.7 (Stage 2)
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

async function cleanProjectTables(): Promise<void> {
  await prisma.comment.deleteMany({ where: { contentType: 'project' } });
  await prisma.projectTag.deleteMany({});
  await prisma.project.deleteMany({});
}

async function cleanAllTables(): Promise<void> {
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.loginAttempts.deleteMany({});
  await prisma.comment.deleteMany({});
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

const TEST_ADMIN_EMAIL = 'projecttest-admin@example.com';
const TEST_ADMIN_USERNAME = 'projecttest-admin';

const TEST_USER_EMAIL = 'projecttest-user@example.com';
const TEST_USER_USERNAME = 'projecttest-user';

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

  const adminHash = await bcrypt.hash('AdminProjectTest123!', 12);
  const adminUser = await prisma.user.create({
    data: {
      username: TEST_ADMIN_USERNAME,
      email: TEST_ADMIN_EMAIL,
      passwordHash: adminHash,
      role: 'admin',
    },
  });
  adminUserId = adminUser.id;

  const userHash = await bcrypt.hash('UserProjectTest456!', 12);
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
// 1 & 2. Create → publish → GET list dan GET by slug
// Requirements: 3.1, 3.2, 3.3 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Create → publish → GET /api/projects dan GET /api/projects/:slug', () => {
  let projectId: string;
  let projectSlug: string;

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanProjectTables();
  });

  it('POST /api/projects — membuat project baru dalam status draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Personal Website',
        description: '# Personal Website\n\nProject portofolio saya.',
        techTags: ['React', 'TypeScript'],
        order: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Personal Website',
      slug: 'personal-website',
      status: 'draft',
    });
    expect(res.body.data.contentHtml).toContain('Personal Website');
    expect(res.body.data.techTags).toContain('react');
    projectId = res.body.data.id;
    projectSlug = res.body.data.slug;
  });

  it('GET /api/projects — draft project tidak muncul di daftar publik', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    const ids = res.body.data.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(projectId);
  });

  it('PATCH /api/projects/:id/publish — mempublikasikan project', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).not.toBeNull();
  });

  it('GET /api/projects — project published muncul di daftar publik', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    const found = res.body.data.find((p: { id: string }) => p.id === projectId);
    expect(found).toBeDefined();
    expect(found.status).toBe('published');
    expect(found.techTags).toEqual(expect.arrayContaining(['react', 'typescript']));
  });

  it('GET /api/projects/:slug — mengembalikan detail project published', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(`/api/projects/${projectSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: projectId,
      slug: projectSlug,
      title: 'Personal Website',
      status: 'published',
    });
    expect(res.body.data.contentHtml).toBeDefined();
    expect(typeof res.body.data.contentHtml).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Draft project → GET /api/projects/:slug → 404 untuk unauthenticated
// Property 1: Content Draft Isolation
// Requirements: 3.3, 3.4 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Draft project → GET /api/projects/:slug → 404 untuk unauthenticated', () => {
  let draftSlug: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Secret Draft Project',
        description: 'Draft yang tidak boleh terekspos.',
      });
    draftSlug = res.body.data.slug;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanProjectTables();
  });

  it('GET /api/projects/:slug tanpa auth mengembalikan 404 untuk draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(`/api/projects/${draftSlug}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/projects/:slug dengan user token juga mengembalikan 404 untuk draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get(`/api/projects/${draftSlug}`)
      .set('Authorization', `Bearer ${userToken}`);

    // Public endpoint tidak menggunakan auth — draft tetap 404
    expect(res.status).toBe(404);
  });

  it('GET /api/projects tidak menampilkan slug draft di daftar publik', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    const slugs = res.body.data.map((p: { slug: string }) => p.slug);
    expect(slugs).not.toContain(draftSlug);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Update project published → auto-revert ke draft
// Requirements: 3.3, 3.4 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Update project published → auto-revert ke draft', () => {
  let projectId: string;
  let projectSlug: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Revert Test Project', description: 'Project untuk test auto-revert.' });
    projectId = createRes.body.data.id;
    projectSlug = createRes.body.data.slug;

    await request(app)
      .patch(`/api/projects/${projectId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanProjectTables();
  });

  it('PUT /api/projects/:id pada project published → status berubah ke draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Deskripsi yang diperbarui.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.publishedAt).toBeNull();
  });

  it('GET /api/projects/:slug mengembalikan 404 setelah auto-revert ke draft', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(`/api/projects/${projectSlug}`);

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Duplicate publish → 409
// Requirements: 3.6 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Duplicate publish/unpublish → 409 STATUS_CONFLICT', () => {
  let projectId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Conflict Test Project', description: 'Project untuk test 409.' });
    projectId = res.body.data.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanProjectTables();
  });

  it('PATCH /:id/unpublish pada draft → 409 STATUS_CONFLICT', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/unpublish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STATUS_CONFLICT');
  });

  it('PATCH /:id/publish berhasil pertama kali', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
  });

  it('PATCH /:id/publish kedua kali → 409 STATUS_CONFLICT', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STATUS_CONFLICT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Komentar project via POST /api/comments → 201
// Requirements: 3.8 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Komentar project via POST /api/comments dengan contentType: project', () => {
  let projectId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Commentable Project', description: 'Project untuk test komentar.' });
    projectId = createRes.body.data.id;

    await request(app)
      .patch(`/api/projects/${projectId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanProjectTables();
  });

  it('POST /api/comments dengan contentType project → 201', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        contentType: 'project',
        contentId: projectId,
        content: 'Komentar pada project ini sangat menarik!',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      contentType: 'project',
      contentId: projectId,
      content: 'Komentar pada project ini sangat menarik!',
    });
  });

  it('GET /api/comments?contentType=project&contentId=:id mengembalikan komentar', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get(
      `/api/comments?contentType=project&contentId=${projectId}`
    );

    expect(res.status).toBe(200);
    const comments = res.body.data;
    expect(Array.isArray(comments)).toBe(true);
    expect(comments.length).toBeGreaterThan(0);
    expect(comments[0].contentType).toBe('project');
    expect(comments[0].contentId).toBe(projectId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Access control
// ─────────────────────────────────────────────────────────────────────────────

describe('Access control: endpoint admin-only mengembalikan 403/401 untuk non-admin', () => {
  it('POST /api/projects → 403 untuk user biasa', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Test', description: 'Test' });

    expect(res.status).toBe(403);
  });

  it('POST /api/projects → 401 tanpa token', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/projects')
      .send({ title: 'Test', description: 'Test' });

    expect(res.status).toBe(401);
  });

  it('GET /api/projects → 200 tanpa token (publik)', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Admin stats menyertakan totalProjects
// Requirements: 6.3 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/stats menyertakan totalProjects', () => {
  it('response menyertakan field totalProjects bertipe number', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.totalProjects).toBe('number');
    expect(res.body.totalProjects).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Property 2: Slug Uniqueness
// Feature: stage-2-new-sections, Property 2: Slug uniqueness
// Validates: Requirements 3.2 (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 2: Slug Uniqueness — slug yang dihasilkan selalu unik per content type', () => {
  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanProjectTables();
  });

  it(
    /**
     * **Validates: Requirements 3.2 (Stage 2)**
     *
     * Untuk sembarang himpunan title dalam satu content type (Project),
     * slug yang dihasilkan selalu unik — tabrakan diselesaikan dengan suffix numerik.
     *
     * Feature: stage-2-new-sections, Property 2: Slug uniqueness
     */
    'untuk sembarang set title, semua slug yang dihasilkan unik (min 100 iterasi)',
    async () => {
      if (!dbAvailable) return;

      await fc.assert(
        fc.asyncProperty(
          // Generator: 2-5 title, minimal satu pasang yang menghasilkan slug sama
          fc.array(
            fc.string({ minLength: 3, maxLength: 50 }).filter((s) => s.trim().length > 0),
            { minLength: 2, maxLength: 5 }
          ),
          async (titles) => {
            // Tambahkan duplikat untuk memastikan collision handling teruji
            const titlesWithDuplicate = [...titles, titles[0]];

            const slugs: string[] = [];
            for (const title of titlesWithDuplicate) {
              const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ title, description: 'Test project untuk PBT slug uniqueness.' });

              // Bisa saja gagal karena title kosong/tidak valid — lewati
              if (res.status === 201) {
                slugs.push(res.body.data.slug);
              }
            }

            // Semua slug harus unik
            const uniqueSlugs = new Set(slugs);
            expect(uniqueSlugs.size).toBe(slugs.length);

            // Cleanup untuk iterasi berikutnya
            await cleanProjectTables();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
