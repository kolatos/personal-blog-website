// Unit tests untuk Tag functionality di PostService
// Requirements: 2.1, 2.2, 2.7

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
import { normalizeTagName, upsertTags, getAllTags } from '../post.service';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Tag normalization', () => {
  it('lowercases an already-lowercase string unchanged', () => {
    expect(normalizeTagName('math')).toBe('math');
  });

  it('converts uppercase letters to lowercase', () => {
    expect(normalizeTagName('MATH')).toBe('math');
  });

  it('converts mixed-case to lowercase', () => {
    expect(normalizeTagName('JavaScript')).toBe('javascript');
  });

  it('handles multi-word tags with spaces', () => {
    expect(normalizeTagName('Machine Learning')).toBe('machine learning');
  });

  it('handles strings that are already lowercase with numbers', () => {
    expect(normalizeTagName('css3')).toBe('css3');
  });

  it('handles empty string', () => {
    expect(normalizeTagName('')).toBe('');
  });

  it('normalizes unicode letters to lowercase', () => {
    expect(normalizeTagName('Álgebra')).toBe('álgebra');
  });
});

describe('upsertTags — idempotency and normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.tag.upsert once per unique normalized tag', async () => {
    vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id-1' } as never);

    await upsertTags(['math']);

    expect(prisma.tag.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.tag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: 'math' },
        update: {},
        create: expect.objectContaining({ name: 'math' }),
      })
    );
  });

  it('normalizes tag names to lowercase before upserting', async () => {
    vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id-1' } as never);

    await upsertTags(['JavaScript', 'MATH', 'Tutorial']);

    const calls = vi.mocked(prisma.tag.upsert).mock.calls;
    const upsertedNames = calls.map((call) => call[0].where.name);
    expect(upsertedNames).toEqual(
      expect.arrayContaining(['javascript', 'math', 'tutorial'])
    );
    // None should have uppercase
    for (const name of upsertedNames) {
      expect(name).toBe(name.toLowerCase());
    }
  });

  it('deduplicates the same tag name appearing twice — only one upsert call', async () => {
    vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id-1' } as never);

    await upsertTags(['math', 'math']);

    expect(prisma.tag.upsert).toHaveBeenCalledTimes(1);
  });

  it('deduplicates same name with different casing — treated as same tag', async () => {
    vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id-1' } as never);

    await upsertTags(['Math', 'MATH', 'math']);

    // After normalization all become 'math' → deduplicated → 1 upsert
    expect(prisma.tag.upsert).toHaveBeenCalledTimes(1);
  });

  it('returns an array of ids from upsert results', async () => {
    vi.mocked(prisma.tag.upsert)
      .mockResolvedValueOnce({ id: 'id-a' } as never)
      .mockResolvedValueOnce({ id: 'id-b' } as never);

    const result = await upsertTags(['math', 'tutorial']);

    expect(result).toEqual([{ id: 'id-a' }, { id: 'id-b' }]);
  });

  it('returns empty array for empty input', async () => {
    const result = await upsertTags([]);
    expect(result).toEqual([]);
    expect(prisma.tag.upsert).not.toHaveBeenCalled();
  });

  it('filters out empty strings after normalization', async () => {
    // An empty string should not trigger an upsert
    vi.mocked(prisma.tag.upsert).mockResolvedValue({ id: 'tag-id-1' } as never);

    await upsertTags(['math', '']);

    // Only 'math' should be upserted, '' is filtered
    expect(prisma.tag.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.tag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'math' } })
    );
  });
});

describe('getAllTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tags sorted alphabetically from prisma', async () => {
    const mockTags = [
      { id: 'id-1', name: 'algebra', slug: 'algebra' },
      { id: 'id-2', name: 'calculus', slug: 'calculus' },
      { id: 'id-3', name: 'math', slug: 'math' },
    ];
    vi.mocked(prisma.tag.findMany).mockResolvedValue(mockTags as never);

    const result = await getAllTags();

    expect(result).toEqual(mockTags);
    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  });

  it('returns empty array when no tags exist', async () => {
    vi.mocked(prisma.tag.findMany).mockResolvedValue([] as never);

    const result = await getAllTags();

    expect(result).toEqual([]);
  });
});
