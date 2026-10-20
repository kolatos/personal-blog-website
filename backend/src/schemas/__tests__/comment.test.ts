import { describe, it, expect } from 'vitest';
import { CreateCommentSchema, CreateCommentLegacySchema } from '../comment.schema';
import { v4 as uuidv4 } from 'uuid';

// ─── Helper ───────────────────────────────────────────────────────────────────

const VALID_POST_ID = uuidv4();

// ─── CreateCommentSchema (generic endpoint) ───────────────────────────────────

describe('CreateCommentSchema (generic endpoint)', () => {
  describe('Input valid', () => {
    it('menerima komentar valid dengan semua field yang diperlukan', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
        content: 'Komentar valid.',
      });

      expect(result.success).toBe(true);
    });

    it('menerima semua nilai contentType yang valid', () => {
      for (const contentType of ['post', 'project', 'fun', 'module'] as const) {
        const result = CreateCommentSchema.safeParse({
          contentType,
          contentId: VALID_POST_ID,
          content: 'Komentar.',
        });

        expect(result.success).toBe(true);
      }
    });

    it('menerima parentId opsional yang valid (UUID)', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
        content: 'Balasan komentar.',
        parentId: VALID_POST_ID,
      });

      expect(result.success).toBe(true);
    });

    it('menerima parentId null', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
        content: 'Komentar level atas.',
        parentId: null,
      });

      expect(result.success).toBe(true);
    });

    it('menerima konten tepat 1 karakter', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
        content: 'a',
      });

      expect(result.success).toBe(true);
    });

    it('menerima konten tepat 2000 karakter', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
        content: 'a'.repeat(2000),
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Input tidak valid', () => {
    it('menolak tanpa contentType', () => {
      const result = CreateCommentSchema.safeParse({
        contentId: VALID_POST_ID,
        content: 'Komentar.',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain('required');
    });

    it('menolak contentType yang tidak valid', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'invalid-type',
        contentId: VALID_POST_ID,
        content: 'Komentar.',
      });

      expect(result.success).toBe(false);
    });

    it('menolak tanpa contentId', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        content: 'Komentar.',
      });

      expect(result.success).toBe(false);
    });

    it('menolak contentId yang bukan UUID', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: 'bukan-uuid',
        content: 'Komentar.',
      });

      expect(result.success).toBe(false);
    });

    it('menolak konten kosong', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content cannot be empty');
    });

    it('menolak konten melebihi 2000 karakter', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
        content: 'a'.repeat(2001),
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content must not exceed 2000 characters');
    });

    it('menolak konten hanya spasi', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
        content: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content cannot consist of only whitespace');
    });

    it('menolak konten tanpa field content', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content is required');
    });

    it('menolak parentId yang bukan UUID', () => {
      const result = CreateCommentSchema.safeParse({
        contentType: 'post',
        contentId: VALID_POST_ID,
        content: 'Komentar.',
        parentId: 'bukan-uuid',
      });

      expect(result.success).toBe(false);
    });
  });
});

// ─── CreateCommentLegacySchema (backward-compat endpoint) ────────────────────

describe('CreateCommentLegacySchema (legacy /api/posts/:postId/comments)', () => {
  describe('Input valid', () => {
    it('menerima input valid hanya dengan content', () => {
      const result = CreateCommentLegacySchema.safeParse({
        content: 'a',
      });

      expect(result.success).toBe(true);
    });

    it('menerima konten tepat 2000 karakter', () => {
      const result = CreateCommentLegacySchema.safeParse({
        content: 'a'.repeat(2000),
      });

      expect(result.success).toBe(true);
    });

    it('menerima konten pendek yang valid', () => {
      const result = CreateCommentLegacySchema.safeParse({
        content: 'This is a comment',
      });

      expect(result.success).toBe(true);
    });

    it('menerima konten dengan spasi di awal dan akhir', () => {
      const result = CreateCommentLegacySchema.safeParse({
        content: '  test comment  ',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Input tidak valid', () => {
    it('menolak konten kosong', () => {
      const result = CreateCommentLegacySchema.safeParse({
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content cannot be empty');
    });

    it('menolak konten melebihi 2000 karakter', () => {
      const result = CreateCommentLegacySchema.safeParse({
        content: 'a'.repeat(2001),
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content must not exceed 2000 characters');
    });

    it('menolak tanpa field content', () => {
      const result = CreateCommentLegacySchema.safeParse({});

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content is required');
    });

    it('menolak konten hanya spasi', () => {
      const result = CreateCommentLegacySchema.safeParse({
        content: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content cannot consist of only whitespace');
    });

    it('menolak konten hanya spasi dengan karakter whitespace campuran', () => {
      const result = CreateCommentLegacySchema.safeParse({
        content: '\t\n  ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content cannot consist of only whitespace');
    });
  });
});
