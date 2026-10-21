import { NextFunction, Request, Response } from 'express';
import { Role, User } from '../domain/types';
import { DomainError, forbidden } from '../domain/errors';
import { userForToken } from '../services/authService';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    const user = userForToken(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new DomainError('UNAUTHORIZED', 401, 'Please log in'));
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new DomainError('UNAUTHORIZED', 401, 'Please log in'));
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
