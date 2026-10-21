import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function ensureDatabaseSchema() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;`
    );
    console.log('[DB] Columna email_verified verificada/agregada a users.');
  } catch {
    // Si la columna ya existe, se ignora silenciosamente
  }
}
