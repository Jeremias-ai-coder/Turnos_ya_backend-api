import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const logDir = path.resolve(process.cwd(), 'logs');
const logFile = path.join(logDir, 'requests.log');

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const logLine = `[${new Date().toISOString()}] ${req.method} ${req.url} (ip: ${req.ip})\n`;
  console.log(logLine.trim());

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logFile, logLine);
  } catch {
    // Evitar romper el request si el sistema de archivos no tiene permisos de escritura
  }

  next();
};
