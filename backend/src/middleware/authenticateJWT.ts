import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { JwtPayload } from '../types/index';

const UNAUTHORIZED_RESPONSE = {
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
  },
};

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(UNAUTHORIZED_RESPONSE);
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  if (!token) {
    res.status(401).json(UNAUTHORIZED_RESPONSE);
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(401).json(UNAUTHORIZED_RESPONSE);
    return;
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, secret) as JwtPayload;
  } catch {
    // Covers expired tokens (TokenExpiredError) and invalid tokens (JsonWebTokenError)
    res.status(401).json(UNAUTHORIZED_RESPONSE);
    return;
  }

  // Check token blacklist by jti
  try {
    const blacklisted = await prisma.tokenBlacklist.findUnique({
      where: { jti: decoded.jti },
    });

    if (blacklisted) {
      res.status(401).json(UNAUTHORIZED_RESPONSE);
      return;
    }
  } catch {
    // Database error — fail closed (deny access)
    res.status(401).json(UNAUTHORIZED_RESPONSE);
    return;
  }

  req.user = decoded;
  next();
}
