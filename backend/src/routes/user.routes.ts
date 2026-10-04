import { Router } from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validateBody.js';
import { UpdateUsernameSchema, UpdatePasswordSchema } from '../schemas/user.schema.js';
import {
  getProfile,
  updateUsername,
  updatePassword,
} from '../controllers/user.controller.js';

/**
 * User Router — mounted at /api/users
 *
 * All routes require a valid JWT with role='user'.
 *
 * GET  /me              — return the authenticated user's profile
 * PATCH /me/username    — update the authenticated user's username
 * PATCH /me/password    — update the authenticated user's password
 *
 * Requirements: 8.1–8.6
 */
const router = Router();

// ─── Registered_User routes ───────────────────────────────────────────────────

/**
 * GET /api/users/me
 *
 * Returns the profile of the currently authenticated user.
 *
 * Middleware chain:
 *  1. authenticateJWT    — verify token, populate req.user
 *  2. requireRole('user') — only Registered_Users can access their profile
 *  3. getProfile          — fetch and return the user profile
 *
 * Requirements: 8.1
 */
router.get('/me', authenticateJWT, requireRole('user'), getProfile);

/**
 * PATCH /api/users/me/username
 *
 * Updates the username of the currently authenticated user.
 *
 * Middleware chain:
 *  1. authenticateJWT         — verify token, populate req.user
 *  2. requireRole('user')     — only Registered_Users can update username
 *  3. validateBody            — validate against UpdateUsernameSchema (Req 8.2)
 *  4. updateUsername          — perform the update (Req 8.2, 8.3)
 *
 * Requirements: 8.2, 8.3
 */
router.patch(
  '/me/username',
  authenticateJWT,
  requireRole('user'),
  validateBody(UpdateUsernameSchema),
  updateUsername
);

/**
 * PATCH /api/users/me/password
 *
 * Changes the password of the currently authenticated user.
 *
 * Middleware chain:
 *  1. authenticateJWT         — verify token, populate req.user
 *  2. requireRole('user')     — only Registered_Users can change password
 *  3. validateBody            — validate against UpdatePasswordSchema (Req 8.4, 8.6)
 *  4. updatePassword          — perform the password change (Req 8.4, 8.5, 8.6)
 *
 * Requirements: 8.4, 8.5, 8.6
 */
router.patch(
  '/me/password',
  authenticateJWT,
  requireRole('user'),
  validateBody(UpdatePasswordSchema),
  updatePassword
);

export default router;
