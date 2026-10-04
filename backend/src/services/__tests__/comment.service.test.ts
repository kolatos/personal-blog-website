// Unit tests untuk CommentService
// Requirements: 6.1–6.7

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks (hoisted before real imports) ────────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    post: {
      findUnique: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import prisma from '../../lib/prisma';
import {
  addComment,
  deleteComment,
  getCommentsByPost,
} from '../comment.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2024-06-01T10:00:00Z');
const LATER = new Date('2024-06-01T11:00:00Z');

const POST_ID = 'post-uuid-1';
const AUTHOR_ID = 'user-uuid-1';
const ADMIN_ID = 'admin-uuid-999';
const OTHER_USER_ID = 'user-uuid-2';
const COMMENT_ID = 'comment-uuid-1';

const PUBLISHED_POST = {
  id: POST_ID,
  status: 'published',
};

const DRAFT_POST = {
  id: POST_ID,
  status: 'draft',
};

function buildRawComment(overrides: Partial<{
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  author: { username: string };
}> = {}) {
  return {
    id: COMMENT_ID,
    postId: POST_ID,
    authorId: AUTHOR_ID,
    content: 'Komentar yang bagus!',
    createdAt: NOW,
    author: { username: 'alice' },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════
  // addComment
  // Requirements: 6.1, 6.2, 6.3, 6.7
  // ══════════════════════════════════════════════════════════════════════

  describe('addComment', () => {
    describe('sukses (Req 6.1, 6.2)', () => {
      it('mengembalikan Comment yang baru dibuat ketika post published (Req 6.1)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
        vi.mocked(prisma.comment.create).mockResolvedValue(buildRawComment() as never);

        const result = await addComment(POST_ID, AUTHOR_ID, 'Komentar yang bagus!');

        expect(result).toMatchObject({
          id: COMMENT_ID,
          postId: POST_ID,
          authorId: AUTHOR_ID,
          content: 'Komentar yang bagus!',
          createdAt: NOW.toISOString(),
        });
      });

      it('memanggil prisma.comment.create dengan data yang benar (Req 6.2)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
        vi.mocked(prisma.comment.create).mockResolvedValue(buildRawComment() as never);

        await addComment(POST_ID, AUTHOR_ID, 'Isi komentar');

        expect(prisma.comment.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              postId: POST_ID,
              authorId: AUTHOR_ID,
              content: 'Isi komentar',
            },
          })
        );
      });

      it('authorUsername di-populate dari data author jika tersedia, atau string kosong jika tidak (Req 6.7)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
        // create tidak menyertakan include author, sehingga author tidak tersedia
        vi.mocked(prisma.comment.create).mockResolvedValue(
          buildRawComment({ author: undefined }) as never
        );

        const result = await addComment(POST_ID, AUTHOR_ID, 'Komentar dari bob');

        // mapComment menggunakan raw.author?.username ?? '' — jika author tidak ada, hasilnya ''
        expect(result.authorUsername).toBe('');
      });

      it('createdAt dikonversi ke ISO string', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
        vi.mocked(prisma.comment.create).mockResolvedValue(buildRawComment({ createdAt: NOW }) as never);

        const result = await addComment(POST_ID, AUTHOR_ID, 'Test');

        expect(result.createdAt).toBe(NOW.toISOString());
      });
    });

    describe('post bukan published → 404 (Req 6.3)', () => {
      it('melempar error 404 NOT_FOUND ketika post berstatus draft (Req 6.3)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(DRAFT_POST as never);

        await expect(addComment(POST_ID, AUTHOR_ID, 'Komentar')).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Post not found',
        });

        expect(prisma.comment.create).not.toHaveBeenCalled();
      });

      it('melempar error 404 NOT_FOUND ketika post tidak ada sama sekali', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        await expect(addComment('nonexistent-post', AUTHOR_ID, 'Komentar')).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
        });

        expect(prisma.comment.create).not.toHaveBeenCalled();
      });

      it('tidak mengungkap bahwa post draft eksis (hanya mengembalikan 404)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(DRAFT_POST as never);

        try {
          await addComment(POST_ID, AUTHOR_ID, 'Komentar');
          expect.fail('Seharusnya melempar error');
        } catch (err: unknown) {
          const e = err as { status: number; message: string };
          expect(e.status).toBe(404);
          // pesan tidak mengungkap bahwa post adalah draft
          expect(e.message).toBe('Post not found');
        }
      });
    });

    describe('validasi konten', () => {
      it('menerima konten dengan panjang tepat 1 karakter (Req 6.7)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
        vi.mocked(prisma.comment.create).mockResolvedValue(buildRawComment({ content: 'A' }) as never);

        const result = await addComment(POST_ID, AUTHOR_ID, 'A');

        expect(result.content).toBe('A');
      });

      it('menerima konten dengan panjang tepat 2000 karakter (Req 6.7)', async () => {
        const longContent = 'A'.repeat(2000);
        vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
        vi.mocked(prisma.comment.create).mockResolvedValue(
          buildRawComment({ content: longContent }) as never
        );

        // CommentService tidak memvalidasi panjang konten — itu adalah tanggung jawab Zod.
        // Service meneruskan konten apa pun yang diterima ke Prisma.
        const result = await addComment(POST_ID, AUTHOR_ID, longContent);

        expect(result.content).toBe(longContent);
        expect(prisma.comment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ content: longContent }) })
        );
      });

      it('meneruskan konten >2000 char ke Prisma (validasi dilakukan Zod upstream)', async () => {
        const tooLong = 'B'.repeat(2001);
        vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
        vi.mocked(prisma.comment.create).mockResolvedValue(
          buildRawComment({ content: tooLong }) as never
        );

        // Zod schema mencegah ini sebelum sampai ke service;
        // service sendiri tidak melempar error untuk panjang konten
        const result = await addComment(POST_ID, AUTHOR_ID, tooLong);
        expect(result.content).toBe(tooLong);
      });

      it('meneruskan konten kosong ke Prisma (validasi dilakukan Zod upstream)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
        vi.mocked(prisma.comment.create).mockResolvedValue(
          buildRawComment({ content: '' }) as never
        );

        // Zod schema mencegah string kosong; service hanya meneruskan saja
        const result = await addComment(POST_ID, AUTHOR_ID, '');
        expect(result.content).toBe('');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // deleteComment
  // Requirements: 6.4, 6.5, 6.6
  // ══════════════════════════════════════════════════════════════════════

  describe('deleteComment', () => {
    describe('owner menghapus komentar miliknya sendiri (Req 6.4)', () => {
      it('berhasil menghapus ketika requester adalah owner comment (Req 6.4)', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(
          buildRawComment({ authorId: AUTHOR_ID }) as never
        );
        vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

        await expect(deleteComment(COMMENT_ID, AUTHOR_ID, 'user')).resolves.toBeUndefined();

        expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
      });

      it('mengembalikan void (undefined) setelah berhasil menghapus', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(
          buildRawComment({ authorId: AUTHOR_ID }) as never
        );
        vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

        const result = await deleteComment(COMMENT_ID, AUTHOR_ID, 'user');

        expect(result).toBeUndefined();
      });
    });

    describe('admin menghapus komentar siapapun (Req 6.5)', () => {
      it('admin berhasil menghapus komentar milik user lain (Req 6.5)', async () => {
        // komentar dimiliki oleh AUTHOR_ID, dihapus oleh ADMIN_ID
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(
          buildRawComment({ authorId: AUTHOR_ID }) as never
        );
        vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

        await expect(deleteComment(COMMENT_ID, ADMIN_ID, 'admin')).resolves.toBeUndefined();

        expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
      });

      it('admin juga dapat menghapus komentar miliknya sendiri', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(
          buildRawComment({ authorId: ADMIN_ID }) as never
        );
        vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

        await expect(deleteComment(COMMENT_ID, ADMIN_ID, 'admin')).resolves.toBeUndefined();
      });
    });

    describe('user lain mencoba menghapus → 403 (Req 6.6)', () => {
      it('melempar error 403 FORBIDDEN ketika user bukan owner dan bukan admin (Req 6.6)', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(
          buildRawComment({ authorId: AUTHOR_ID }) as never
        );

        await expect(deleteComment(COMMENT_ID, OTHER_USER_ID, 'user')).rejects.toMatchObject({
          status: 403,
          code: 'FORBIDDEN',
          message: 'Not authorized to delete this comment',
        });

        expect(prisma.comment.delete).not.toHaveBeenCalled();
      });

      it('tidak memanggil prisma.comment.delete ketika tidak diotorisasi', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(
          buildRawComment({ authorId: AUTHOR_ID }) as never
        );

        try {
          await deleteComment(COMMENT_ID, OTHER_USER_ID, 'user');
        } catch {
          // error sudah diharapkan
        }

        expect(prisma.comment.delete).not.toHaveBeenCalled();
      });
    });

    describe('comment tidak ditemukan → 404 (Req 6.4)', () => {
      it('melempar error 404 NOT_FOUND ketika comment tidak ada (Req 6.4)', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);

        await expect(deleteComment('nonexistent-comment', AUTHOR_ID, 'user')).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Comment not found',
        });

        expect(prisma.comment.delete).not.toHaveBeenCalled();
      });

      it('404 berlaku untuk semua requester — termasuk admin (Req 6.4)', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);

        await expect(deleteComment('nonexistent-comment', ADMIN_ID, 'admin')).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // getCommentsByPost
  // Requirements: 6.1, 6.2
  // ══════════════════════════════════════════════════════════════════════

  describe('getCommentsByPost', () => {
    describe('ada komentar — diurutkan ascending (Req 6.1, 6.2)', () => {
      it('mengembalikan array Comment dari post yang dimaksud (Req 6.1)', async () => {
        const rawComments = [
          buildRawComment({ id: 'comment-1', createdAt: NOW }),
          buildRawComment({ id: 'comment-2', createdAt: LATER }),
        ];
        vi.mocked(prisma.comment.findMany).mockResolvedValue(rawComments as never);

        const result = await getCommentsByPost(POST_ID);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('comment-1');
        expect(result[1].id).toBe('comment-2');
      });

      it('query menggunakan postId yang benar sebagai filter (Req 6.1)', async () => {
        vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

        await getCommentsByPost(POST_ID);

        expect(prisma.comment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { postId: POST_ID },
          })
        );
      });

      it('query diurutkan berdasarkan createdAt ASC (Req 6.2)', async () => {
        vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

        await getCommentsByPost(POST_ID);

        expect(prisma.comment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { createdAt: 'asc' },
          })
        );
      });

      it('menyertakan include author untuk mengambil username (Req 6.2)', async () => {
        vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

        await getCommentsByPost(POST_ID);

        expect(prisma.comment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: { author: { select: { username: true } } },
          })
        );
      });

      it('authorUsername di-populate dari data author join (Req 6.2)', async () => {
        vi.mocked(prisma.comment.findMany).mockResolvedValue([
          buildRawComment({ author: { username: 'charlie' } }),
        ] as never);

        const result = await getCommentsByPost(POST_ID);

        expect(result[0].authorUsername).toBe('charlie');
      });

      it('createdAt dikonversi ke ISO string', async () => {
        vi.mocked(prisma.comment.findMany).mockResolvedValue([
          buildRawComment({ createdAt: NOW }),
        ] as never);

        const result = await getCommentsByPost(POST_ID);

        expect(result[0].createdAt).toBe(NOW.toISOString());
      });

      it('setiap komentar memiliki postId yang sama dengan yang diminta', async () => {
        const rawComments = [
          buildRawComment({ id: 'c-1', postId: POST_ID }),
          buildRawComment({ id: 'c-2', postId: POST_ID }),
        ];
        vi.mocked(prisma.comment.findMany).mockResolvedValue(rawComments as never);

        const result = await getCommentsByPost(POST_ID);

        result.forEach(comment => {
          expect(comment.postId).toBe(POST_ID);
        });
      });
    });

    describe('tidak ada komentar', () => {
      it('mengembalikan array kosong ketika tidak ada komentar pada post', async () => {
        vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

        const result = await getCommentsByPost(POST_ID);

        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });

      it('tidak melempar error ketika post tidak memiliki komentar', async () => {
        vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

        await expect(getCommentsByPost('any-post-id')).resolves.toEqual([]);
      });
    });
  });
});
