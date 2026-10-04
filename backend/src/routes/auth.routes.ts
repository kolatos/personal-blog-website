import { Router } from 'express';
import type { Request, Response } from 'express';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimiter';
import { accountLockoutMiddleware } from '../middleware/accountLockout';
import { authenticateJWT } from '../middleware/authenticateJWT';
import { validateBody } from '../middleware/validateBody';
import { RegisterSchema, LoginSchema } from '../schemas/auth.schema';
import { register, login, logout } from '../controllers/auth.controller';
import prisma from '../lib/prisma';

/**
 * Auth Router — mounted at /api/auth
 *
 * POST /register  — register a new Registered_User
 * POST /login     — authenticate Admin or Registered_User, returns JWT
 * POST /logout    — invalidate the active JWT (requires valid JWT)
 *
 * Requirements: 1.1–1.7, 2.1–2.6, 7.5, 7.6
 */
const router = Router();

/**
 * POST /api/auth/register
 */
router.post(
  '/register',
  registerRateLimiter,
  validateBody(RegisterSchema),
  register
);

/**
 * POST /api/auth/login
 */
router.post(
  '/login',
  loginRateLimiter,
  accountLockoutMiddleware,
  validateBody(LoginSchema),
  login
);

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticateJWT, logout);

/**
 * POST /api/auth/test/reset-lockout  — hanya tersedia di non-production
 * Mereset login_attempts untuk identifier tertentu (digunakan oleh E2E tests).
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test/reset-lockout', async (req: Request, res: Response) => {
    const { identifier } = req.body as { identifier?: string };
    if (identifier) {
      await prisma.loginAttempts.deleteMany({ where: { username: identifier } });
    } else {
      await prisma.loginAttempts.deleteMany({});
    }
    res.status(204).send();
  });
}

export default router;
