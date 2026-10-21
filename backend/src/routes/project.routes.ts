import { Router } from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validateBody.js';
import { CreateProjectSchema, UpdateProjectSchema } from '../schemas/project.schema.js';
import {
  getPublishedProjects,
  getAllProjects,
  getProjectBySlug,
  getProjectById,
  createProject,
  updateProject,
  publishProject,
  unpublishProject,
  deleteProject,
} from '../controllers/project.controller.js';

/**
 * Project Router — di-mount di /api/projects
 *
 * Rute publik (tanpa auth):
 *   GET  /           — daftar project published, dipaginasi
 *   GET  /:slug      — satu project published berdasarkan slug
 *
 * Rute admin-only:
 *   GET    /admin          — semua project (draft + published)
 *   GET    /admin/:id      — satu project berdasarkan ID (untuk edit page prefill)
 *   POST   /               — buat project baru
 *   PUT    /:id            — update project
 *   PATCH  /:id/publish    — publish project
 *   PATCH  /:id/unpublish  — unpublish project
 *   DELETE /:id            — hapus project
 *
 * Requirements: 3.1–3.7 (Stage 2)
 */
const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

/**
 * GET /api/projects
 * Publik. Mengembalikan project published dipaginasi, order ASC, createdAt DESC.
 * Requirements: 3.3 (Stage 2)
 */
router.get('/', getPublishedProjects);

/**
 * GET /api/projects/admin
 * Admin only. Semua project (draft + published).
 * NOTE: Harus didefinisikan SEBELUM /:slug agar "admin" tidak dianggap slug.
 * Requirements: 3.5 (Stage 2)
 */
router.get('/admin', authenticateJWT, requireRole('admin'), getAllProjects);

/**
 * GET /api/projects/admin/:id
 * Admin only. Satu project berdasarkan ID (untuk edit page prefill).
 * NOTE: Harus didefinisikan SEBELUM /:slug.
 * Requirements: 3.5 (Stage 2)
 */
router.get('/admin/:id', authenticateJWT, requireRole('admin'), getProjectById);

/**
 * GET /api/projects/:slug
 * Publik. Satu project published. Mengembalikan 404 untuk draft.
 * Property 1: Content Draft Isolation
 * Requirements: 3.3, 3.4 (Stage 2)
 */
router.get('/:slug', getProjectBySlug);

// ─── Admin-only routes ────────────────────────────────────────────────────────

/**
 * POST /api/projects
 * Admin only. Membuat project baru dalam status draft.
 * Requirements: 3.1, 3.2 (Stage 2)
 */
router.post(
  '/',
  authenticateJWT,
  requireRole('admin'),
  validateBody(CreateProjectSchema),
  createProject
);

/**
 * PUT /api/projects/:id
 * Admin only. Mengupdate project. Auto-revert Published → Draft.
 * Requirements: 3.3, 3.4, 3.5 (Stage 2)
 */
router.put(
  '/:id',
  authenticateJWT,
  requireRole('admin'),
  validateBody(UpdateProjectSchema),
  updateProject
);

/**
 * PATCH /api/projects/:id/publish
 * Admin only. Transisi Draft → Published.
 * Requirements: 3.6 (Stage 2)
 */
router.patch('/:id/publish', authenticateJWT, requireRole('admin'), publishProject);

/**
 * PATCH /api/projects/:id/unpublish
 * Admin only. Transisi Published → Draft.
 * Requirements: 3.6 (Stage 2)
 */
router.patch('/:id/unpublish', authenticateJWT, requireRole('admin'), unpublishProject);

/**
 * DELETE /api/projects/:id
 * Admin only. Hapus project secara permanen.
 * Requirements: 3.5 (Stage 2)
 */
router.delete('/:id', authenticateJWT, requireRole('admin'), deleteProject);

export default router;
