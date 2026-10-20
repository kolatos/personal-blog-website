import type { Request, Response } from 'express';
import * as commentService from '../services/comment.service.js';
import type { CreateCommentDto, CreateCommentLegacyDto } from '../schemas/comment.schema.js';

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

// ─── GET /api/comments?contentType=&contentId= ───────────────────────────────
/**
 * GET /api/comments?contentType=&contentId=
 * Public. Mengembalikan komentar level atas dengan balasan bersarang.
 *
 * Requirements: 6.1, 6.2
 */
export async function getComments(
  req: Request,
  res: Response
): Promise<void> {
  const contentType = String(req.query['contentType'] ?? '');
  const contentId = String(req.query['contentId'] ?? '');

  if (!contentType || !contentId) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'contentType and contentId query parameters are required',
      },
    });
    return;
  }

  try {
    const comments = await commentService.getComments(contentType, contentId);
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

// ─── GET /api/posts/:postId/comments (legacy alias) ──────────────────────────
/**
 * GET /api/posts/:postId/comments
 * Public. Alias backward-compatible untuk mengambil komentar pada post.
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

// ─── POST /api/comments ───────────────────────────────────────────────────────
/**
 * POST /api/comments
 * Authenticated. Tambah komentar baru pada konten apapun.
 * Body divalidasi oleh validateBody(CreateCommentSchema).
 *
 * Requirements: 6.1, 6.3, 6.7
 */
export async function addComment(
  req: Request,
  res: Response
): Promise<void> {
  const { contentType, contentId, content, parentId } = req.body as CreateCommentDto;

  if (!req.user) {
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
    return;
  }
  const authorId = req.user.sub;

  try {
    const comment = await commentService.addComment(
      contentType,
      contentId,
      authorId,
      content,
      parentId ?? null
    );
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

// ─── POST /api/posts/:postId/comments (legacy alias) ─────────────────────────
/**
 * POST /api/posts/:postId/comments
 * Authenticated. Alias backward-compatible untuk menambah komentar pada post.
 * Body divalidasi oleh validateBody(CreateCommentLegacySchema).
 *
 * Requirements: 6.1, 6.3, 6.7
 */
export async function addCommentToPost(
  req: Request,
  res: Response
): Promise<void> {
  const postId = String(req.params['postId']);
  const { content, parentId } = req.body as CreateCommentLegacyDto;

  if (!req.user) {
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
    return;
  }
  const authorId = req.user.sub;

  try {
    const comment = await commentService.addCommentToPost(
      postId,
      authorId,
      content,
      parentId ?? null
    );
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

// ─── DELETE /api/comments/:id ─────────────────────────────────────────────────
/**
 * DELETE /api/comments/:id
 * Owner atau Admin. Hapus komentar berdasarkan ID.
 * Cascade otomatis menghapus balasan di DB.
 *
 * Requirements: 6.4, 6.5, 6.6
 */
export async function deleteComment(
  req: Request,
  res: Response
): Promise<void> {
  const commentId = String(req.params['id'] ?? req.params['commentId']);

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
