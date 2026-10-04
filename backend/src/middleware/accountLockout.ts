import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

/**
 * Middleware to check if an account is temporarily locked due to too many
 * failed login attempts. Reads the `login_attempts` table via Prisma.
 *
 * - If `locked_until` is in the future → returns 409 ACCOUNT_LOCKED
 * - If not locked or no record found → calls next()
 *
 * The username to check comes from `req.body.username` or `req.body.email`.
 *
 * Requirements: 1.4
 */
export async function accountLockoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const identifier: string | undefined =
    req.body.username ?? req.body.email;

  // If no identifier is provided, let downstream validation handle it
  if (!identifier) {
    next();
    return;
  }

  try {
    const record = await prisma.loginAttempts.findUnique({
      where: { username: identifier },
      select: { lockedUntil: true },
    });

    if (record?.lockedUntil && record.lockedUntil > new Date()) {
      res.status(409).json({
        error: {
          code: "ACCOUNT_LOCKED",
          message: "Account temporarily locked. Try again in 15 minutes.",
        },
      });
      return;
    }

    next();
  } catch {
    // On database errors, fail open so legitimate users are not blocked
    next();
  }
}
