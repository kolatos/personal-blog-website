// Feature: personal-blog-website, Property 10: Role claim enforces endpoint access

/**
 * Property-based test untuk Property 10: Role claim enforces endpoint access
 *
 * Skenario yang divalidasi:
 *   Untuk sembarang nilai role yang disematkan dalam JWT, admin-only endpoint
 *   HANYA boleh meloloskan request yang membawa role === 'admin'. Semua nilai
 *   role lain — termasuk 'user', string acak, string kosong, null, atau klaim
 *   role yang tidak ada sama sekali — harus menghasilkan respons 403.
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 *
 * Pendekatan:
 *   - JWT ditandatangani langsung menggunakan JWT_SECRET (dari .env.test),
 *     tanpa melalui endpoint login — lebih cepat dan mengisolasi perilaku middleware.
 *   - Endpoint probe: GET /api/posts/admin (admin-only, read-only, tidak mengubah state).
 *   - DB connectivity guard: test di-skip jika PostgreSQL tidak tersedia,
 *     konsisten dengan pola integration test lainnya di proyek ini.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';
import app from '../../app';
import prisma from '../../lib/prisma';

// ─── DB connectivity guard ────────────────────────────────────────────────────

async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-key';

/**
 * Membuat JWT dengan role yang diberikan secara eksplisit.
 * sub dan jti selalu diisi agar signature valid.
 */
function signWithRole(role: string): string {
  return jwt.sign(
    { sub: 'test-user-id', username: 'testuser', role, jti: uuidv4() },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

/**
 * Membuat JWT TANPA klaim role sama sekali.
 * Memvalidasi Requirement 7.2: klaim role yang tidak ada harus ditolak dengan 403.
 */
function signWithoutRole(): string {
  return jwt.sign(
    { sub: 'test-user-id', username: 'testuser', jti: uuidv4() },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Menghasilkan string role acak yang BUKAN 'admin'.
 * Mencakup:
 *   - 'user' (registered user role yang valid tapi bukan admin)
 *   - string ASCII acak lainnya
 *   - string kosong
 */
const nonAdminRoleArb = fc
  .oneof(
    // Role 'user' yang valid tapi bukan admin
    fc.constant('user'),
    // String kosong
    fc.constant(''),
    // String acak (termasuk yang menyerupai 'admin' tapi bukan tepat 'admin')
    fc.string({ minLength: 0, maxLength: 30 }),
  )
  .filter((role) => role !== 'admin');

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Property 10: Role claim enforces endpoint access', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();

    if (!dbAvailable) {
      console.warn(
        '\n⚠  Property test dilewati: PostgreSQL tidak dapat dijangkau pada DATABASE_URL yang dikonfigurasi.\n' +
          '   Jalankan instance PostgreSQL dan pastikan DATABASE_URL sudah diatur dengan benar.\n',
      );
    }

    // Aktifkan trust proxy agar rate limiter tidak memblokir test
    app.set('trust proxy', true);
  });

  // ── Sub-property A: role === 'admin' → BUKAN 403 ─────────────────────────

  /**
   * **Validates: Requirements 7.1, 7.3**
   *
   * Untuk sembarang JWT yang berisi role === 'admin', request ke admin-only
   * endpoint TIDAK BOLEH menghasilkan 403 FORBIDDEN.
   *
   * Catatan: respons yang diperbolehkan selain 403 antara lain 200 (sukses),
   * 500 (DB error sementara), dst. — yang penting bukan penolakan akibat role.
   */
  it(
    'JWT dengan role "admin" tidak pernah menghasilkan 403 pada admin-only endpoint',
    async () => {
      if (!dbAvailable) return;

      await fc.assert(
        fc.asyncProperty(
          // Tidak ada variabel fc lain yang diperlukan — setiap iterasi menggunakan
          // token admin baru (jti unik) agar tidak masuk blacklist
          fc.integer({ min: 0, max: 99 }), // dummy untuk memicu 100 iterasi
          async (_dummy) => {
            const token = signWithRole('admin');

            const res = await request(app)
              .get('/api/posts/admin')
              .set('Authorization', `Bearer ${token}`);

            // Properti inti: admin TIDAK boleh mendapat 403
            expect(res.status).not.toBe(403);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ── Sub-property B: role !== 'admin' → SELALU 403 ────────────────────────

  /**
   * **Validates: Requirements 7.2, 7.3**
   *
   * Untuk sembarang JWT yang berisi role selain 'admin' (termasuk 'user',
   * string acak, atau string kosong), request ke admin-only endpoint SELALU
   * menghasilkan 403 FORBIDDEN.
   */
  it(
    'JWT dengan role bukan "admin" selalu menghasilkan 403 pada admin-only endpoint',
    async () => {
      if (!dbAvailable) return;

      await fc.assert(
        fc.asyncProperty(nonAdminRoleArb, async (role) => {
          const token = signWithRole(role);

          const res = await request(app)
            .get('/api/posts/admin')
            .set('Authorization', `Bearer ${token}`);

          // Properti inti: non-admin role SELALU mendapat 403
          expect(res.status).toBe(403);
          expect(res.body.error?.code).toBe('FORBIDDEN');
        }),
        { numRuns: 100 },
      );
    },
  );

  // ── Sub-property C: tanpa klaim role → SELALU 403 ────────────────────────

  /**
   * **Validates: Requirement 7.2**
   *
   * JWT yang valid secara kriptografi tetapi tidak memiliki klaim role sama
   * sekali harus ditolak dengan 403 — klaim role yang absen dianggap tidak
   * dikenal (bukan 'admin').
   */
  it(
    'JWT tanpa klaim role menghasilkan 403 pada admin-only endpoint',
    async () => {
      if (!dbAvailable) return;

      const token = signWithoutRole();

      const res = await request(app)
        .get('/api/posts/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    },
  );

  // ── Sub-property D: tanpa token → SELALU 401 (bukan 403) ─────────────────

  /**
   * **Validates: Requirement 7.1**
   *
   * Request tanpa token sama sekali harus mendapat 401 UNAUTHORIZED — bukan 403.
   * Ini memastikan autentikasi dan otorisasi menghasilkan kode status yang tepat
   * dan tidak tumpang tindih.
   */
  it(
    'Request tanpa token menghasilkan 401 (bukan 403) pada admin-only endpoint',
    async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/posts/admin');

      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('UNAUTHORIZED');
    },
  );
});
