// Feature: personal-blog-website, Property 5: Post deletion cascades to comments

/**
 * Property 5: Post deletion cascades to comments
 * Validates: Requirements 4.3
 *
 * Untuk sembarang post dengan satu atau lebih komentar, setelah post dihapus
 * melalui PostService.deletePost(), semua komentar yang terkait juga harus
 * tidak ada di database (enforced via FK ON DELETE CASCADE).
 *
 * Ini adalah integration property test — memerlukan PostgreSQL yang berjalan
 * dan dapat diakses melalui DATABASE_URL yang dikonfigurasi di .env.test.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { deletePost } from '../post.service';

// ─── Connectivity guard ───────────────────────────────────────────────────────

async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ─── Test state ───────────────────────────────────────────────────────────────

let dbAvailable = false;
let testAuthorId: string;

// ID unik untuk mengisolasi data test ini dari test lain yang berjalan bersama
const TEST_USER_EMAIL = `cascade-prop-test-${Date.now()}@example.com`;
const TEST_USER_USERNAME = `cascade-prop-${Date.now()}`;

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    console.warn(
      '\n⚠  Property test (cascade) dilewati: PostgreSQL tidak dapat dijangkau.\n' +
        '   Jalankan instance PostgreSQL dan pastikan DATABASE_URL sudah diatur dengan benar.\n'
    );
    return;
  }

  // Buat satu test user yang akan dipakai sebagai author komentar di semua iterasi
  const passwordHash = await bcrypt.hash('TestPassword123!', 12);
  const author = await prisma.user.create({
    data: {
      username: TEST_USER_USERNAME,
      email: TEST_USER_EMAIL,
      passwordHash,
      role: 'user',
    },
  });
  testAuthorId = author.id;
});

afterAll(async () => {
  if (!dbAvailable) return;

  // Hapus semua data test yang dibuat oleh suite ini
  // Urutan: comments → posts → user (FK constraints)
  // Komentar sudah terhapus via cascade, tapi cleanup eksplisit untuk keamanan
  await prisma.comment.deleteMany({
    where: { authorId: testAuthorId },
  });
  // Post bisa saja tertinggal jika ada iterasi yang gagal sebelum deletePost
  await prisma.post.deleteMany({
    where: {
      // Hapus semua post yang mungkin tersisa dengan slug yang dibuat test ini
      slug: { startsWith: 'cascade-test-post-' },
    },
  });
  await prisma.user.deleteMany({
    where: { id: testAuthorId },
  });
  await prisma.$disconnect();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Membuat post baru di DB dengan slug unik berdasarkan timestamp + random.
 */
async function createTestPost(): Promise<string> {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const post = await prisma.post.create({
    data: {
      title: `Cascade Test Post ${uniqueSuffix}`,
      slug: `cascade-test-post-${uniqueSuffix}`,
      content: 'Konten test untuk cascade property test.',
      status: 'published',
      publishedAt: new Date(),
    },
  });
  return post.id;
}

/**
 * Membuat N komentar pada post tertentu menggunakan testAuthorId.
 */
async function createComments(postId: string, count: number): Promise<void> {
  const comments = Array.from({ length: count }, (_, i) => ({
    postId,
    authorId: testAuthorId,
    content: `Komentar test ke-${i + 1}`,
  }));
  await prisma.comment.createMany({ data: comments });
}

// ─── Property tests ───────────────────────────────────────────────────────────

describe('Property 5: Post deletion cascades to comments', () => {
  /**
   * **Validates: Requirements 4.3**
   *
   * Untuk sembarang post dengan antara 1 sampai 10 komentar, setelah post
   * dihapus via deletePost(), jumlah komentar dengan post_id tersebut di
   * database harus nol — cascade delete FK constraint bekerja dengan benar.
   */
  it(
    'menghapus semua komentar yang terkait ketika post dihapus, untuk 1–10 komentar',
    async () => {
      if (!dbAvailable) {
        console.warn('Test dilewati: database tidak tersedia.');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          // Hasilkan bilangan bulat antara 1 dan 10 (jumlah komentar)
          fc.integer({ min: 1, max: 10 }),
          async (commentCount) => {
            // (a) Buat post baru
            const postId = await createTestPost();

            // (b) Buat commentCount komentar pada post tersebut
            await createComments(postId, commentCount);

            // (c) Verifikasi komentar sudah ada sebelum penghapusan
            const before = await prisma.comment.count({ where: { postId } });
            expect(before).toBe(commentCount);

            // (d) Hapus post via PostService
            await deletePost(postId);

            // (e) Verifikasi semua komentar sudah terhapus (cascade)
            const after = await prisma.comment.count({ where: { postId } });
            expect(after).toBe(0);

            // (f) Verifikasi post itu sendiri sudah tidak ada
            const deletedPost = await prisma.post.findUnique({ where: { id: postId } });
            expect(deletedPost).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    },
    // Timeout diperpanjang karena 100 iterasi masing-masing melakukan operasi DB
    120_000,
  );

  /**
   * **Validates: Requirements 4.3**
   *
   * Verifikasi edge case: post tanpa komentar sama sekali — deletePost() tetap
   * berhasil dan tidak ada error FK violation.
   */
  it(
    'menghapus post tanpa komentar tanpa error',
    async () => {
      if (!dbAvailable) {
        console.warn('Test dilewati: database tidak tersedia.');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.constant(0),
          async () => {
            // Buat post kosong (tanpa komentar)
            const postId = await createTestPost();

            // Hapus langsung tanpa komentar
            await deletePost(postId);

            // Post harus sudah terhapus
            const deletedPost = await prisma.post.findUnique({ where: { id: postId } });
            expect(deletedPost).toBeNull();

            // Jumlah komentar dengan postId ini harus nol (tidak ada yang dibuat)
            const commentCount = await prisma.comment.count({ where: { postId } });
            expect(commentCount).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    },
    120_000,
  );
});
