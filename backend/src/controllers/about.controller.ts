import type { Request, Response } from 'express';
import * as aboutService from '../services/about.service.js';
import type {
  CreateAboutSectionDto,
  UpdateAboutSectionDto,
  ReorderAboutSectionsDto,
} from '../schemas/about.schema.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INTERNAL_ERROR_RESPONSE = {
  error: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  },
};

function isServiceError(
  err: unknown
): err is Error & { status: number; code: string; fields?: Record<string, string> } {
  if (!(err instanceof Error)) return false;
  const e = err as unknown as Record<string, unknown>;
  return typeof e['status'] === 'number' && typeof e['code'] === 'string';
}

// ─── GET /api/about ───────────────────────────────────────────────────────────

/**
 * GET /api/about
 * Publik. Mengembalikan semua AboutSection diurutkan berdasarkan type lalu order.
 *
 * Requirements: 2.1, 2.5
 */
export async function getAllSections(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const sections = await aboutService.getAllSections();
    res.status(200).json({ data: sections });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── POST /api/about ─────────────────────────────────────────────────────────

/**
 * POST /api/about
 * Admin only. Membuat AboutSection baru.
 * Body divalidasi oleh validateBody(CreateAboutSectionSchema).
 *
 * Requirements: 2.2
 */
export async function createSection(
  req: Request,
  res: Response
): Promise<void> {
  const data = req.body as CreateAboutSectionDto;

  try {
    const section = await aboutService.createSection(data);
    res.status(201).json({ data: section });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PUT /api/about/:id ───────────────────────────────────────────────────────

/**
 * PUT /api/about/:id
 * Admin only. Mengupdate AboutSection yang ada.
 * Body divalidasi oleh validateBody(UpdateAboutSectionSchema).
 *
 * Requirements: 2.3
 */
export async function updateSection(
  req: Request,
  res: Response
): Promise<void> {
  const id = String(req.params['id']);
  const data = req.body as UpdateAboutSectionDto;

  try {
    const section = await aboutService.updateSection(id, data);
    res.status(200).json({ data: section });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── DELETE /api/about/:id ────────────────────────────────────────────────────

/**
 * DELETE /api/about/:id
 * Admin only. Menghapus AboutSection secara permanen.
 *
 * Requirements: 2.4
 */
export async function deleteSection(
  req: Request,
  res: Response
): Promise<void> {
  const id = String(req.params['id']);

  try {
    await aboutService.deleteSection(id);
    res.status(204).send();
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PATCH /api/about/reorder ────────────────────────────────────────────────

/**
 * PATCH /api/about/reorder
 * Admin only. Batch update field `order` dalam satu transaksi Prisma.
 * Body divalidasi oleh validateBody(ReorderAboutSectionsSchema).
 *
 * Property 4: Reorder Transaction Atomicity
 * Requirements: 2.6
 */
export async function reorderSections(
  req: Request,
  res: Response
): Promise<void> {
  const data = req.body as ReorderAboutSectionsDto;

  try {
    const sections = await aboutService.reorderSections(data);
    res.status(200).json({ data: sections });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}
