/**
 * Integration tests untuk About routes
 * Task 14 — Stage 2 New Content Sections
 *
 * Skenario yang dicakup:
 *  1. Validasi: POST /api/about dengan type tidak valid → 400
 *  2. CRUD lifecycle: buat seksi → GET /api/about mengembalikannya dengan urutan yang benar
 *  3. Reorder: PATCH /api/about/reorder memperbarui order; GET mengembalikan urutan baru
 *  4. Access control: endpoint admin-only mengembalikan 403 untuk token non-admin
 *  5. PBT: Property 4 — Reorder Transaction Atomicity
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
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

async function cleanAboutTables(): Promise<void> {
  await prisma.aboutSection.deleteMany({});
}

async function cleanAllTables(): Promise<void> {
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.loginAttempts.deleteMany({});
  await prisma.aboutSection.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.user.deleteMany({});
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEST_ADMIN_EMAIL = 'abouttest-admin@example.com';
const TEST_ADMIN_USERNAME = 'abouttest-admin';

const TEST_USER_EMAIL = 'abouttest-user@example.com';
const TEST_USER_USERNAME = 'abouttest-user';
const TEST_USER_PASSWORD = 'UserAboutTest456!';

// ─── Global setup / teardown ──────────────────────────────────────────────────

let dbAvailable = false;
let adminToken: string;
let userToken: string;
let adminUserId: string;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    console.warn(
      '\n⚠  Integration tests dilewati: PostgreSQL tidak dapat dijangkau.\n'
    );
    return;
  }

  app.set('trust proxy', true);

  await cleanAllTables();

  const { v4: uuidv4 } = await import('uuid');

  // Buat admin user
  const adminHash = await bcrypt.hash('AdminAboutTest123!', 12);
  const adminUser = await prisma.user.create({
    data: {
      username: TEST_ADMIN_USERNAME,
      email: TEST_ADMIN_EMAIL,
      passwordHash: adminHash,
      role: 'admin',
    },
  });
  adminUserId = adminUser.id;

  // Buat regular user
  const userHash = await bcrypt.hash(TEST_USER_PASSWORD, 12);
  const regularUser = await prisma.user.create({
    data: {
      username: TEST_USER_USERNAME,
      email: TEST_USER_EMAIL,
      passwordHash: userHash,
      role: 'user',
    },
  });

  adminToken = signToken(
    { sub: adminUserId, username: TEST_ADMIN_USERNAME, role: 'admin', jti: uuidv4() },
    '24h'
  );
  userToken = signToken(
    { sub: regularUser.id, username: TEST_USER_USERNAME, role: 'user', jti: uuidv4() },
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
// 1. Validasi: type tidak valid → 400
// Requirements: 2.1, 2.2
// ─────────────────────────────────────────────────────────────────────────────

describe('Validasi: POST /api/about dengan type tidak valid', () => {
  it('mengembalikan 400 VALIDATION_ERROR untuk type yang tidak dikenal', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/about')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'invalid_type',
        title: 'Judul Test',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toBeDefined();
  });

  it('mengembalikan 400 VALIDATION_ERROR jika title tidak ada', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/about')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'education',
        // title tidak ada
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('mengembalikan 400 untuk semua nilai type yang tidak valid', async () => {
    if (!dbAvailable) return;

    const invalidTypes = ['blog', 'about', 'project', 'fun', 'learning', '', 'EDUCATION'];

    for (const invalidType of invalidTypes) {
      const res = await request(app)
        .post('/api/about')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: invalidType, title: 'Judul' });

      expect(res.status).toBe(400, `type '${invalidType}' should be rejected`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CRUD lifecycle
// Requirements: 2.2, 2.5
// ─────────────────────────────────────────────────────────────────────────────

describe('CRUD lifecycle: buat seksi → GET /api/about mengembalikannya dengan urutan yang benar', () => {
  let sectionId: string;

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanAboutTables();
  });

  it('POST /api/about — membuat AboutSection baru (education)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/about')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'education',
        title: 'S1 Informatika',
        subtitle: 'Universitas Contoh',
        description: 'Program studi teknik informatika.',
        startDate: '2018-08-01',
        endDate: '2022-07-31',
        order: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      type: 'education',
      title: 'S1 Informatika',
      subtitle: 'Universitas Contoh',
      order: 0,
    });
    sectionId = res.body.data.id;
    expect(sectionId).toBeTruthy();
  });

  it('POST /api/about — membuat beberapa seksi dengan order berbeda', async () => {
    if (!dbAvailable) return;

    // Buat seksi kedua (experience) dengan order 1
    const res1 = await request(app)
      .post('/api/about')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'experience',
        title: 'Software Engineer',
        subtitle: 'Perusahaan A',
        order: 1,
      });
    expect(res1.status).toBe(201);

    // Buat seksi ketiga (experience) dengan order 0 untuk verifikasi urutan
    const res2 = await request(app)
      .post('/api/about')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'experience',
        title: 'Junior Developer',
        subtitle: 'Perusahaan B',
        order: 0,
      });
    expect(res2.status).toBe(201);
  });

  it('GET /api/about — mengembalikan semua seksi diurutkan berdasarkan type lalu order', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/about');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);

    // Verifikasi urutan: education sebelum experience (alphabetical by type)
    const types = res.body.data.map((s: { type: string }) => s.type);
    const educationIdx = types.indexOf('education');
    const experienceIdx = types.indexOf('experience');
    expect(educationIdx).toBeLessThan(experienceIdx);

    // Verifikasi experience diurutkan by order
    const experienceSections = res.body.data.filter(
      (s: { type: string }) => s.type === 'experience'
    );
    expect(experienceSections[0].order).toBeLessThanOrEqual(experienceSections[1].order);
    expect(experienceSections[0].title).toBe('Junior Developer'); // order 0 → pertama
    expect(experienceSections[1].title).toBe('Software Engineer'); // order 1 → kedua
  });

  it('PUT /api/about/:id — mengupdate seksi yang ada', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .put(`/api/about/${sectionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'S1 Ilmu Komputer',
        subtitle: 'Universitas Teknologi',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: sectionId,
      title: 'S1 Ilmu Komputer',
      subtitle: 'Universitas Teknologi',
      type: 'education', // type tidak berubah
    });
  });

  it('PUT /api/about/:id — mengembalikan 404 untuk id yang tidak ada', async () => {
    if (!dbAvailable) return;

    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .put(`/api/about/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Judul Baru' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE /api/about/:id — menghapus seksi dan mengembalikan 204', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .delete(`/api/about/${sectionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verifikasi seksi benar-benar terhapus
    const getRes = await request(app).get('/api/about');
    const ids = getRes.body.data.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(sectionId);
  });

  it('DELETE /api/about/:id — mengembalikan 404 untuk id yang tidak ada', async () => {
    if (!dbAvailable) return;

    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .delete(`/api/about/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Reorder: PATCH /api/about/reorder memperbarui order
// Requirements: 2.6
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/about/reorder memperbarui order; GET mengembalikan urutan baru', () => {
  let idA: string;
  let idB: string;
  let idC: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    await cleanAboutTables();

    // Buat 3 seksi dengan type yang sama (skill) dengan order awal 0, 1, 2
    const resA = await request(app)
      .post('/api/about')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'skill', title: 'TypeScript', order: 0 });
    idA = resA.body.data.id;

    const resB = await request(app)
      .post('/api/about')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'skill', title: 'React', order: 1 });
    idB = resB.body.data.id;

    const resC = await request(app)
      .post('/api/about')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'skill', title: 'PostgreSQL', order: 2 });
    idC = resC.body.data.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanAboutTables();
  });

  it('PATCH /api/about/reorder — memperbarui order semua item secara atomik', async () => {
    if (!dbAvailable) return;

    // Balik urutan: C=0, A=1, B=2
    const res = await request(app)
      .patch('/api/about/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { id: idC, order: 0 },
          { id: idA, order: 1 },
          { id: idB, order: 2 },
        ],
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/about — mengembalikan urutan baru setelah reorder', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/about');

    expect(res.status).toBe(200);
    const skills = res.body.data.filter((s: { type: string }) => s.type === 'skill');
    expect(skills.length).toBe(3);

    // Verifikasi urutan: C (order 0) → A (order 1) → B (order 2)
    expect(skills[0].title).toBe('PostgreSQL'); // C, order 0
    expect(skills[1].title).toBe('TypeScript');  // A, order 1
    expect(skills[2].title).toBe('React');       // B, order 2
  });

  it('PATCH /api/about/reorder — mengembalikan 404 dan rollback jika ada id yang tidak valid', async () => {
    if (!dbAvailable) return;

    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .patch('/api/about/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { id: idA, order: 99 },
          { id: fakeId, order: 88 }, // id tidak valid → seluruh transaksi gagal
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    // Verifikasi bahwa idA TIDAK diperbarui (rollback berhasil)
    const getRes = await request(app).get('/api/about');
    const sectionA = getRes.body.data.find((s: { id: string }) => s.id === idA);
    expect(sectionA.order).not.toBe(99); // order harus tetap seperti sebelumnya (1)
    expect(sectionA.order).toBe(1);
  });

  it('PATCH /api/about/reorder — mengembalikan 400 jika items array kosong', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch('/api/about/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Access control: endpoint admin-only mengembalikan 403 untuk token non-admin
// ─────────────────────────────────────────────────────────────────────────────

describe('Access control: endpoint admin-only mengembalikan 403 untuk token non-admin', () => {
  it('POST /api/about — mengembalikan 403 untuk user biasa', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/about')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ type: 'skill', title: 'JavaScript' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('PUT /api/about/:id — mengembalikan 403 untuk user biasa', async () => {
    if (!dbAvailable) return;

    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app)
      .put(`/api/about/${fakeId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Update Judul' });

    expect(res.status).toBe(403);
  });

  it('DELETE /api/about/:id — mengembalikan 403 untuk user biasa', async () => {
    if (!dbAvailable) return;

    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app)
      .delete(`/api/about/${fakeId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('PATCH /api/about/reorder — mengembalikan 403 untuk user biasa', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .patch('/api/about/reorder')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ id: '00000000-0000-0000-0000-000000000001', order: 0 }] });

    expect(res.status).toBe(403);
  });

  it('POST /api/about — mengembalikan 401 tanpa token', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/about')
      .send({ type: 'skill', title: 'JavaScript' });

    expect(res.status).toBe(401);
  });

  it('GET /api/about — publik, dapat diakses tanpa token', async () => {
    if (!dbAvailable) return;

    const res = await request(app).get('/api/about');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Property 4: Reorder Transaction Atomicity
// Feature: stage-2-new-sections, Property 4: Reorder Transaction Atomicity
// Validates: Requirement 2.6
// ─────────────────────────────────────────────────────────────────────────────

describe(
  'Property 4: Reorder Transaction Atomicity — PATCH /api/about/reorder is all-or-nothing',
  () => {
    beforeAll(async () => {
      if (!dbAvailable) return;
      await cleanAboutTables();
    });

    afterAll(async () => {
      if (!dbAvailable) return;
      await cleanAboutTables();
    });

    it(
      /**
       * **Validates: Requirement 2.6**
       *
       * Untuk sembarang array input ke PATCH /api/about/reorder:
       * - Jika semua id valid → semua order diperbarui secara atomik
       * - Jika satu id pun tidak ditemukan → seluruh transaksi di-rollback,
       *   tidak ada order yang berubah
       *
       * Feature: stage-2-new-sections, Property 4: Reorder Transaction Atomicity
       */
      'untuk array dengan satu id tidak valid, seluruh transaksi di-rollback (min 100 iterasi)',
      async () => {
        if (!dbAvailable) return;

        // Jalankan minimal 100 iterasi menggunakan fast-check
        await fc.assert(
          fc.asyncProperty(
            // Generator: 2-5 order values valid (0-99)
            fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 2, maxLength: 5 }),
            async (newOrders) => {
              // Setup: buat N seksi dengan order awal 0..N-1
              const created: Array<{ id: string; order: number }> = [];
              for (let i = 0; i < newOrders.length; i++) {
                const res = await request(app)
                  .post('/api/about')
                  .set('Authorization', `Bearer ${adminToken}`)
                  .send({ type: 'skill', title: `Skill ${Date.now()}-${i}`, order: i });
                created.push({ id: res.body.data.id, order: i });
              }

              const fakeId = '00000000-0000-0000-0000-000000000000';

              // Kirim reorder dengan satu id tidak valid di akhir
              const items = [
                ...created.map((s, idx) => ({ id: s.id, order: newOrders[idx] })),
                { id: fakeId, order: 999 },
              ];

              const reorderRes = await request(app)
                .patch('/api/about/reorder')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ items });

              // Harus 404 (transaksi gagal)
              expect(reorderRes.status).toBe(404);

              // Verifikasi rollback: order semua seksi tidak berubah dari nilai awal
              const getRes = await request(app).get('/api/about');
              const allSections = getRes.body.data as Array<{ id: string; order: number }>;

              for (const { id, order: originalOrder } of created) {
                const section = allSections.find((s) => s.id === id);
                expect(section).toBeDefined();
                // Order harus tetap di nilai awal (sebelum reorder yang gagal)
                expect(section!.order).toBe(originalOrder);
              }

              // Cleanup untuk iterasi berikutnya
              await cleanAboutTables();
            }
          ),
          { numRuns: 100 }
        );
      }
    );

    it(
      'untuk array dengan semua id valid, semua order diperbarui atomik (min 100 iterasi)',
      async () => {
        if (!dbAvailable) return;

        await fc.assert(
          fc.asyncProperty(
            // Generator: 2-4 distinct order values
            fc.uniqueArray(fc.integer({ min: 0, max: 50 }), {
              minLength: 2,
              maxLength: 4,
            }),
            async (orders) => {
              // Setup: buat N seksi
              const created: Array<{ id: string }> = [];
              for (let i = 0; i < orders.length; i++) {
                const res = await request(app)
                  .post('/api/about')
                  .set('Authorization', `Bearer ${adminToken}`)
                  .send({ type: 'contact', title: `Contact ${Date.now()}-${i}`, order: i });
                created.push({ id: res.body.data.id });
              }

              // Kirim reorder dengan semua id valid
              const items = created.map((s, idx) => ({ id: s.id, order: orders[idx] }));
              const reorderRes = await request(app)
                .patch('/api/about/reorder')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ items });

              // Harus sukses
              expect(reorderRes.status).toBe(200);

              // Verifikasi semua order diperbarui
              const getRes = await request(app).get('/api/about');
              const allSections = getRes.body.data as Array<{ id: string; order: number }>;

              for (let i = 0; i < created.length; i++) {
                const section = allSections.find((s) => s.id === created[i].id);
                expect(section).toBeDefined();
                expect(section!.order).toBe(orders[i]);
              }

              // Cleanup untuk iterasi berikutnya
              await cleanAboutTables();
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  }
);
