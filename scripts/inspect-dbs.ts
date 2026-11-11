import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const localUrl = process.env.LOCAL_DATABASE_URL || 'mysql://root:root@localhost:3306/turnos_ya';
const prodUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!prodUrl) {
  throw new Error('Definí PROD_DATABASE_URL o DATABASE_URL en las variables de entorno antes de ejecutar este script.');
}

const localPrisma = new PrismaClient({
  datasources: { db: { url: localUrl } },
});

const prodPrisma = new PrismaClient({
  datasources: { db: { url: prodUrl } },
});

async function inspect() {
  console.log('====================================================');
  console.log('🏠 BASE DE DATOS LOCAL (DEVELOPMENT)');
  console.log('====================================================');
  const localUsers = await localPrisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, emailVerified: true },
  });
  console.log(`Usuarios (${localUsers.length}):`);
  console.table(localUsers);

  const localBusinesses = await localPrisma.business.findMany({
    select: { id: true, name: true, category: true, ownerId: true },
  });
  console.log(`Negocios (${localBusinesses.length}):`);
  console.table(localBusinesses);

  const localCategories = await localPrisma.category.findMany({
    select: { id: true, name: true, slug: true, isActive: true },
  });
  console.log(`Categorías (${localCategories.length}):`);
  console.table(localCategories);

  console.log('Servicios:', await localPrisma.service.count());
  console.log('Horarios:', await localPrisma.schedule.count());
  console.log('Turnos/Appointments:', await localPrisma.appointment.count());
  console.log('Notificaciones:', await localPrisma.notification.count());

  console.log('\n====================================================');
  console.log('☁️ BASE DE DATOS NUBE (PRODUCCIÓN - TiDB Cloud)');
  console.log('====================================================');
  const prodUsers = await prodPrisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, emailVerified: true },
  });
  console.log(`Usuarios en Producción (${prodUsers.length}):`);
  console.table(prodUsers);

  const prodBusinesses = await prodPrisma.business.findMany({
    select: { id: true, name: true, category: true, ownerId: true },
  });
  console.log(`Negocios en Producción (${prodBusinesses.length}):`);
  console.table(prodBusinesses);

  const prodCategories = await prodPrisma.category.findMany({
    select: { id: true, name: true, slug: true, isActive: true },
  });
  console.log(`Categorías en Producción (${prodCategories.length}):`);
  console.table(prodCategories);

  console.log('Servicios:', await prodPrisma.service.count());
  console.log('Horarios:', await prodPrisma.schedule.count());
  const prodAppointments = await prodPrisma.appointment.findMany({
    select: { id: true, businessId: true, serviceId: true, userId: true, status: true, date: true, time: true },
  });
  console.log(`Turnos/Appointments en Producción (${prodAppointments.length}):`);
  if (prodAppointments.length > 0) {
    console.table(prodAppointments);
  }
  console.log('Notificaciones:', await prodPrisma.notification.count());
}

inspect()
  .catch((err) => {
    console.error('Error inspeccionando:', err);
  })
  .finally(async () => {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  });
