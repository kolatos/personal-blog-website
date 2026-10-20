import { Router } from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  getStats,
  getUsers,
  deleteUser,
  getComments,
} from '../controllers/stats.controller.js';

/**
 * Admin Router — di-mount di /api/admin
 *
 * GET  /stats       — statistik dashboard (hanya admin)
 * GET  /users       — daftar pengguna dipaginasi dengan commentCount (hanya admin)
 * DELETE /users/:id — hapus pengguna + cascade komentar (hanya admin)
 * GET  /comments    — daftar semua komentar dipaginasi, opsional ?contentType= (hanya admin)
 *
 * Requirements: 7.1, 7.3, 7.4, 7.6
 */
const router = Router();

// Semua endpoint admin memerlukan autentikasi dan role admin
router.use(authenticateJWT);
router.use(requireRole('admin'));

/**
 * GET /api/admin/stats
 * Response: { totalPosts, totalComments, totalUsers, recentPosts[5], recentComments[5], recentUsers[5] }
 */
router.get('/stats', getStats);

/**
 * GET /api/admin/users?page=&pageSize=
 * Response: PaginatedResponse<{ id, username, email, role, createdAt, commentCount }>
 */
router.get('/users', getUsers);

/**
 * DELETE /api/admin/users/:id
 * Response: 204 No Content
 */
router.delete('/users/:id', deleteUser);

/**
 * GET /api/admin/comments?page=&pageSize=&contentType=
 * Response: PaginatedResponse<{ id, content, authorUsername, contentType, contentId, contentTitle, parentId, createdAt }>
 */
router.get('/comments', getComments);

export default router;
