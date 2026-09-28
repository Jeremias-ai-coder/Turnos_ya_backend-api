import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- LIMPIANDO DATOS DEL TEST AUTOMATIZADO ---');
  const deletedNotifs = await prisma.notification.deleteMany();
  console.log(`Notificaciones de prueba eliminadas: ${deletedNotifs.count}`);

  const deletedApp = await prisma.appointment.deleteMany({
    where: { id: 49 }
  });
  console.log(`Turno de prueba 49 eliminado: ${deletedApp.count}`);

  const remainingNotifs = await prisma.notification.findMany();
  console.log('Notificaciones restantes en la base de datos:', remainingNotifs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
