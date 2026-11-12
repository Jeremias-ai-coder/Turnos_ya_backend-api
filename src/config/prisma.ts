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

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE users ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;`
    );
    console.log('[DB] Columna created_at verificada/agregada a users.');
  } catch {
    // Si la columna ya existe, se ignora silenciosamente
  }

  // 3. Garantizar que las cuentas de administración oficiales tengan rol 'administrator' y email_verified = true
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE users 
      SET role = 'administrator', email_verified = 1 
      WHERE LOWER(email) IN ('turnosyapp@gmail.com', 'jeremiascollaud@gmail.com', 'jeremiascoll@gmail.com');
    `);
    console.log('[DB] Cuentas de administración oficiales promovidas a administrator.');
  } catch (err) {
    console.warn('[DB] Error actualizando roles de administración:', err);
  }

  // 4. Si existe admin@turnosya.com, reasignar sus comercios a turnosyapp@gmail.com y eliminarlo
  try {
    const oldAdmin = await prisma.user.findUnique({ where: { email: 'admin@turnosya.com' } });
    const newAdmin = await prisma.user.findUnique({ where: { email: 'turnosyapp@gmail.com' } });
    if (oldAdmin && newAdmin) {
      await prisma.$executeRawUnsafe(
        `UPDATE businesses SET owner_id = ${newAdmin.id} WHERE owner_id = ${oldAdmin.id}`
      );
      await prisma.$executeRawUnsafe(
        `UPDATE appointments SET user_id = ${newAdmin.id} WHERE user_id = ${oldAdmin.id}`
      );
      await prisma.$executeRawUnsafe(
        `UPDATE notifications SET user_id = ${newAdmin.id} WHERE user_id = ${oldAdmin.id}`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM user_sessions WHERE user_id = ${oldAdmin.id}`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM users WHERE id = ${oldAdmin.id}`
      );
      console.log('[DB] Cuenta admin@turnosya.com migrada y eliminada exitosamente en arranque.');
    }
  } catch (err) {
    console.warn('[DB] Error migrando cuenta vieja admin@turnosya.com:', err);
  }
}
