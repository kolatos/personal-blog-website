import prisma from '../lib/prisma.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommentAuthor {
  id: string;
  username: string;
}

export interface CommentReply {
  id: string;
  contentType: string;
  contentId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  parentId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  contentType: string;
  contentId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  replies: CommentReply[];
}

// ─── Error helper ────────────────────────────────────────────────────────────

function createError(
  status: number,
  code: string,
  message: string
): Error & { status: number; code: string } {
  const err = new Error(message) as Error & { status: number; code: string };
  err.status = status;
  err.code = code;
  return err;
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

type PrismaReply = {
  id: string;
  contentType: string;
  contentId: string;
  authorId: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
  author?: { username: string };
};

type PrismaComment = PrismaReply & {
  replies?: PrismaReply[];
};

function mapReply(raw: PrismaReply): CommentReply {
  return {
    id: raw.id,
    contentType: raw.contentType,
    contentId: raw.contentId,
    authorId: raw.authorId,
    authorUsername: raw.author?.username ?? '',
    content: raw.content,
    parentId: raw.parentId ?? '',
    createdAt: raw.createdAt.toISOString(),
  };
}

function mapComment(raw: PrismaComment): Comment {
  return {
    id: raw.id,
    contentType: raw.contentType,
    contentId: raw.contentId,
    authorId: raw.authorId,
    authorUsername: raw.author?.username ?? '',
    content: raw.content,
    parentId: raw.parentId ?? null,
    createdAt: raw.createdAt.toISOString(),
    replies: (raw.replies ?? []).map(mapReply),
  };
}

// ─── addComment ───────────────────────────────────────────────────────────────

/**
 * Tambah komentar baru (atau balasan) pada konten apapun.
 *
 * Aturan kedalaman:
 *  - Jika parentId disediakan, parent harus ada.
 *  - Jika parent sudah memiliki parentId (bukan level atas), tolak dengan 400.
 *  - Maksimal kedalaman = 1 (YouTube-style).
 *
 * Requirements: 6.1, 6.2, 6.3, 6.7
 */
export async function addComment(
  contentType: string,
  contentId: string,
  authorId: string,
  content: string,
  parentId?: string | null
): Promise<Comment> {
  // Validasi kedalaman jika parentId disediakan
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });

    if (!parent) {
      throw createError(404, 'NOT_FOUND', 'Parent comment not found');
    }

    if (parent.parentId !== null) {
      throw createError(400, 'REPLY_DEPTH_EXCEEDED', 'Cannot reply to a reply — maximum depth is 1');
    }
  }

  const comment = await prisma.comment.create({
    data: {
      contentType,
      contentId,
      authorId,
      content,
      parentId: parentId ?? null,
    },
    include: {
      author: {
        select: { id: true, username: true },
      },
      replies: {
        include: {
          author: {
            select: { id: true, username: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return mapComment(comment);
}

/**
 * Alias untuk backward-compatibility: tambah komentar pada post berdasarkan postId.
 * Wrapper di atas addComment dengan contentType='post'.
 *
 * Requirements: 6.1, 6.3, 6.7
 */
export async function addCommentToPost(
  postId: string,
  authorId: string,
  content: string,
  parentId?: string | null
): Promise<Comment> {
  // Verifikasi post ada dan dipublish
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });

  if (!post || post.status !== 'published') {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  return addComment('post', postId, authorId, content, parentId);
}

// ─── deleteComment ────────────────────────────────────────────────────────────

/**
 * Hapus komentar berdasarkan ID.
 * Throws 404 jika komentar tidak ada.
 * Throws 403 jika pemohon bukan pemilik komentar maupun admin.
 * Cascade otomatis menghapus semua balasan (via DB ON DELETE CASCADE).
 *
 * Requirements: 6.4, 6.5, 6.6
 */
export async function deleteComment(
  commentId: string,
  requesterId: string,
  requesterRole: string
): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true },
  });

  if (!comment) {
    throw createError(404, 'NOT_FOUND', 'Comment not found');
  }

  const isOwner = comment.authorId === requesterId;
  const isAdmin = requesterRole === 'admin';

  if (!isOwner && !isAdmin) {
    throw createError(403, 'FORBIDDEN', 'Not authorized to delete this comment');
  }

  await prisma.comment.delete({ where: { id: commentId } });
}

// ─── getComments ──────────────────────────────────────────────────────────────

/**
 * Mengembalikan komentar level atas untuk konten tertentu,
 * diurutkan berdasarkan created_at ASC.
 * Setiap komentar level atas menyertakan array replies yang bersarang.
 *
 * Requirements: 6.1, 6.2
 */
export async function getComments(
  contentType: string,
  contentId: string
): Promise<Comment[]> {
  const comments = await prisma.comment.findMany({
    where: {
      contentType,
      contentId,
      parentId: null, // hanya komentar level atas
    },
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: { id: true, username: true },
      },
      replies: {
        include: {
          author: {
            select: { id: true, username: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return comments.map(mapComment);
}

/**
 * Alias untuk backward-compatibility: ambil komentar berdasarkan postId.
 * Wrapper di atas getComments dengan contentType='post'.
 *
 * Requirements: 6.1, 6.2
 */
export async function getCommentsByPost(postId: string): Promise<Comment[]> {
  return getComments('post', postId);
}
