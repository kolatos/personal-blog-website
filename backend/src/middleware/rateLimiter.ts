import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

const isDev = process.env.NODE_ENV === "development";

/**
 * Rate limiter khusus login — mencegah brute-force password.
 * - Production: maks 10 req/IP/60s
 * - Development/test: maks 100 req/IP/60s (agar E2E tidak tersandung)
 *
 * Requirements: 7.5, 7.6
 */
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please wait",
      },
    });
  },
});

/**
 * Rate limiter untuk registrasi.
 * - Production: maks 30 req/IP/60s
 * - Development/test: maks 100 req/IP/60s
 *
 * Requirements: 7.5
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please wait",
      },
    });
  },
});
