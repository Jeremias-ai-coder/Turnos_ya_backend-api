import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
  console.log('👤 [2/3] Sembrando usuarios iniciales...');

  const email = process.env.SEED_ADMIN_EMAIL || 'turnosyapp@gmail.com';
  const plainPassword = process.env.SEED_ADMIN_PASSWORD || 'password123';

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Administrador Turnos Ya',
        email,
        password: hashedPassword,
        role: 'administrator',
        emailVerified: true,
      }
    });
    console.log(`   ✔ Usuario inicial creado: ${email}`);
  } else {
    console.log(`   ℹ Usuario inicial ya existente: ${email}`);
  }
}
