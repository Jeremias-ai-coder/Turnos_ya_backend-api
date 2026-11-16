import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

// Limpieza periódica de entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function createRateLimiter(options: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const ip =
      req.ip ||
      req.socket?.remoteAddress ||
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : undefined) ||
      'unknown';
    const userId = (req as any).user?.id ? `:u${(req as any).user.id}` : '';

    const key = `${options.keyPrefix}:${ip}${userId}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > options.max) {
      return next(
        new AppError(
          'Demasiados intentos seguidos. Por favor aguardá unos minutos antes de volver a intentar.',
          429
        )
      );
    }

    return next();
  };
}

