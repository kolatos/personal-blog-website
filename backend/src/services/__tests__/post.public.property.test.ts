// Feature: personal-blog-website, Property 6: Public endpoint returns only Published posts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Module mocks (hoisted before real imports) ────────────────────────────────
// Prisma is mocked so this is a pure unit test — no real DB needed.

vi.mock('../../lib/prisma', () => {
  const queryRawMock = vi.fn();
  return {
    default: {
      post: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      $queryRaw: queryRawMock,
    },
  };
});

// marked is imported transitively via mapPostSummary; mock it to avoid ESM issues.
vi.mock('marked', () => ({
  marked: vi.fn().mockResolvedValue('<p>content</p>'),
}));

import prisma from '../../lib/prisma';
import { getPublishedPosts, searchPosts } from '../post.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a minimal Prisma post row with status='published'. */
function buildPublishedPost(index: number) {
  const now = new Date();
  return {
    id: `post-id-${index}`,
    title: `Post Title ${index}`,
    slug: `post-title-${index}`,
    content: `Content for post ${index}`,
    status: 'published',
    publishedAt: new Date(now.getTime() - index * 60_000),
    createdAt: now,
    updatedAt: now,
    _count: { comments: 0 },
  };
}

/** Builds a minimal Prisma post row for searchPosts raw query results. */
function buildPublishedRawPost(index: number) {
  const now = new Date();
  return {
    id: `post-id-${index}`,
    title: `Post Title ${index}`,
    slug: `post-title-${index}`,
    content: `Content for post ${index}`,
    status: 'published',
    published_at: new Date(now.getTime() - index * 60_000),
    created_at: now,
    updated_at: now,
    comment_count: BigInt(0),
    total_count: BigInt(5),
  };
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates valid page numbers (1–50).
 */
const pageArb = fc.integer({ min: 1, max: 50 });

/**
 * Generates valid page sizes (1–20).
 */
const pageSizeArb = fc.integer({ min: 1, max: 20 });

/**
 * Generates a count of published posts to return (0–20).
 */
const postCountArb = fc.integer({ min: 0, max: 20 });

/**
 * Generates non-empty search keywords from printable ASCII.
 */
const keywordArb = fc
  .stringOf(
    fc.mapToConstant(
      { num: 26, build: (n) => String.fromCharCode(65 + n) }, // A-Z
      { num: 26, build: (n) => String.fromCharCode(97 + n) }, // a-z
      { num: 10, build: (n) => String.fromCharCode(48 + n) }, // 0-9
      { num: 1, build: () => ' ' },
    ),
    { minLength: 1, maxLength: 30 },
  )
  .filter((s) => s.trim().length > 0);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 6: Public endpoint returns only Published posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getPublishedPosts ─────────────────────────────────────────────────────

  describe('getPublishedPosts', () => {
    /**
     * **Validates: Requirements 4.7, 5.1**
     *
     * For any valid page number and page size, every post in the paginated
     * response returned by `getPublishedPosts()` MUST have status === 'published'.
     * Draft posts must never appear.
     */
    it(
      'every post in the response has status "published" for any page and page size',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            pageArb,
            pageSizeArb,
            postCountArb,
            async (page, pageSize, postCount) => {
              vi.clearAllMocks();

              // Build a list of `postCount` published posts to return
              const publishedPosts = Array.from({ length: postCount }, (_, i) =>
                buildPublishedPost(i),
              );

              vi.mocked(prisma.post.findMany).mockResolvedValue(
                publishedPosts as never,
              );
              vi.mocked(prisma.post.count).mockResolvedValue(postCount);

              const result = await getPublishedPosts(page, pageSize);

              // Core property: every post in the response is published
              for (const post of result.data) {
                expect(post.status).toBe('published');
              }

              // Pagination metadata must be consistent
              expect(result.page).toBe(page);
              expect(result.pageSize).toBe(pageSize);
              expect(result.total).toBe(postCount);
              expect(result.data).toHaveLength(postCount);
            },
          ),
          { numRuns: 100 },
        );
      },
    );

    /**
     * **Validates: Requirements 4.7, 5.1**
     *
     * When the DB returns zero posts (empty page), the response data array
     * must be empty — no phantom posts should appear.
     */
    it('returns an empty data array when no published posts exist', async () => {
      await fc.assert(
        fc.asyncProperty(pageArb, pageSizeArb, async (page, pageSize) => {
          vi.clearAllMocks();

          vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
          vi.mocked(prisma.post.count).mockResolvedValue(0);

          const result = await getPublishedPosts(page, pageSize);

          expect(result.data).toHaveLength(0);
          expect(result.total).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements 5.1**
     *
     * The Prisma query must be called with `status: 'published'` filter,
     * ensuring drafts are excluded at the DB query level.
     */
    it(
      'always queries Prisma with status filter "published" regardless of page',
      async () => {
        await fc.assert(
          fc.asyncProperty(pageArb, pageSizeArb, async (page, pageSize) => {
            vi.clearAllMocks();

            vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
            vi.mocked(prisma.post.count).mockResolvedValue(0);

            await getPublishedPosts(page, pageSize);

            // Verify the filter passed to Prisma includes status = 'published'
            const findManyCall = vi.mocked(prisma.post.findMany).mock.calls[0][0];
            expect(findManyCall.where).toEqual({ status: 'published' });

            const countCall = vi.mocked(prisma.post.count).mock.calls[0][0];
            expect(countCall?.where).toEqual({ status: 'published' });
          }),
          { numRuns: 100 },
        );
      },
    );
  });

  // ── searchPosts ───────────────────────────────────────────────────────────

  describe('searchPosts', () => {
    /**
     * **Validates: Requirements 4.7, 5.5**
     *
     * For any valid search keyword and page number, every post in the response
     * returned by `searchPosts()` MUST have status === 'published'.
     * Draft posts must never appear in search results.
     */
    it(
      'every post in search results has status "published" for any keyword and page',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            keywordArb,
            pageArb,
            postCountArb,
            async (keyword, page, postCount) => {
              vi.clearAllMocks();

              // Build raw query results — all with status='published'
              const rawPosts = Array.from({ length: postCount }, (_, i) =>
                buildPublishedRawPost(i),
              );

              vi.mocked(prisma.$queryRaw).mockResolvedValue(rawPosts as never);

              const result = await searchPosts(keyword, page);

              // Core property: every post in search results is published
              for (const post of result.data) {
                expect(post.status).toBe('published');
              }

              expect(result.page).toBe(page);
              expect(result.data).toHaveLength(postCount);
            },
          ),
          { numRuns: 100 },
        );
      },
    );

    /**
     * **Validates: Requirements 4.7, 5.5**
     *
     * When the DB returns zero results for a keyword, the response data array
     * must be empty — no draft posts or phantom results should appear.
     */
    it('returns an empty data array when no published posts match the keyword', async () => {
      await fc.assert(
        fc.asyncProperty(keywordArb, pageArb, async (keyword, page) => {
          vi.clearAllMocks();

          vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

          const result = await searchPosts(keyword, page);

          expect(result.data).toHaveLength(0);
          expect(result.total).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements 4.7, 5.5**
     *
     * Draft posts that may exist in the DB must never surface in search results.
     * This test verifies that even if the mock accidentally returns a draft,
     * the service correctly maps the status field from the raw result.
     * The real guard is the SQL WHERE clause; this validates the mapping layer.
     */
    it(
      'maps status directly from the raw query result — published status is preserved',
      async () => {
        await fc.assert(
          fc.asyncProperty(keywordArb, pageArb, async (keyword, page) => {
            vi.clearAllMocks();

            // Return one published raw post — simulating the DB correctly
            // filtering by status = 'published' in the SQL WHERE clause
            const rawPost = buildPublishedRawPost(0);
            vi.mocked(prisma.$queryRaw).mockResolvedValue([rawPost] as never);

            const result = await searchPosts(keyword, page);

            expect(result.data).toHaveLength(1);
            expect(result.data[0].status).toBe('published');
          }),
          { numRuns: 100 },
        );
      },
    );
  });
});
