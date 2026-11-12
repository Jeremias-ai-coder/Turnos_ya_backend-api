import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
  console.log('👤 [2/3] Sembrando usuarios iniciales...');

  const email = process.env.SEED_ADMIN_EMAIL;
  const plainPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !plainPassword) {
    console.log('   ℹ Variables de entorno SEED_ADMIN_EMAIL y/o SEED_ADMIN_PASSWORD no configuradas.');
    console.log('   ℹ Omitiendo creación de usuario inicial por seed (requiere variables en .env).');
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    await prisma.user.create({
      data: {
        name: process.env.SEED_ADMIN_NAME || 'Administrador',
        email,
        password: hashedPassword,
        role: 'administrator',
        emailVerified: true,
      }
    });
    console.log(`   ✔ Usuario inicial creado desde variables de entorno: ${email}`);
  } else {
    console.log(`   ℹ Usuario inicial ya existente en base de datos: ${email}`);
  }
}
