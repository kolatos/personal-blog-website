import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import type { RegisterDto, LoginDto } from '../types/index';

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
 * produced by `createError()` in auth.service.ts.
 */
function isServiceError(
  err: unknown
): err is Error & { status: number; code: string; fields?: Record<string, string> } {
  if (!(err instanceof Error)) return false;
  const e = err as unknown as Record<string, unknown>;
  return typeof e['status'] === 'number' && typeof e['code'] === 'string';
}

// ─── register ────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * Registers a new Registered_User account.
 * Returns 201 with the newly created UserProfile on success.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.6
 */
export async function register(req: Request, res: Response): Promise<void> {
  const data = req.body as RegisterDto;

  try {
    const profile = await authService.registerUser(data);
    res.status(201).json({ data: profile });
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

// ─── login ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 *
 * Authenticates an Admin (24-hour JWT) or a Registered_User (7-day JWT).
 * The route applies `accountLockoutMiddleware` before reaching this handler,
 * so locked accounts are already rejected with 409 before this runs.
 *
 * Strategy: attempt Admin login first; if the user is found but is not an
 * admin (INVALID_CREDENTIALS), fall back to User login. If both fail, return
 * the generic 401 so we never reveal which field was wrong.
 *
 * On a successful login the failed-attempt counter is reset so that subsequent
 * failures start a fresh count.
 *
 * Requirements: 1.1, 1.3, 1.4, 2.4, 2.5, 7.1
 */
export async function login(req: Request, res: Response): Promise<void> {
  const credentials = req.body as LoginDto;

  // Determine the identifier used for lockout tracking (email or username)
  const lockoutIdentifier: string | undefined =
    credentials.username ?? credentials.email;

  let tokens: Awaited<ReturnType<typeof authService.loginAdmin>> | null = null;

  // --- Try admin login ---
  try {
    tokens = await authService.loginAdmin(credentials);
  } catch (adminErr) {
    if (!isServiceError(adminErr) || adminErr.status !== 401) {
      // Unexpected non-auth error — bail out
      res.status(500).json(INTERNAL_ERROR_RESPONSE);
      return;
    }

    // Admin login failed with 401 → try user login
    try {
      tokens = await authService.loginUser(credentials);
    } catch (userErr) {
      if (!isServiceError(userErr) || userErr.status !== 401) {
        res.status(500).json(INTERNAL_ERROR_RESPONSE);
        return;
      }

      // Both admin and user login failed → record failed attempt
      if (lockoutIdentifier) {
        try {
          await authService.recordFailedAttempt(lockoutIdentifier);

          // After recording, check if this attempt triggered a lockout
          const lockout = await authService.checkAccountLockout(lockoutIdentifier);
          if (lockout.isLocked) {
            res.status(409).json({
              error: {
                code: 'ACCOUNT_LOCKED',
                message: 'Account temporarily locked. Try again in 15 minutes.',
              },
            });
            return;
          }
        } catch {
          // Non-fatal: lockout tracking failure should not block the error response
        }
      }

      // Generic 401 — never reveal which field is wrong (Req 1.3, 2.5)
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
        },
      });
      return;
    }
  }

  // Successful login — reset failed attempt counter
  if (lockoutIdentifier) {
    try {
      await authService.resetFailedAttempts(lockoutIdentifier);
    } catch {
      // Non-fatal: reset failure should not prevent returning the token
    }
  }

  res.status(200).json({ data: tokens });
}

// ─── logout ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 *
 * Invalidates the active JWT by adding it to the blacklist.
 * `authenticateJWT` middleware runs before this handler and populates `req.user`.
 *
 * Returns 204 No Content on success.
 *
 * Requirements: 1.6, 1.7
 */
export async function logout(req: Request, res: Response): Promise<void> {
  // authenticateJWT already verified the token; req.user is populated
  if (!req.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } });
    return;
  }

  const authHeader = req.headers['authorization'] as string;
  const token = authHeader.slice(7); // strip "Bearer "

  const jti = req.user.jti;

  try {
    await authService.logout(token, jti);
    res.status(204).send();
  } catch (err) {
    if (isServiceError(err)) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
      return;
    }
    res.status(500).json(INTERNAL_ERROR_RESPONSE);
  }
}
