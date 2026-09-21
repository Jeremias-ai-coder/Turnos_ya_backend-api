import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const plainPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !plainPassword) {
    console.error('❌ Error: Las variables de entorno SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorias en .env');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log(`ℹ️ El usuario inicial ya existe (${email}).`);
    return;
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  
  await prisma.user.create({
    data: {
      name: 'Administrador Pruebas',
      email: email,
      password: hashedPassword,
      role: 'owner' // Propietario para que pueda crear negocios
    }
  });

  console.log('✅ Usuario inicial creado exitosamente.');
  console.log('Email:', email);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

