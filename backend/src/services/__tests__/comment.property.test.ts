// Feature: personal-blog-website, Property 7: Comment ownership enforcement

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Module mocks (hoisted before real imports) ────────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    comment: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';
import { deleteComment } from '../comment.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a minimal Prisma comment row. */
function buildPrismaComment(id: string, authorId: string) {
  return {
    id,
    postId: 'post-1',
    authorId,
    content: 'Test comment',
    createdAt: new Date(),
  };
}

/**
 * Arbitrary: generates a UUID-like string (alphanumeric + hyphens, 10–36 chars).
 */
const idArb = fc.stringOf(
  fc.mapToConstant(
    { num: 26, build: (n) => String.fromCharCode(97 + n) }, // a-z
    { num: 26, build: (n) => String.fromCharCode(65 + n) }, // A-Z
    { num: 10, build: (n) => String.fromCharCode(48 + n) }, // 0-9
    { num: 1, build: () => '-' },
  ),
  { minLength: 10, maxLength: 36 },
);

/** Arbitrary: generates either 'admin' or 'user' role. */
const roleArb = fc.oneof(fc.constant('admin'), fc.constant('user'));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 7: Comment ownership enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Part 1: Comment owner can always delete their own comment ─────────────

  describe('comment owner deleting their own comment', () => {
    /**
     * **Validates: Requirements 6.3**
     *
     * For any (commentId, userId, role) where requesterId === comment.authorId,
     * deleteComment MUST succeed (resolve without throwing) and call
     * prisma.comment.delete exactly once.
     */
    it('always succeeds when requesterId equals comment.authorId', async () => {
      await fc.assert(
        fc.asyncProperty(idArb, idArb, roleArb, async (commentId, userId, role) => {
          vi.clearAllMocks();

          // The comment exists and its authorId matches the requester
          vi.mocked(prisma.comment.findUnique).mockResolvedValue(
            buildPrismaComment(commentId, userId) as never,
          );
          vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

          // Should not throw
          await expect(
            deleteComment(commentId, userId, role),
          ).resolves.toBeUndefined();

          // delete must have been called exactly once
          expect(prisma.comment.delete).toHaveBeenCalledOnce();
          expect(prisma.comment.delete).toHaveBeenCalledWith({
            where: { id: commentId },
          });
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 2: Admin can always delete any comment ───────────────────────────

  describe('admin deleting any comment regardless of authorship', () => {
    /**
     * **Validates: Requirements 6.5**
     *
     * For any (commentId, adminId, ownerId) where adminId !== ownerId and
     * requesterRole === 'admin', deleteComment MUST succeed and call
     * prisma.comment.delete exactly once.
     */
    it('always succeeds when requesterRole is admin, even if not the author', async () => {
      await fc.assert(
        fc.asyncProperty(
          idArb,
          idArb,
          idArb,
          async (commentId, adminId, ownerId) => {
            // Ensure the admin is not the owner to test the pure admin-role path
            fc.pre(adminId !== ownerId);

            vi.clearAllMocks();

            // Comment belongs to ownerId, but requester is adminId
            vi.mocked(prisma.comment.findUnique).mockResolvedValue(
              buildPrismaComment(commentId, ownerId) as never,
            );
            vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

            await expect(
              deleteComment(commentId, adminId, 'admin'),
            ).resolves.toBeUndefined();

            expect(prisma.comment.delete).toHaveBeenCalledOnce();
            expect(prisma.comment.delete).toHaveBeenCalledWith({
              where: { id: commentId },
            });
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 3: Non-owner non-admin always gets 403 ───────────────────────────

  describe('non-owner, non-admin attempting to delete a comment', () => {
    /**
     * **Validates: Requirements 6.4**
     *
     * For any (commentId, requesterId, ownerId) where requesterId !== ownerId
     * and requesterRole !== 'admin', deleteComment MUST throw an error with
     * status 403 and code FORBIDDEN, and prisma.comment.delete must NOT be called.
     */
    it('always throws 403 FORBIDDEN and never deletes the comment', async () => {
      await fc.assert(
        fc.asyncProperty(
          idArb,
          idArb,
          idArb,
          async (commentId, requesterId, ownerId) => {
            // Ensure requesterId differs from ownerId
            fc.pre(requesterId !== ownerId);

            vi.clearAllMocks();

            // Comment belongs to a different user
            vi.mocked(prisma.comment.findUnique).mockResolvedValue(
              buildPrismaComment(commentId, ownerId) as never,
            );

            let thrownError: (Error & { status?: number; code?: string }) | null = null;

            try {
              await deleteComment(commentId, requesterId, 'user');
            } catch (err) {
              thrownError = err as Error & { status?: number; code?: string };
            }

            // Must have thrown
            expect(thrownError).not.toBeNull();

            // Must be 403 FORBIDDEN
            expect(thrownError?.status).toBe(403);
            expect(thrownError?.code).toBe('FORBIDDEN');

            // delete must never have been called — comment is unchanged
            expect(prisma.comment.delete).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Part 4: Both owner and admin paths succeed; only strangers are rejected ─

  describe('combined ownership check: owner OR admin succeeds, anyone else fails', () => {
    /**
     * **Validates: Requirements 6.3, 6.4, 6.5**
     *
     * For any combination of (commentId, requesterId, requesterRole, ownerId):
     * - If requesterId === ownerId → deletion succeeds
     * - If requesterRole === 'admin' → deletion succeeds
     * - Otherwise → throws 403 FORBIDDEN
     * This single property covers the entire authorization decision table.
     */
    it('applies the correct authorization decision for every input combination', async () => {
      await fc.assert(
        fc.asyncProperty(
          idArb,
          idArb,
          idArb,
          roleArb,
          async (commentId, requesterId, ownerId, role) => {
            vi.clearAllMocks();

            vi.mocked(prisma.comment.findUnique).mockResolvedValue(
              buildPrismaComment(commentId, ownerId) as never,
            );
            vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

            const isOwner = requesterId === ownerId;
            const isAdmin = role === 'admin';
            const shouldSucceed = isOwner || isAdmin;

            if (shouldSucceed) {
              await expect(
                deleteComment(commentId, requesterId, role),
              ).resolves.toBeUndefined();

              expect(prisma.comment.delete).toHaveBeenCalledOnce();
            } else {
              let thrownError: (Error & { status?: number; code?: string }) | null = null;

              try {
                await deleteComment(commentId, requesterId, role);
              } catch (err) {
                thrownError = err as Error & { status?: number; code?: string };
              }

              expect(thrownError).not.toBeNull();
              expect(thrownError?.status).toBe(403);
              expect(thrownError?.code).toBe('FORBIDDEN');
              expect(prisma.comment.delete).not.toHaveBeenCalled();
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
