import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedCategories } from './categories.seed';
import { seedUsers } from './users.seed';
import { seedBusinesses } from './businesses.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 ========================================');
  console.log('🌱 Iniciando ejecución modular de seeders...');
  console.log('🌱 ========================================');

  // Orden estricto de dependencias
  await seedCategories(prisma);
  await seedUsers(prisma);
  await seedBusinesses(prisma);

  console.log('🎉 ========================================');
  console.log('🎉 ¡Todos los seeders finalizaron con éxito!');
  console.log('🎉 ========================================');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando los seeders:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
