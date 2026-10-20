import type { Request, Response } from 'express';
import * as postService from '../services/post.service.js';
import type { CreatePostDto, UpdatePostDto } from '../types/index.js';

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
 * produced by createError() (has `.status` number and `.code` string).
 */
function isServiceError(
  err: unknown
): err is Error & { status: number; code: string; fields?: Record<string, string> } {
  if (!(err instanceof Error)) return false;
  const e = err as unknown as Record<string, unknown>;
  return typeof e['status'] === 'number' && typeof e['code'] === 'string';
}

/**
 * Parses a positive integer page number from a query string value.
 * Falls back to 1 if missing or invalid.
 */
function parsePage(raw: unknown): number {
  const n = parseInt(String(raw), 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

// ─── GET /api/posts ──────────────────────────────────────────────────────────

/**
 * GET /api/posts
 * Public. Returns paginated Published posts ordered by published_at DESC.
 *
 * Query params:
 *   page     - page number (default 1)
 *   pageSize - items per page (default 10)
 *
 * Requirements: 5.1, 5.4
 */
export async function getPublishedPosts(
  req: Request,
  res: Response
): Promise<void> {
  const page = parsePage(req.query['page']);
  const pageSize = parsePage(req.query['pageSize']);

  try {
    const result = await postService.getPublishedPosts(page, pageSize);
    res.status(200).json(result);
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

// ─── GET /api/posts/admin ─────────────────────────────────────────────────────

/**
 * GET /api/posts/admin
 * Admin only. Returns all posts (Draft + Published) ordered by updated_at DESC.
 *
 * Query params:
 *   page     - page number (default 1)
 *   pageSize - items per page (default 20)
 *
 * Requirements: 4.5
 */
export async function getAllPosts(
  req: Request,
  res: Response
): Promise<void> {
  const page = parsePage(req.query['page']);
  const pageSize = parsePage(req.query['pageSize']);

  try {
    const result = await postService.getAllPosts(page, pageSize);
    res.status(200).json(result);
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

// ─── GET /api/posts/search ────────────────────────────────────────────────────

/**
 * GET /api/posts/search?keyword=...
 * Public. Full-text search over Published posts.
 * Rejects blank/whitespace-only keywords with 400.
 *
 * Query params:
 *   keyword - search term (required, non-empty/non-whitespace)
 *   page    - page number (default 1)
 *
 * Requirements: 5.5, 5.6, 5.7
 */
export async function searchPosts(
  req: Request,
  res: Response
): Promise<void> {
  const keyword = String(req.query['keyword'] ?? '').trim();

  if (!keyword) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Search keyword cannot be empty or consist only of whitespace',
        fields: { keyword: 'Keyword is required and must contain at least one non-whitespace character' },
      },
    });
    return;
  }

  const page = parsePage(req.query['page']);

  try {
    const result = await postService.searchPosts(keyword, page);
    res.status(200).json(result);
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

// ─── GET /api/posts/:slug ─────────────────────────────────────────────────────

/**
 * GET /api/posts/:slug
 * Public. Returns a single Published post by its slug.
 * Returns 404 for drafts or non-existent posts (never reveals draft existence).
 *
 * Requirements: 5.2, 5.3, 4.7
 */
export async function getPostBySlug(
  req: Request,
  res: Response
): Promise<void> {
  const slug = String(req.params['slug']);

  try {
    const post = await postService.getPostBySlug(slug);
    res.status(200).json({ data: post });
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

// ─── POST /api/posts ──────────────────────────────────────────────────────────

/**
 * POST /api/posts
 * Admin only. Creates a new Draft post.
 * Body is pre-validated by validateBody(CreatePostSchema).
 *
 * Requirements: 3.1, 3.2, 3.5, 3.7
 */
export async function createPost(
  req: Request,
  res: Response
): Promise<void> {
  const data = req.body as CreatePostDto;

  try {
    const post = await postService.createPost(data);
    res.status(201).json({ data: post });
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

// ─── PUT /api/posts/:id ───────────────────────────────────────────────────────

/**
 * PUT /api/posts/:id
 * Admin only. Updates an existing post. Auto-reverts Published → Draft.
 * Body is pre-validated by validateBody(UpdatePostSchema).
 *
 * Requirements: 3.3, 3.4, 3.5
 */
export async function updatePost(
  req: Request,
  res: Response
): Promise<void> {
  const id = String(req.params['id']);
  const data = req.body as UpdatePostDto;

  try {
    const post = await postService.updatePost(id, data);
    res.status(200).json({ data: post });
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

// ─── PATCH /api/posts/:id/publish ─────────────────────────────────────────────

/**
 * PATCH /api/posts/:id/publish
 * Admin only. Transitions a Draft post to Published.
 *
 * Requirements: 4.1, 4.6
 */
export async function publishPost(
  req: Request,
  res: Response
): Promise<void> {
  const id = String(req.params['id']);

  try {
    const post = await postService.publishPost(id);
    res.status(200).json({ data: post });
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

// ─── PATCH /api/posts/:id/unpublish ───────────────────────────────────────────

/**
 * PATCH /api/posts/:id/unpublish
 * Admin only. Transitions a Published post back to Draft.
 *
 * Requirements: 4.2, 4.6
 */
export async function unpublishPost(
  req: Request,
  res: Response
): Promise<void> {
  const id = String(req.params['id']);

  try {
    const post = await postService.unpublishPost(id);
    res.status(200).json({ data: post });
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

// ─── DELETE /api/posts/:id ────────────────────────────────────────────────────

/**
 * DELETE /api/posts/:id
 * Admin only. Permanently deletes a post and its associated comments (via CASCADE).
 *
 * Requirements: 4.3, 4.8
 */
export async function deletePost(
  req: Request,
  res: Response
): Promise<void> {
  const id = String(req.params['id']);

  try {
    await postService.deletePost(id);
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

// ─── GET /api/posts/admin/:id ─────────────────────────────────────────────────

/**
 * GET /api/posts/admin/:id
 * Admin only. Returns a single post by its ID (works for both Draft and Published).
 * Used by the admin edit page to prefill the post editor.
 *
 * Requirements: 3.3, 4.4
 */
export async function getAdminPostById(
  req: Request,
  res: Response
): Promise<void> {
  const id = String(req.params['id']);

  try {
    const post = await postService.getPostById(id);
    res.status(200).json({ data: post });
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

// ─── GET /api/tags ────────────────────────────────────────────────────────────

/**
 * GET /api/tags
 * Public. Returns all tags sorted alphabetically.
 *
 * Requirements: 2.4
 */
export async function getTags(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const tags = await postService.getAllTags();
    res.status(200).json(tags);
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
