import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'parkflow-enterprise-secret-2026';

export interface AdminTokenPayload {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminTokenPayload;
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }
}
