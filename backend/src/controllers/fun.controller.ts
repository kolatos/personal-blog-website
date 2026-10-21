import type { Request, Response } from 'express';
import * as funService from '../services/fun.service.js';
import type { CreateFunPostDto, UpdateFunPostDto } from '../schemas/fun.schema.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const INTERNAL_ERROR_RESPONSE = {
  error: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isServiceError(
  err: unknown
): err is Error & { status: number; code: string; fields?: Record<string, string> } {
  if (!(err instanceof Error)) return false;
  const e = err as unknown as Record<string, unknown>;
  return typeof e['status'] === 'number' && typeof e['code'] === 'string';
}

function parsePage(raw: unknown): number {
  const n = parseInt(String(raw), 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

// ─── GET /api/fun ─────────────────────────────────────────────────────────────

/**
 * GET /api/fun
 * Publik. Mengembalikan fun post published yang dipaginasi.
 * Query params opsional: type, tag (slug), page, pageSize.
 *
 * Requirements: 4.2 (Stage 2) — Property 3: Fun feed filter correctness
 */
export async function getFunPosts(req: Request, res: Response): Promise<void> {
  const page = parsePage(req.query['page']);
  const pageSize = parsePage(req.query['pageSize'] ?? 10);
  const type = typeof req.query['type'] === 'string' ? req.query['type'] : undefined;
  const tag = typeof req.query['tag'] === 'string' ? req.query['tag'] : undefined;

  try {
    const result = await funService.getFunPosts(page, pageSize, type, tag);
    res.status(200).json(result);
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── GET /api/fun/admin ───────────────────────────────────────────────────────

/**
 * GET /api/fun/admin
 * Admin only. Mengembalikan semua fun post (draft + published).
 *
 * Requirements: 4.4 (Stage 2)
 */
export async function getAllFunPosts(req: Request, res: Response): Promise<void> {
  const page = parsePage(req.query['page']);
  const pageSize = parsePage(req.query['pageSize'] ?? 20);

  try {
    const result = await funService.getAllFunPosts(page, pageSize);
    res.status(200).json(result);
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── GET /api/fun/:slug ───────────────────────────────────────────────────────

/**
 * GET /api/fun/:slug
 * Publik. Mengembalikan satu fun post published.
 * Mengembalikan 404 untuk draft.
 *
 * Requirements: 4.3 (Stage 2) — Property 1: Content Draft Isolation
 */
export async function getFunPostBySlug(req: Request, res: Response): Promise<void> {
  const slug = String(req.params['slug']);

  try {
    const funPost = await funService.getFunPostBySlug(slug);
    res.status(200).json({ data: funPost });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── GET /api/fun/admin/:id ───────────────────────────────────────────────────

/**
 * GET /api/fun/admin/:id
 * Admin only. Mengembalikan satu fun post berdasarkan ID (draft + published).
 *
 * Requirements: 4.4 (Stage 2)
 */
export async function getFunPostById(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);

  try {
    const funPost = await funService.getFunPostById(id);
    res.status(200).json({ data: funPost });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── POST /api/fun ────────────────────────────────────────────────────────────

/**
 * POST /api/fun
 * Admin only. Membuat fun post baru dalam status draft.
 *
 * Requirements: 4.1, 4.4 (Stage 2)
 */
export async function createFunPost(req: Request, res: Response): Promise<void> {
  const data = req.body as CreateFunPostDto;

  try {
    const funPost = await funService.createFunPost(data);
    res.status(201).json({ data: funPost });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PUT /api/fun/:id ─────────────────────────────────────────────────────────

/**
 * PUT /api/fun/:id
 * Admin only. Mengupdate fun post. Auto-revert Published → Draft.
 *
 * Requirements: 4.4, 4.5 (Stage 2)
 */
export async function updateFunPost(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);
  const data = req.body as UpdateFunPostDto;

  try {
    const funPost = await funService.updateFunPost(id, data);
    res.status(200).json({ data: funPost });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PATCH /api/fun/:id/publish ───────────────────────────────────────────────

/**
 * PATCH /api/fun/:id/publish
 * Admin only. Transisi Draft → Published.
 *
 * Requirements: 4.5 (Stage 2)
 */
export async function publishFunPost(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);

  try {
    const funPost = await funService.publishFunPost(id);
    res.status(200).json({ data: funPost });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PATCH /api/fun/:id/unpublish ─────────────────────────────────────────────

/**
 * PATCH /api/fun/:id/unpublish
 * Admin only. Transisi Published → Draft.
 *
 * Requirements: 4.5 (Stage 2)
 */
export async function unpublishFunPost(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);

  try {
    const funPost = await funService.unpublishFunPost(id);
    res.status(200).json({ data: funPost });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── DELETE /api/fun/:id ──────────────────────────────────────────────────────

/**
 * DELETE /api/fun/:id
 * Admin only. Menghapus fun post secara permanen.
 *
 * Requirements: 4.4 (Stage 2)
 */
export async function deleteFunPost(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);

  try {
    await funService.deleteFunPost(id);
    res.status(204).send();
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}
