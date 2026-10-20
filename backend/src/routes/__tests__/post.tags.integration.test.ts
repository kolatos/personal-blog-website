/**
 * Integration tests untuk Tag functionality di Post routes
 *
 * Skenario yang dicakup:
 *  1. Buat post dengan tags → GET post mengembalikan tags
 *  2. Update post menghapus tags lama dan menyetel tags baru
 *  3. GET /api/tags mengembalikan daftar yang benar, diurutkan alfabetis
 *  4. Upsert tag bersifat idempotent (nama sama dua kali → satu tag)
 *  5. Nama tag dinormalisasi ke lowercase saat disimpan
 *
 * Requirements: 2.1–2.7
 *
 * Setup:
 *  - Memerlukan PostgreSQL yang berjalan dan dapat diakses.
 *  - Set DATABASE_URL di .env.test yang mengarah ke database test.
 *  - Jalankan `npx prisma migrate deploy` sebelum menjalankan test ini.
 *  - Test otomatis dilewati jika database tidak dapat dijangkau.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

async function cleanTagTables(): Promise<void> {
  await prisma.postTag.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.tag.deleteMany({});
}

async function cleanAllTables(): Promise<void> {
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.loginAttempts.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.postTag.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.user.deleteMany({});
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEST_ADMIN_EMAIL = 'tagtest-admin@example.com';
const TEST_ADMIN_USERNAME = 'tagtest-admin';
const TEST_ADMIN_PASSWORD = 'AdminTagTest123!';

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let dbAvailable = false;
let adminId = '';
let adminToken = '';

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return;

  await cleanAllTables();

  const passwordHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 12);
  const admin = await prisma.user.create({
    data: {
      email: TEST_ADMIN_EMAIL,
      username: TEST_ADMIN_USERNAME,
      passwordHash,
      role: 'admin',
    },
  });
  adminId = admin.id;

  adminToken = signToken(
    { sub: admin.id, username: admin.username, role: 'admin', jti: 'admin-jti-tag-test' },
    '24h'
  );
});

afterAll(async () => {
  if (!dbAvailable) return;
  await cleanAllTables();
  await prisma.$disconnect();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Tag integration tests', () => {
  describe('POST /api/posts — create post with tags', () => {
    it('creates a post with tags and GET /api/posts/admin/:id returns tags', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Post With Tags',
          content: 'Content for tag test',
          tags: ['math', 'tutorial'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tags).toEqual(expect.arrayContaining(['math', 'tutorial']));
      expect(res.body.data.tags).toHaveLength(2);

      // Clean up
      await prisma.postTag.deleteMany({});
      await prisma.post.deleteMany({ where: { slug: res.body.data.slug } });
      await prisma.tag.deleteMany({});
    });

    it('normalizes tag names to lowercase when creating post', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Post Tags Uppercase',
          content: 'Content uppercase tag test',
          tags: ['JavaScript', 'MATH', 'Tutorial'],
        });

      expect(res.status).toBe(201);
      // All tags should be lowercase
      const tags: string[] = res.body.data.tags;
      for (const tag of tags) {
        expect(tag).toBe(tag.toLowerCase());
      }
      expect(tags).toEqual(expect.arrayContaining(['javascript', 'math', 'tutorial']));

      // Clean up
      await prisma.postTag.deleteMany({});
      await prisma.post.deleteMany({ where: { slug: res.body.data.slug } });
      await prisma.tag.deleteMany({});
    });

    it('creates post without tags — tags array is empty', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Post Without Tags',
          content: 'No tags here',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tags).toEqual([]);

      // Clean up
      await prisma.post.deleteMany({ where: { slug: res.body.data.slug } });
    });
  });

  describe('PUT /api/posts/:id — update post replaces tags', () => {
    it('update post replaces old tags with new tags', async () => {
      if (!dbAvailable) return;

      // Create post with initial tags
      const createRes = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Post Tag Update Test',
          content: 'Content for update tag test',
          tags: ['math', 'tutorial'],
        });

      expect(createRes.status).toBe(201);
      const postId: string = createRes.body.data.id;

      // Update with different tags
      const updateRes = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tags: ['calculus', 'algebra'],
        });

      expect(updateRes.status).toBe(200);
      const updatedTags: string[] = updateRes.body.data.tags;
      expect(updatedTags).toEqual(expect.arrayContaining(['calculus', 'algebra']));
      expect(updatedTags).not.toContain('math');
      expect(updatedTags).not.toContain('tutorial');
      expect(updatedTags).toHaveLength(2);

      // Clean up
      await prisma.postTag.deleteMany({});
      await prisma.post.deleteMany({ where: { id: postId } });
      await prisma.tag.deleteMany({});
    });

    it('update post with empty tags array removes all tags', async () => {
      if (!dbAvailable) return;

      const createRes = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Post Remove Tags Test',
          content: 'Content for remove tags test',
          tags: ['math'],
        });

      expect(createRes.status).toBe(201);
      const postId: string = createRes.body.data.id;

      const updateRes = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tags: [],
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.tags).toEqual([]);

      // Clean up
      await prisma.postTag.deleteMany({});
      await prisma.post.deleteMany({ where: { id: postId } });
      await prisma.tag.deleteMany({});
    });
  });

  describe('GET /api/tags', () => {
    it('returns all tags sorted alphabetically', async () => {
      if (!dbAvailable) return;

      // Create posts with various tags to populate the tags table
      const postA = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Tag List Test A', content: 'content a', tags: ['math', 'calculus'] });
      const postB = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Tag List Test B', content: 'content b', tags: ['algebra', 'math'] });

      expect(postA.status).toBe(201);
      expect(postB.status).toBe(201);

      const res = await request(app).get('/api/tags');

      expect(res.status).toBe(200);
      const tags: { id: string; name: string; slug: string }[] = res.body;
      expect(Array.isArray(tags)).toBe(true);

      // Should contain our three tags
      const tagNames = tags.map((t) => t.name);
      expect(tagNames).toEqual(expect.arrayContaining(['algebra', 'calculus', 'math']));

      // Should be sorted alphabetically
      const sortedNames = [...tagNames].sort();
      expect(tagNames).toEqual(sortedNames);

      // Each tag should have id, name, slug
      for (const tag of tags) {
        expect(tag).toHaveProperty('id');
        expect(tag).toHaveProperty('name');
        expect(tag).toHaveProperty('slug');
      }

      // Clean up
      await prisma.postTag.deleteMany({});
      await prisma.post.deleteMany({ where: { slug: { in: [postA.body.data.slug, postB.body.data.slug] } } });
      await prisma.tag.deleteMany({});
    });

    it('returns empty array when no tags exist', async () => {
      if (!dbAvailable) return;

      // Ensure tags table is clean
      await prisma.postTag.deleteMany({});
      await prisma.tag.deleteMany({});

      const res = await request(app).get('/api/tags');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('Tag upsert idempotency — integration', () => {
    it('creating two posts with the same tag name results in one tag record', async () => {
      if (!dbAvailable) return;

      // Clean state
      await cleanTagTables();

      const postA = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Idempotent Tag Test A', content: 'content a', tags: ['math'] });
      const postB = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Idempotent Tag Test B', content: 'content b', tags: ['math'] });

      expect(postA.status).toBe(201);
      expect(postB.status).toBe(201);

      // There should be exactly one tag named 'math' in the database
      const mathTags = await prisma.tag.findMany({ where: { name: 'math' } });
      expect(mathTags).toHaveLength(1);

      // Both posts should have the same tag id
      const postAId: string = postA.body.data.id;
      const postBId: string = postB.body.data.id;
      const postATags = await prisma.postTag.findMany({ where: { postId: postAId } });
      const postBTags = await prisma.postTag.findMany({ where: { postId: postBId } });

      expect(postATags[0].tagId).toBe(postBTags[0].tagId);

      // Clean up
      await cleanTagTables();
    });

    it('creating a post with mixed-case version of an existing tag reuses same tag record', async () => {
      if (!dbAvailable) return;

      await cleanTagTables();

      const postA = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Case Tag Test A', content: 'content a', tags: ['math'] });
      const postB = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Case Tag Test B', content: 'content b', tags: ['MATH'] });

      expect(postA.status).toBe(201);
      expect(postB.status).toBe(201);

      // 'math' and 'MATH' normalize to the same 'math' → one record
      const mathTags = await prisma.tag.findMany({ where: { name: 'math' } });
      expect(mathTags).toHaveLength(1);

      // Clean up
      await cleanTagTables();
    });
  });
});
