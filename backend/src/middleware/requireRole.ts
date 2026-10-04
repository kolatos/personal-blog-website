import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory that checks whether the authenticated user has the required role.
 * Reads `req.user.role` (set by `authenticateJWT` middleware).
 *
 * Returns 403 FORBIDDEN if:
 * - `req.user` is missing (no authenticated user)
 * - `req.user.role` is missing or not a recognised value
 * - `req.user.role` does not match the required role
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */
export function requireRole(role: 'admin' | 'user') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    // req.user not populated (authenticateJWT did not run or was skipped)
    if (!user) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    const validRoles: Array<'admin' | 'user'> = ['admin', 'user'];

    // role claim missing or unrecognised — Requirement 7.2
    if (!user.role || !validRoles.includes(user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    // role does not match required role — Requirement 7.3
    if (user.role !== role) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    next();
  };
}
