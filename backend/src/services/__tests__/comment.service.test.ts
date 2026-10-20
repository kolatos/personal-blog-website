// Unit tests untuk CommentService — sistem komentar generik
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
  addCommentToPost,
  deleteComment,
  getComments,
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
const PARENT_COMMENT_ID = 'comment-uuid-parent';

const PUBLISHED_POST = { id: POST_ID, status: 'published' };
const DRAFT_POST = { id: POST_ID, status: 'draft' };

function buildRawComment(overrides: Partial<{
  id: string;
  contentType: string;
  contentId: string;
  authorId: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
  author: { id: string; username: string } | undefined;
  replies: Array<unknown>;
}> = {}) {
  return {
    id: COMMENT_ID,
    contentType: 'post',
    contentId: POST_ID,
    authorId: AUTHOR_ID,
    content: 'Komentar yang bagus!',
    parentId: null,
    createdAt: NOW,
    author: { id: AUTHOR_ID, username: 'alice' },
    replies: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════
  // addComment (generic)
  // Requirements: 6.1, 6.2, 6.3, 6.7
  // ══════════════════════════════════════════════════════════════════════

  describe('addComment (generic)', () => {
    describe('sukses tanpa parentId', () => {
      it('mengembalikan Comment yang baru dibuat (Req 6.1)', async () => {
        vi.mocked(prisma.comment.create).mockResolvedValue(buildRawComment() as never);

        const result = await addComment('post', POST_ID, AUTHOR_ID, 'Komentar yang bagus!');

        expect(result).toMatchObject({
          id: COMMENT_ID,
          contentType: 'post',
          contentId: POST_ID,
          authorId: AUTHOR_ID,
          content: 'Komentar yang bagus!',
          parentId: null,
        });
        expect(result.authorUsername).toBe('alice');
        expect(Array.isArray(result.replies)).toBe(true);
      });

      it('memanggil prisma.comment.create dengan data yang benar (Req 6.2)', async () => {
        vi.mocked(prisma.comment.create).mockResolvedValue(buildRawComment() as never);

        await addComment('post', POST_ID, AUTHOR_ID, 'Isi komentar');

        expect(prisma.comment.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              contentType: 'post',
              contentId: POST_ID,
              authorId: AUTHOR_ID,
              content: 'Isi komentar',
              parentId: null,
            }),
          })
        );
      });

      it('authorUsername adalah string kosong jika author tidak ada', async () => {
        vi.mocked(prisma.comment.create).mockResolvedValue(
          buildRawComment({ author: undefined }) as never
        );

        const result = await addComment('post', POST_ID, AUTHOR_ID, 'Komentar');

        expect(result.authorUsername).toBe('');
      });

      it('createdAt dikonversi ke ISO string', async () => {
        vi.mocked(prisma.comment.create).mockResolvedValue(
          buildRawComment({ createdAt: NOW }) as never
        );

        const result = await addComment('post', POST_ID, AUTHOR_ID, 'Test');

        expect(result.createdAt).toBe(NOW.toISOString());
      });
    });

    describe('reply dengan parentId (kedalaman 1)', () => {
      it('berhasil jika parentId ada dan parent adalah level atas', async () => {
        const parentComment = { id: PARENT_COMMENT_ID, parentId: null };
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(parentComment as never);
        vi.mocked(prisma.comment.create).mockResolvedValue(
          buildRawComment({ parentId: PARENT_COMMENT_ID }) as never
        );

        const result = await addComment('post', POST_ID, AUTHOR_ID, 'Balasan', PARENT_COMMENT_ID);

        expect(result.parentId).toBe(PARENT_COMMENT_ID);
      });

      it('melempar 400 REPLY_DEPTH_EXCEEDED jika parent sudah merupakan reply', async () => {
        const replyComment = { id: COMMENT_ID, parentId: PARENT_COMMENT_ID };
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(replyComment as never);

        await expect(
          addComment('post', POST_ID, AUTHOR_ID, 'Nested reply', COMMENT_ID)
        ).rejects.toMatchObject({
          status: 400,
          code: 'REPLY_DEPTH_EXCEEDED',
        });

        expect(prisma.comment.create).not.toHaveBeenCalled();
      });

      it('melempar 404 jika parentId tidak ditemukan', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);

        await expect(
          addComment('post', POST_ID, AUTHOR_ID, 'Balasan', 'nonexistent-parent')
        ).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // addCommentToPost (legacy alias, validates post status)
  // Requirements: 6.1, 6.3
  // ══════════════════════════════════════════════════════════════════════

  describe('addCommentToPost (legacy alias)', () => {
    it('mengembalikan Comment ketika post published (Req 6.1)', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
      vi.mocked(prisma.comment.create).mockResolvedValue(buildRawComment() as never);

      const result = await addCommentToPost(POST_ID, AUTHOR_ID, 'Komentar via legacy');

      expect(result).toMatchObject({
        contentType: 'post',
        contentId: POST_ID,
        authorId: AUTHOR_ID,
      });
    });

    it('melempar 404 ketika post berstatus draft (Req 6.3)', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(DRAFT_POST as never);

      await expect(
        addCommentToPost(POST_ID, AUTHOR_ID, 'Komentar pada draft')
      ).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Post not found',
      });

      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it('melempar 404 ketika post tidak ada sama sekali', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

      await expect(
        addCommentToPost('nonexistent', AUTHOR_ID, 'Komentar')
      ).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });

    it('tidak mengungkap bahwa post adalah draft (hanya NOT_FOUND)', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(DRAFT_POST as never);

      try {
        await addCommentToPost(POST_ID, AUTHOR_ID, 'Komentar');
        expect.fail('Seharusnya melempar error');
      } catch (err: unknown) {
        const e = err as { status: number; message: string };
        expect(e.status).toBe(404);
        expect(e.message).toBe('Post not found');
      }
    });

    it('menerima konten tepat 1 karakter (Req 6.7)', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
      vi.mocked(prisma.comment.create).mockResolvedValue(
        buildRawComment({ content: 'A' }) as never
      );

      const result = await addCommentToPost(POST_ID, AUTHOR_ID, 'A');

      expect(result.content).toBe('A');
    });

    it('menerima konten tepat 2000 karakter (Req 6.7)', async () => {
      const longContent = 'A'.repeat(2000);
      vi.mocked(prisma.post.findUnique).mockResolvedValue(PUBLISHED_POST as never);
      vi.mocked(prisma.comment.create).mockResolvedValue(
        buildRawComment({ content: longContent }) as never
      );

      const result = await addCommentToPost(POST_ID, AUTHOR_ID, longContent);

      expect(result.content).toBe(longContent);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // deleteComment
  // Requirements: 6.4, 6.5, 6.6
  // ══════════════════════════════════════════════════════════════════════

  describe('deleteComment', () => {
    describe('owner menghapus komentar miliknya sendiri (Req 6.4)', () => {
      it('berhasil menghapus ketika requester adalah owner (Req 6.4)', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(
          buildRawComment({ authorId: AUTHOR_ID }) as never
        );
        vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

        await expect(deleteComment(COMMENT_ID, AUTHOR_ID, 'user')).resolves.toBeUndefined();
        expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
      });

      it('mengembalikan void setelah berhasil menghapus', async () => {
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
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(
          buildRawComment({ authorId: AUTHOR_ID }) as never
        );
        vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

        await expect(deleteComment(COMMENT_ID, ADMIN_ID, 'admin')).resolves.toBeUndefined();
        expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
      });
    });

    describe('user lain mencoba menghapus → 403 (Req 6.6)', () => {
      it('melempar 403 FORBIDDEN ketika user bukan owner dan bukan admin (Req 6.6)', async () => {
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
    });

    describe('comment tidak ditemukan → 404 (Req 6.4)', () => {
      it('melempar 404 NOT_FOUND ketika comment tidak ada (Req 6.4)', async () => {
        vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);

        await expect(deleteComment('nonexistent', AUTHOR_ID, 'user')).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Comment not found',
        });

        expect(prisma.comment.delete).not.toHaveBeenCalled();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // getComments (generic)
  // Requirements: 6.1, 6.2
  // ══════════════════════════════════════════════════════════════════════

  describe('getComments (generic)', () => {
    it('mengembalikan array Comment level atas dengan replies bersarang (Req 6.1)', async () => {
      const rawComments = [
        buildRawComment({ id: 'comment-1', createdAt: NOW }),
        buildRawComment({ id: 'comment-2', createdAt: LATER }),
      ];
      vi.mocked(prisma.comment.findMany).mockResolvedValue(rawComments as never);

      const result = await getComments('post', POST_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('comment-1');
      expect(result[1].id).toBe('comment-2');
    });

    it('query menggunakan contentType dan contentId yang benar (Req 6.1)', async () => {
      vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

      await getComments('post', POST_ID);

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contentType: 'post', contentId: POST_ID, parentId: null },
        })
      );
    });

    it('query diurutkan berdasarkan createdAt ASC (Req 6.2)', async () => {
      vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

      await getComments('post', POST_ID);

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });

    it('mengembalikan array kosong ketika tidak ada komentar', async () => {
      vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

      const result = await getComments('post', POST_ID);

      expect(result).toEqual([]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // getCommentsByPost (legacy alias)
  // Requirements: 6.1, 6.2
  // ══════════════════════════════════════════════════════════════════════

  describe('getCommentsByPost (legacy alias)', () => {
    it('mengembalikan komentar menggunakan contentType=post dan contentId=postId', async () => {
      vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

      await getCommentsByPost(POST_ID);

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contentType: 'post', contentId: POST_ID, parentId: null },
        })
      );
    });

    it('mengembalikan array Comment yang sama seperti getComments', async () => {
      const rawComments = [buildRawComment()];
      vi.mocked(prisma.comment.findMany).mockResolvedValue(rawComments as never);

      const result = await getCommentsByPost(POST_ID);

      expect(result).toHaveLength(1);
      expect(result[0].contentType).toBe('post');
      expect(result[0].contentId).toBe(POST_ID);
    });

    it('authorUsername di-populate dari data author join (Req 6.2)', async () => {
      vi.mocked(prisma.comment.findMany).mockResolvedValue([
        buildRawComment({ author: { id: AUTHOR_ID, username: 'charlie' } }),
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
  });
});
