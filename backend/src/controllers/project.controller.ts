import type { Request, Response } from 'express';
import * as projectService from '../services/project.service.js';
import type { CreateProjectDto, UpdateProjectDto } from '../schemas/project.schema.js';

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

// ─── GET /api/projects ────────────────────────────────────────────────────────

/**
 * GET /api/projects
 * Publik. Mengembalikan project published yang dipaginasi, diurutkan order ASC, createdAt DESC.
 *
 * Requirements: 3.3 (Stage 2)
 */
export async function getPublishedProjects(req: Request, res: Response): Promise<void> {
  const page = parsePage(req.query['page']);
  const pageSize = parsePage(req.query['pageSize']);

  try {
    const result = await projectService.getPublishedProjects(page, pageSize);
    res.status(200).json(result);
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── GET /api/projects/admin ──────────────────────────────────────────────────

/**
 * GET /api/projects/admin
 * Admin only. Mengembalikan semua project (draft + published).
 *
 * Requirements: 3.5 (Stage 2)
 */
export async function getAllProjects(req: Request, res: Response): Promise<void> {
  const page = parsePage(req.query['page']);
  const pageSize = parsePage(req.query['pageSize']);

  try {
    const result = await projectService.getAllProjects(page, pageSize);
    res.status(200).json(result);
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── GET /api/projects/:slug ──────────────────────────────────────────────────

/**
 * GET /api/projects/:slug
 * Publik. Mengembalikan satu project published.
 * Mengembalikan 404 untuk draft.
 *
 * Requirements: 3.3, 3.4 (Stage 2) — Property 1: Content Draft Isolation
 */
export async function getProjectBySlug(req: Request, res: Response): Promise<void> {
  const slug = String(req.params['slug']);

  try {
    const project = await projectService.getProjectBySlug(slug);
    res.status(200).json({ data: project });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── GET /api/projects/admin/:id ─────────────────────────────────────────────

/**
 * GET /api/projects/admin/:id
 * Admin only. Mengembalikan satu project berdasarkan ID (draft + published).
 *
 * Requirements: 3.5 (Stage 2)
 */
export async function getProjectById(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);

  try {
    const project = await projectService.getProjectById(id);
    res.status(200).json({ data: project });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── POST /api/projects ───────────────────────────────────────────────────────

/**
 * POST /api/projects
 * Admin only. Membuat project baru dalam status draft.
 *
 * Requirements: 3.1, 3.2, 3.5 (Stage 2)
 */
export async function createProject(req: Request, res: Response): Promise<void> {
  const data = req.body as CreateProjectDto;

  try {
    const project = await projectService.createProject(data);
    res.status(201).json({ data: project });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PUT /api/projects/:id ────────────────────────────────────────────────────

/**
 * PUT /api/projects/:id
 * Admin only. Mengupdate project. Auto-revert Published → Draft.
 *
 * Requirements: 3.3, 3.4, 3.5 (Stage 2)
 */
export async function updateProject(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);
  const data = req.body as UpdateProjectDto;

  try {
    const project = await projectService.updateProject(id, data);
    res.status(200).json({ data: project });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PATCH /api/projects/:id/publish ─────────────────────────────────────────

/**
 * PATCH /api/projects/:id/publish
 * Admin only. Transisi Draft → Published.
 *
 * Requirements: 3.6 (Stage 2)
 */
export async function publishProject(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);

  try {
    const project = await projectService.publishProject(id);
    res.status(200).json({ data: project });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PATCH /api/projects/:id/unpublish ───────────────────────────────────────

/**
 * PATCH /api/projects/:id/unpublish
 * Admin only. Transisi Published → Draft.
 *
 * Requirements: 3.6 (Stage 2)
 */
export async function unpublishProject(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);

  try {
    const project = await projectService.unpublishProject(id);
    res.status(200).json({ data: project });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────

/**
 * DELETE /api/projects/:id
 * Admin only. Menghapus project secara permanen.
 *
 * Requirements: 3.5 (Stage 2)
 */
export async function deleteProject(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);

  try {
    await projectService.deleteProject(id);
    res.status(204).send();
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}
