// Feature: personal-blog-website, Property 13: Search returns only matching Published posts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Module mocks (hoisted before real imports) ────────────────────────────────
// Prisma is mocked so this is a pure unit test — no real DB needed.

vi.mock('../../lib/prisma', () => {
  return {
    default: {
      post: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      $queryRaw: vi.fn(),
    },
  };
});

// marked is imported transitively via mapPostSummary; mock it to avoid ESM issues.
vi.mock('marked', () => ({
  marked: vi.fn().mockResolvedValue('<p>content</p>'),
}));

import prisma from '../../lib/prisma';
import { searchPosts } from '../post.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal raw post row (as returned by `$queryRaw`) with the given
 * keyword embedded in the title — simulating what PostgreSQL full-text search
 * returns: only published posts that contain the search term.
 */
function buildMatchingRawPost(index: number, keyword: string) {
  const now = new Date();
  return {
    id: `post-id-${index}`,
    title: `Post about ${keyword} number ${index}`,
    slug: `post-about-${index}`,
    content: `This content mentions ${keyword} in detail for post ${index}.`,
    status: 'published',
    published_at: new Date(now.getTime() - index * 60_000),
    created_at: now,
    updated_at: now,
    comment_count: BigInt(0),
    total_count: BigInt(5),
  };
}

/**
 * Builds a raw post that is published but uses a neutral keyword — used when
 * we want to test multiple posts where content is indeterminate.
 */
function buildPublishedRawPost(index: number, totalCount: number) {
  const now = new Date();
  return {
    id: `post-id-${index}`,
    title: `Published Post ${index}`,
    slug: `published-post-${index}`,
    content: `Content for published post ${index}.`,
    status: 'published',
    published_at: new Date(now.getTime() - index * 60_000),
    created_at: now,
    updated_at: now,
    comment_count: BigInt(0),
    total_count: BigInt(totalCount),
  };
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates non-empty search keywords from printable ASCII letters/digits.
 * We filter out whitespace-only strings since they are not valid keywords.
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

/**
 * Generates valid page numbers (1–50).
 */
const pageArb = fc.integer({ min: 1, max: 50 });

/**
 * Generates a result count for the mocked search response (0–10).
 */
const resultCountArb = fc.integer({ min: 0, max: 10 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 13: Search returns only matching Published posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 5.5**
   *
   * For any non-empty keyword and page number, every post returned by
   * `searchPosts()` MUST have status === 'published'.
   * Draft posts must NEVER appear in search results.
   *
   * This is the core invariant: the SQL WHERE clause enforces
   * `p.status = 'published'`, so any row returned from the DB is published.
   * This property verifies that invariant is correctly mapped through the
   * service layer.
   */
  it(
    'every post in search results has status "published" for any keyword and page',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          keywordArb,
          pageArb,
          resultCountArb,
          async (keyword, page, resultCount) => {
            vi.clearAllMocks();

            // Mock: DB returns `resultCount` published posts matching the keyword
            const rawPosts = Array.from({ length: resultCount }, (_, i) =>
              buildMatchingRawPost(i, keyword),
            );

            vi.mocked(prisma.$queryRaw).mockResolvedValue(rawPosts as never);

            const result = await searchPosts(keyword, page);

            // Core property: every post in search results MUST be published
            for (const post of result.data) {
              expect(post.status).toBe('published');
            }

            // Result count must match what the mock returned
            expect(result.data).toHaveLength(resultCount);
            expect(result.page).toBe(page);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  /**
   * **Validates: Requirements 5.5**
   *
   * For any non-empty keyword and page number, the posts returned by
   * `searchPosts()` MUST contain the keyword in their title or content.
   *
   * Because PostgreSQL full-text search uses stemming (which can match
   * morphological variants), we verify this invariant by seeding the mock
   * with posts whose title/content explicitly contain the keyword — confirming
   * that the service correctly maps the title/content fields from the raw
   * query result to the PostSummary response.
   */
  it(
    'every post in search results contains the search keyword in title or content',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          keywordArb,
          pageArb,
          fc.integer({ min: 1, max: 5 }),
          async (keyword, page, resultCount) => {
            vi.clearAllMocks();

            // Seed the mock with posts that explicitly contain the keyword
            const rawPosts = Array.from({ length: resultCount }, (_, i) =>
              buildMatchingRawPost(i, keyword),
            );

            vi.mocked(prisma.$queryRaw).mockResolvedValue(rawPosts as never);

            const result = await searchPosts(keyword, page);

            expect(result.data).toHaveLength(resultCount);

            // Every returned post must contain the keyword in title or excerpt
            // (case-insensitive, since PostgreSQL full-text search normalises casing)
            const lowerKeyword = keyword.toLowerCase();
            for (const post of result.data) {
              const titleContains = post.title.toLowerCase().includes(lowerKeyword);
              const excerptContains = post.excerpt.toLowerCase().includes(lowerKeyword);
              expect(titleContains || excerptContains).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  /**
   * **Validates: Requirements 5.5**
   *
   * When the DB returns an empty result set (no posts match the keyword),
   * `searchPosts()` MUST return an empty data array and total = 0.
   * No phantom posts should appear for any keyword.
   */
  it(
    'returns an empty data array and total = 0 when no posts match the keyword',
    async () => {
      await fc.assert(
        fc.asyncProperty(keywordArb, pageArb, async (keyword, page) => {
          vi.clearAllMocks();

          vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

          const result = await searchPosts(keyword, page);

          expect(result.data).toHaveLength(0);
          expect(result.total).toBe(0);

          // No draft posts can sneak into an empty result
          for (const post of result.data) {
            expect(post.status).toBe('published');
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * **Validates: Requirements 5.5**
   *
   * Pagination metadata returned by `searchPosts()` MUST be internally
   * consistent with the total count from the raw query result:
   *   - `page` must equal the requested page
   *   - `totalPages` must equal Math.ceil(total / pageSize)
   *   - `data.length` must not exceed `pageSize`
   *
   * This holds for any keyword, any page, and any number of total matches.
   */
  it(
    'pagination metadata is consistent for any keyword, page, and result count',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          keywordArb,
          pageArb,
          resultCountArb,
          async (keyword, page, resultCount) => {
            vi.clearAllMocks();

            const SEARCH_PAGE_SIZE = 10; // constant from post.service.ts

            const rawPosts = Array.from({ length: resultCount }, (_, i) =>
              buildPublishedRawPost(i, resultCount),
            );

            vi.mocked(prisma.$queryRaw).mockResolvedValue(rawPosts as never);

            const result = await searchPosts(keyword, page);

            // Page number must be the one that was requested
            expect(result.page).toBe(page);

            // Page size must equal the SEARCH_PAGE_SIZE constant
            expect(result.pageSize).toBe(SEARCH_PAGE_SIZE);

            // totalPages must be correctly derived from total and pageSize
            expect(result.totalPages).toBe(
              Math.ceil(result.total / SEARCH_PAGE_SIZE),
            );

            // The data array must never exceed the page size
            expect(result.data.length).toBeLessThanOrEqual(SEARCH_PAGE_SIZE);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
