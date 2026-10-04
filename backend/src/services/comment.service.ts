import prisma from '../lib/prisma.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  createdAt: string;
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

// ─── Map Prisma Comment → Comment interface ───────────────────────────────────

function mapComment(raw: {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  author?: { username: string };
}): Comment {
  return {
    id: raw.id,
    postId: raw.postId,
    authorId: raw.authorId,
    authorUsername: raw.author?.username ?? '',
    content: raw.content,
    createdAt: raw.createdAt.toISOString(),
  };
}

// ─── addComment ───────────────────────────────────────────────────────────────

/**
 * Adds a new comment to a published post.
 * Throws 404 if the post does not exist or is not published.
 * Content length validation (1–2000 chars) is handled upstream by Zod schema.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.7
 */
export async function addComment(
  postId: string,
  authorId: string,
  content: string
): Promise<Comment> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });

  if (!post || post.status !== 'published') {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId,
      content,
    },
    include: {
      author: {
        select: { username: true },
      },
    },
  });

  return mapComment(comment);
}

// ─── deleteComment ────────────────────────────────────────────────────────────

/**
 * Deletes a comment by ID.
 * Throws 404 if the comment does not exist.
 * Throws 403 if the requester is neither the comment owner nor an admin.
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

// ─── getCommentsByPost ────────────────────────────────────────────────────────

/**
 * Returns all comments for a given post, ordered by created_at ASC.
 * Includes the author's username via a Prisma relation join.
 *
 * Requirements: 6.1, 6.2
 */
export async function getCommentsByPost(postId: string): Promise<Comment[]> {
  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: { username: true },
      },
    },
  });

  return comments.map(mapComment);
}
