import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { prisma } from '../config/prisma';

// =========================================================================================
// MIDDLEWARE DE AUTENTICACIÓN Y CONTROL DE ACCESO (authGuard)
// Capa: Presentación / Infraestructura HTTP
// Responsabilidades:
//  1. Extraer el token Bearer del encabezado Authorization o Query param.
//  2. Verificar la firma criptográfica y expiración mediante JWT_SECRET.
//  3. PREVENCIÓN DE TOKEN CONFUSION ATTACKS: Exigir { type: 'SESSION' } y descartar scopes temporales.
//  4. KILL SWITCH REMOTO: Validar contra la tabla 'user_sessions' que la sesión no haya sido revocada.
//  5. Inyectar la identidad validada en 'req.user' para los controladores.
// =========================================================================================

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

    // MITIGACIÓN DE TOKEN CONFUSION:
    // Rechaza tokens que no posean un ID numérico, tokens con scope temporal (ej. '2fa_pending')
    // o tokens con tipos distintos a 'SESSION' (ej. 'PASSWORD_RESET', 'VERIFY_EMAIL').
    if (!decoded || typeof decoded.id !== 'number' || decoded.scope || (decoded.type && decoded.type !== 'SESSION')) {
      throw new AppError('Token inválido o no autorizado para sesión', 401);
    }

    (req as any).user = decoded;

    // CONTROL REMOTO DE SESIONES:
    // Si el token incluye sessionId, comprobamos en la tabla 'user_sessions' si fue revocado.
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
