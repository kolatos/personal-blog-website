import type { Request, Response } from 'express';
import * as userService from '../services/user.service.js';
import type { UpdateUsernameDto, UpdatePasswordDto } from '../schemas/user.schema.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const INTERNAL_ERROR_RESPONSE = {
  error: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Type-guard: checks whether an unknown thrown value is an enriched Error
 * produced by createError() in user.service.ts.
 */
function isServiceError(
  err: unknown
): err is Error & { status: number; code: string; fields?: Record<string, string> } {
  if (!(err instanceof Error)) return false;
  const e = err as unknown as Record<string, unknown>;
  return typeof e['status'] === 'number' && typeof e['code'] === 'string';
}

// ─── GET /api/users/me ────────────────────────────────────────────────────────

/**
 * GET /api/users/me
 *
 * Returns the profile of the currently authenticated user.
 * `authenticateJWT` + `requireRole('user')` run before this handler.
 *
 * Requirements: 8.1
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
    return;
  }

  const userId = req.user.sub;

  try {
    const profile = await userService.getProfile(userId);
    res.status(200).json({ data: profile });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.fields ? { fields: err.fields } : {}),
        },
      });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PATCH /api/users/me/username ────────────────────────────────────────────

/**
 * PATCH /api/users/me/username
 *
 * Updates the username of the currently authenticated user.
 * Body is pre-validated by validateBody(UpdateUsernameSchema).
 * `authenticateJWT` + `requireRole('user')` run before this handler.
 *
 * Requirements: 8.2, 8.3
 */
export async function updateUsername(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
    return;
  }

  const userId = req.user.sub;
  const { username } = req.body as UpdateUsernameDto;

  try {
    const profile = await userService.updateUsername(userId, username);
    res.status(200).json({ data: profile });
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.fields ? { fields: err.fields } : {}),
        },
      });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}

// ─── PATCH /api/users/me/password ────────────────────────────────────────────

/**
 * PATCH /api/users/me/password
 *
 * Changes the password of the currently authenticated user.
 * Body is pre-validated by validateBody(UpdatePasswordSchema).
 * `authenticateJWT` + `requireRole('user')` run before this handler.
 *
 * Requirements: 8.4, 8.5, 8.6
 */
export async function updatePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
    return;
  }

  const userId = req.user.sub;
  const { oldPassword, newPassword } = req.body as UpdatePasswordDto;

  try {
    await userService.updatePassword(userId, oldPassword, newPassword);
    res.status(204).send();
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.fields ? { fields: err.fields } : {}),
        },
      });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}
