import { Request, Response, NextFunction } from 'express';

interface CacheControlOptions {
  maxAgeSeconds?: number;
  sMaxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
  isPrivate?: boolean;
}

/**
 * Middleware para configurar cabeceras estándar HTTP Cache-Control
 * en endpoints públicos o semi-estáticos.
 */
export const httpCacheControl = (options: CacheControlOptions = {}) => {
  const {
    maxAgeSeconds = 300, // 5 minutos por defecto
    sMaxAgeSeconds,
    staleWhileRevalidateSeconds = 600, // 10 minutos stale-while-revalidate
    isPrivate = false
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Solo aplicar en peticiones idempotentes GET / HEAD
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const directives: string[] = [
      isPrivate ? 'private' : 'public',
      `max-age=${maxAgeSeconds}`
    ];

    if (sMaxAgeSeconds !== undefined) {
      directives.push(`s-maxage=${sMaxAgeSeconds}`);
    }

    if (staleWhileRevalidateSeconds > 0) {
      directives.push(`stale-while-revalidate=${staleWhileRevalidateSeconds}`);
    }

    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
};
