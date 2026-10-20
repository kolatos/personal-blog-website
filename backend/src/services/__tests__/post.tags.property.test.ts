// Property-based tests untuk tag functionality di PostService
// Property 1: Tag Upsert Idempotency — upsert berapa kali pun menghasilkan
//             tepat satu record Tag per nama, tidak ada duplikat, tidak ada error.
// Property 2: Tag Normalization — nama tag selalu disimpan sebagai lowercase.
//
// Validates: Requirements 2.1, 2.7

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Module mocks (hoisted before real imports) ────────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tag: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    postTag: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('marked', () => ({
  marked: vi.fn().mockResolvedValue('<p>rendered</p>'),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import prisma from '../../lib/prisma';
import { normalizeTagName, upsertTags } from '../post.service';

// ── Property 1: Tag Upsert Idempotency ───────────────────────────────────────
//
// For any tag name n, calling upsert multiple times results in exactly one
// Tag record with name = n.toLowerCase(). No duplicates, no error on repeated calls.
//
// Validates: Requirements 2.1, 2.7

describe('Property 1: Tag Upsert Idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calling upsertTags with the same name N times triggers exactly 1 upsert (deduplication)', async () => {
    vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id' } as never);

    // For any non-empty tag name, repeating it N times in the array should
    // result in exactly 1 prisma.tag.upsert call (after deduplication).
    await fc.assert(
      fc.asyncProperty(
        // Non-empty printable ASCII string as tag name
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        // Repeat count between 2 and 10
        fc.integer({ min: 2, max: 10 }),
        async (tagName, repeatCount) => {
          vi.clearAllMocks();
          vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id' } as never);

          const repeated = Array(repeatCount).fill(tagName);
          await upsertTags(repeated);

          // Regardless of how many times the same name appears, only one upsert
          // should be called (the normalized name is the same).
          expect(prisma.tag.upsert).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the upsert is called with where: { name: normalizedName } — idempotent key', async () => {
    vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id' } as never);

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        async (tagName) => {
          vi.clearAllMocks();
          vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id' } as never);

          await upsertTags([tagName]);

          const calls = vi.mocked(prisma.tag.upsert).mock.calls;
          if (calls.length === 0) return; // empty after filter, skip
          const whereArg = calls[0][0].where;
          // The upsert key must match the normalized name
          expect(whereArg.name).toBe(normalizeTagName(tagName));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 2: Tag Normalization ────────────────────────────────────────────
//
// Tag names are always stored as lowercase.
//
// Validates: Requirements 2.7

describe('Property 2: Tag Normalization', () => {
  it('normalizeTagName always returns a string equal to its own toLowerCase()', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (name) => {
          const normalized = normalizeTagName(name);
          expect(normalized).toBe(name.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('upsertTags stores normalized (lowercase) name as the upsert key — never original case', async () => {
    vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id' } as never);

    await fc.assert(
      fc.asyncProperty(
        // Use ascii strings that have at least one non-space char,
        // and include uppercase letters to make this property meaningful
        fc
          .string({ minLength: 1, maxLength: 80 })
          .filter((s) => s.trim().length > 0),
        async (tagName) => {
          vi.clearAllMocks();
          vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id' } as never);

          await upsertTags([tagName]);

          const calls = vi.mocked(prisma.tag.upsert).mock.calls;
          if (calls.length === 0) return;

          const storedName = calls[0][0].where.name as string;
          // The stored name must be lowercase
          expect(storedName).toBe(storedName.toLowerCase());
          // And must equal the normalized version
          expect(storedName).toBe(normalizeTagName(tagName));
        }
      ),
      { numRuns: 100 }
    );
  });
});
