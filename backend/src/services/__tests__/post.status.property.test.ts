// Feature: personal-blog-website, Property 4: Status transition validity

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Module mocks (hoisted before real imports) ────────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// marked is imported transitively via mapPost; mock it to avoid ESM issues.
vi.mock('marked', () => ({
  marked: vi.fn().mockResolvedValue('<p>content</p>'),
}));

import prisma from '../../lib/prisma';
import { publishPost, unpublishPost } from '../post.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a minimal Prisma post row with a given status. */
function buildPrismaPost(id: string, status: 'published' | 'draft') {
  const now = new Date();
  return {
    id,
    title: 'Test Post',
    slug: 'test-post',
    content: '# Hello',
    status,
    publishedAt: status === 'published' ? now : null,
    createdAt: now,
    updatedAt: now,
    _count: { comments: 0 },
  };
}

/**
 * Arbitrary: generates a valid post ID (UUID-like string).
 * We use alphanumeric strings of length 10–36.
 */
const postIdArb = fc.stringOf(
  fc.mapToConstant(
    { num: 26, build: (n) => String.fromCharCode(97 + n) }, // a-z
    { num: 26, build: (n) => String.fromCharCode(65 + n) }, // A-Z
    { num: 10, build: (n) => String.fromCharCode(48 + n) }, // 0-9
    { num: 1, build: () => '-' },
  ),
  { minLength: 10, maxLength: 36 },
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 4: Status transition validity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Part 1: publishPost on an already-Published post ─────────────────────

  describe('publishPost on a post that is already Published', () => {
    /**
     * **Validates: Requirements 4.6**
     *
     * For any post ID whose current status is `published`, calling
     * `publishPost(id)` MUST throw an error with status 409 and code
     * `STATUS_CONFLICT`. The post status must not change (prisma.post.update
     * must never be called).
     */
    it('always throws 409 STATUS_CONFLICT and never mutates the post', async () => {
      await fc.assert(
        fc.asyncProperty(postIdArb, async (postId) => {
          vi.clearAllMocks();

          // The post already exists with status = published
          vi.mocked(prisma.post.findUnique).mockResolvedValue(
            buildPrismaPost(postId, 'published') as never,
          );

          let thrownError: (Error & { status?: number; code?: string }) | null = null;

          try {
            await publishPost(postId);
          } catch (err) {
            thrownError = err as Error & { status?: number; code?: string };
          }

          // Must have thrown
          expect(thrownError).not.toBeNull();

          // Must be a 409 STATUS_CONFLICT
          expect(thrownError?.status).toBe(409);
          expect(thrownError?.code).toBe('STATUS_CONFLICT');

          // The update must never have been called — status unchanged
          expect(prisma.post.update).not.toHaveBeenCalled();
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 2: unpublishPost on a post that is already Draft ────────────────

  describe('unpublishPost on a post that is already Draft', () => {
    /**
     * **Validates: Requirements 4.6**
     *
     * For any post ID whose current status is `draft`, calling
     * `unpublishPost(id)` MUST throw an error with status 409 and code
     * `STATUS_CONFLICT`. The post status must not change (prisma.post.update
     * must never be called).
     */
    it('always throws 409 STATUS_CONFLICT and never mutates the post', async () => {
      await fc.assert(
        fc.asyncProperty(postIdArb, async (postId) => {
          vi.clearAllMocks();

          // The post already exists with status = draft
          vi.mocked(prisma.post.findUnique).mockResolvedValue(
            buildPrismaPost(postId, 'draft') as never,
          );

          let thrownError: (Error & { status?: number; code?: string }) | null = null;

          try {
            await unpublishPost(postId);
          } catch (err) {
            thrownError = err as Error & { status?: number; code?: string };
          }

          // Must have thrown
          expect(thrownError).not.toBeNull();

          // Must be a 409 STATUS_CONFLICT
          expect(thrownError?.status).toBe(409);
          expect(thrownError?.code).toBe('STATUS_CONFLICT');

          // The update must never have been called — status unchanged
          expect(prisma.post.update).not.toHaveBeenCalled();
        }),
        { numRuns: 100 },
      );
    });
  });
});
