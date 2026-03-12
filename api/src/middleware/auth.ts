import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthPayload {
  userId: string;
  teamMemberId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function generateAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: AuthPayload): string {
  return jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload & { type?: string } {
  return jwt.verify(token, JWT_SECRET) as AuthPayload & { type?: string };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    if (payload.type === 'refresh') {
      res.status(401).json({ error: 'Access token required, not refresh token' });
      return;
    }
    req.user = { userId: payload.userId, teamMemberId: payload.teamMemberId };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
