// Feature: personal-blog-website, Property 8: Comment content validation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Module mocks (hoisted before real imports) ────────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    post: {
      findUnique: vi.fn(),
    },
    comment: {
      create: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';
import { addCommentToPost } from '../comment.service';
import { CreateCommentLegacySchema } from '../../schemas/comment.schema';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a minimal published post Prisma row. */
function buildPublishedPost(postId: string) {
  return {
    id: postId,
    status: 'published',
  };
}

/** Builds a minimal comment Prisma row returned after create. */
function buildCreatedComment(postId: string, authorId: string, content: string) {
  return {
    id: 'comment-id-1',
    contentType: 'post',
    contentId: postId,
    authorId,
    content,
    parentId: null,
    createdAt: new Date(),
    author: { id: authorId, username: 'testuser' },
    replies: [],
  };
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates valid comment content: strings between 1 and 2000 characters,
 * with at least one non-whitespace character (to pass the trim().length > 0 check).
 */
const validContentArb = fc
  .string({ minLength: 1, maxLength: 2000 })
  .filter((s) => s.trim().length > 0);

/**
 * Generates empty string (the empty content boundary case).
 */
const emptyContentArb = fc.constant('');

/**
 * Generates content that is too long: strings exceeding 2000 characters.
 */
const tooLongContentArb = fc.string({ minLength: 2001, maxLength: 3000 });

/**
 * Generates whitespace-only content (non-empty string but all whitespace).
 */
const whitespaceOnlyContentArb = fc
  .stringOf(
    fc.mapToConstant(
      { num: 1, build: () => ' ' },
      { num: 1, build: () => '\t' },
      { num: 1, build: () => '\n' },
    ),
    { minLength: 1, maxLength: 100 },
  );

/**
 * Generates content that is invalid: either empty, whitespace-only, or too long.
 */
const invalidContentArb = fc.oneof(
  emptyContentArb,
  tooLongContentArb,
  whitespaceOnlyContentArb,
);

/** Generates a UUID-like ID. */
const idArb = fc.uuid();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 8: Comment content validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Part 1: Schema accepts valid content ───────────────────────────────────

  describe('schema validation: valid content (1–2000 non-whitespace chars)', () => {
    /**
     * **Validates: Requirements 6.1**
     *
     * For any non-empty string of 1–2000 characters that has at least one
     * non-whitespace character, CreateCommentSchema.safeParse MUST return
     * success: true.
     */
    it('always accepts content within 1–2000 characters', () => {
      fc.assert(
        fc.property(validContentArb, (content) => {
          const result = CreateCommentLegacySchema.safeParse({ content });
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 2: Schema rejects empty content ──────────────────────────────────

  describe('schema validation: empty content', () => {
    /**
     * **Validates: Requirements 6.7**
     *
     * An empty string MUST be rejected by CreateCommentSchema with a validation
     * error that indicates the min-length boundary was violated.
     */
    it('always rejects empty string with a validation error', () => {
      const result = CreateCommentLegacySchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.errors.map((e) => e.message);
        expect(messages.some((m) => /empty|cannot be empty|required|min/i.test(m))).toBe(true);
      }
    });
  });

  // ── Part 3: Schema rejects content exceeding 2000 characters ──────────────

  describe('schema validation: content exceeding 2000 characters', () => {
    /**
     * **Validates: Requirements 6.7**
     *
     * For any string exceeding 2000 characters, CreateCommentSchema.safeParse
     * MUST return success: false and include a message indicating the max-length
     * boundary was violated.
     */
    it('always rejects content longer than 2000 characters', () => {
      fc.assert(
        fc.property(tooLongContentArb, (content) => {
          const result = CreateCommentLegacySchema.safeParse({ content });
          expect(result.success).toBe(false);
          if (!result.success) {
            const messages = result.error.errors.map((e) => e.message);
            expect(
              messages.some((m) => /exceed|2000|max|too long/i.test(m)),
            ).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 4: Schema rejects whitespace-only content ────────────────────────

  describe('schema validation: whitespace-only content', () => {
    /**
     * **Validates: Requirements 6.7**
     *
     * For any string composed entirely of whitespace characters, even if
     * its length is within 1–2000, CreateCommentSchema.safeParse MUST return
     * success: false because trim().length === 0.
     */
    it('always rejects whitespace-only content with a validation error', () => {
      fc.assert(
        fc.property(whitespaceOnlyContentArb, (content) => {
          const result = CreateCommentLegacySchema.safeParse({ content });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 5: Schema IF-AND-ONLY-IF property ────────────────────────────────

  describe('iff property: stored if and only if content is 1–2000 non-whitespace chars', () => {
    /**
     * **Validates: Requirements 6.1, 6.7**
     *
     * For any comment content string, CreateCommentSchema.safeParse returns
     * success if and only if the content satisfies ALL of these conditions:
     *   - length >= 1
     *   - length <= 2000
     *   - trim().length >= 1 (at least one non-whitespace character)
     *
     * This is the core biconditional property: valid ↔ stored.
     */
    it('succeeds iff content length is 1–2000 and has non-whitespace characters', () => {
      // Test the full IFF property across the valid range and boundary cases
      const allContentArb = fc.oneof(
        validContentArb,
        invalidContentArb,
        // Explicit boundary: exactly 2000 chars (valid edge)
        fc.constant('a'.repeat(2000)),
        // Explicit boundary: exactly 2001 chars (invalid edge)
        fc.constant('a'.repeat(2001)),
        // Explicit boundary: exactly 1 char (valid edge)
        fc.constant('a'),
      );

      fc.assert(
        fc.property(allContentArb, (content) => {
          const isValid =
            content.length >= 1 &&
            content.length <= 2000 &&
            content.trim().length > 0;

          const result = CreateCommentLegacySchema.safeParse({ content });
          expect(result.success).toBe(isValid);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 6: Service stores comment for valid content ──────────────────────

  describe('service layer: addComment stores comment when content is valid', () => {
    /**
     * **Validates: Requirements 6.1**
     *
     * For any valid content (1–2000 chars, non-whitespace), addComment MUST
     * call prisma.comment.create and return the stored comment with the
     * same content that was passed in.
     */
    it('stores the comment and returns it when content is valid', async () => {
      await fc.assert(
        fc.asyncProperty(idArb, idArb, validContentArb, async (postId, authorId, content) => {
          vi.clearAllMocks();

          vi.mocked(prisma.post.findUnique).mockResolvedValue(
            buildPublishedPost(postId) as never,
          );
          vi.mocked(prisma.comment.create).mockResolvedValue(
            buildCreatedComment(postId, authorId, content) as never,
          );

          const result = await addCommentToPost(postId, authorId, content);

          // comment.create must have been called with the provided content
          expect(prisma.comment.create).toHaveBeenCalledOnce();
          expect(prisma.comment.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({ contentType: 'post', contentId: postId, authorId, content }),
            })
          );

          // The returned comment must carry the same content
          expect(result.content).toBe(content);
          expect(result.contentId).toBe(postId);
          expect(result.authorId).toBe(authorId);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 7: Boundary values ────────────────────────────────────────────────

  describe('boundary values: exact limits of 1 and 2000 characters', () => {
    /**
     * **Validates: Requirements 6.1, 6.7**
     *
     * The boundary values at exactly 1 and exactly 2000 non-whitespace
     * characters MUST be accepted; 0 and 2001 MUST be rejected.
     */
    it('accepts exactly 1 character', () => {
      const result = CreateCommentLegacySchema.safeParse({ content: 'a' });
      expect(result.success).toBe(true);
    });

    it('accepts exactly 2000 characters', () => {
      const result = CreateCommentLegacySchema.safeParse({ content: 'a'.repeat(2000) });
      expect(result.success).toBe(true);
    });

    it('rejects 0 characters (empty string)', () => {
      const result = CreateCommentLegacySchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });

    it('rejects exactly 2001 characters', () => {
      const result = CreateCommentLegacySchema.safeParse({ content: 'a'.repeat(2001) });
      expect(result.success).toBe(false);
    });
  });
});
