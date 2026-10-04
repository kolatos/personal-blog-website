import type { Request, Response } from 'express';
import * as commentService from '../services/comment.service.js';
import type { CreateCommentDto } from '../schemas/comment.schema.js';

// ─── Constants ──────────────────────────────────────────────────────────────
const INTERNAL_ERROR_RESPONSE = {
  error: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Type-guard: checks whether an unknown thrown value is a service error
 * produced by createError() (has .status number and .code string).
 */
function isServiceError(
  err: unknown
): err is Error & { status: number; code: string } {
  if (!(err instanceof Error)) return false;
  const e = err as unknown as Record<string, unknown>;
  return typeof e['status'] === 'number' && typeof e['code'] === 'string';
}

// ─── GET /api/posts/:postId/comments ─────────────────────────────────────────
/**
 * GET /api/posts/:postId/comments
 * Public. Returns all comments for the given post, ordered by created_at ASC.
 * Each comment includes the author's username.
 *
 * Requirements: 6.1, 6.2
 */
export async function getCommentsByPost(
  req: Request,
  res: Response
): Promise<void> {
  const postId = String(req.params['postId']);

  try {
    const comments = await commentService.getCommentsByPost(postId);
    res.status(200).json({ data: comments });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── POST /api/posts/:postId/comments ────────────────────────────────────────
/**
 * POST /api/posts/:postId/comments
 * Registered_User only. Adds a new comment to a published post.
 * Body is pre-validated by validateBody(CreateCommentSchema).
 *
 * Requirements: 6.1, 6.3, 6.7
 */
export async function addComment(
  req: Request,
  res: Response
): Promise<void> {
  const postId = String(req.params['postId']);
  const { content } = req.body as CreateCommentDto;

  // req.user is populated by authenticateJWT middleware
  if (!req.user) {
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
    return;
  }
  const authorId = req.user.sub;

  try {
    const comment = await commentService.addComment(postId, authorId, content);
    res.status(201).json({ data: comment });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── DELETE /api/posts/:postId/comments/:commentId ─────────────────────────────
/**
 * DELETE /api/posts/:postId/comments/:commentId
 * Owner or Admin. Deletes a comment by ID.
 * - Comment owner can delete their own comment (Req 6.4)
 * - Admin can delete any comment (Req 6.5)
 * - Non-owner, non-admin gets 403 (Req 6.6)
 *
 * Requirements: 6.4, 6.5, 6.6
 */
export async function deleteComment(
  req: Request,
  res: Response
): Promise<void> {
  const commentId = String(req.params['commentId']);

  // req.user is populated by authenticateJWT middleware
  if (!req.user) {
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
    return;
  }

  const requesterId = req.user.sub;
  const requesterRole = req.user.role;

  try {
    await commentService.deleteComment(commentId, requesterId, requesterRole);
    res.status(204).send();
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}
