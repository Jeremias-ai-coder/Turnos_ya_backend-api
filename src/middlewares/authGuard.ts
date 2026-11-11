import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { prisma } from '../config/prisma';

export const authGuard = (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      throw new AppError('No autorizado', 401);
    }

    let decoded: any;
    try {
      const secret = process.env.JWT_SECRET || 'super_secret';
      decoded = jwt.verify(token, secret);
    } catch (err) {
      throw new AppError('Token inválido o expirado', 401);
    }

    (req as any).user = decoded;

    // Si el token tiene una sesión asociada, verificamos en BD que no haya sido revocada a distancia
    if (decoded?.sessionId) {
      prisma.userSession
        .findUnique({
          where: { id: decoded.sessionId },
        })
        .then((session) => {
          if (session && session.revokedAt !== null) {
            return next(new AppError('La sesión ha sido cerrada de forma remota', 401));
          }

          // Actualización liviana y diferida de última actividad (cada 5 minutos)
          if (session) {
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (session.lastActiveAt < fiveMinAgo) {
              prisma.userSession
                .update({
                  where: { id: decoded.sessionId },
                  data: { lastActiveAt: new Date() },
                })
                .catch(() => { });
            }
          }

          next();
        })
        .catch((dbErr) => {
          console.warn('[AUTH_GUARD] Verificación de sesión no disponible:', dbErr);
          next();
        });
      return;
    }

    next();
  };

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || 'super_secret';
    const decoded: any = jwt.verify(token, secret);

    if (decoded?.sessionId) {
      prisma.userSession
        .findUnique({ where: { id: decoded.sessionId } })
        .then((session) => {
          if (!session || session.revokedAt === null) {
            (req as any).user = decoded;
          }
          next();
        })
        .catch(() => {
          (req as any).user = decoded;
          next();
        });
      return;
    }

    (req as any).user = decoded;
  } catch {
    // No-op para autenticación opcional
  }

  next();
};
