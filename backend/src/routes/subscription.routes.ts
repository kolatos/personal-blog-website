import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import {
  subscribe,
  unsubscribe,
  getStatus,
} from '../services/subscription.service.js';

/**
 * Subscription Router — di-mount di /api/subscriptions
 *
 * POST /           — subscribe user yang sedang login (auth required)
 * DELETE /         — unsubscribe user yang sedang login (auth required)
 * GET  /status     — cek status langganan user (auth required)
 *
 * Requirements: 6.1, 6.2, 6.3
 */
const router = Router();

/**
 * POST /api/subscriptions
 * Body: (kosong — user ID diambil dari JWT)
 * Responses:
 *   201 { subscribed: true }
 *   409 ALREADY_SUBSCRIBED
 */
router.post('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const result = await subscribe(userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/subscriptions
 * Responses:
 *   204 (no body)
 *   404 NOT_SUBSCRIBED
 */
router.delete('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.sub;
    await unsubscribe(userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/subscriptions/status
 * Responses:
 *   200 { subscribed: boolean }
 */
router.get('/status', authenticateJWT, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const result = await getStatus(userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
