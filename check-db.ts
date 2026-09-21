import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const testPasswords = ['password123', '123456', 'admin123', 'admin', 'password', '12345678', 'jere123', 'jere', '1234'];
  
  console.log('--- USUARIOS Y PRUEBA DE CONTRASEÑAS ---');
  for (const user of users) {
    let matchedPass = null;
    for (const p of testPasswords) {
      if (await bcrypt.compare(p, user.password).catch(() => false)) {
        matchedPass = p;
        break;
      }
    }
    console.log(`ID: ${user.id} | Name: ${user.name} | Email: ${user.email} | Role: ${user.role} | Contraseña detectada: ${matchedPass || 'DESCONOCIDA (hash personalizado)'}`);
  }

  const businesses = await prisma.business.findMany({
    include: { services: true }
  });
  console.log('\n--- NEGOCIOS REGISTRADOS ---');
  for (const b of businesses) {
    console.log(`ID: ${b.id} | Nombre: ${b.name} | Dueño ID: ${b.ownerId} | Categoría: ${b.category} | Servicios: ${b.services.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());


