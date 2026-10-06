import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  {
    name: 'Peluquería',
    slug: 'peluqueria',
    description: 'Cortes de pelo, barberías y peinados',
    icon: 'Scissors'
  },
  {
    name: 'Estética',
    slug: 'estetica',
    description: 'Spa, manicuría, cuidado corporal y belleza',
    icon: 'Sparkles'
  },
  {
    name: 'Salud',
    slug: 'salud',
    description: 'Médicos, kinesiología, odontología y clínicas',
    icon: 'HeartPulse'
  },
  {
    name: 'Deportes',
    slug: 'deportes',
    description: 'Canchas, gimnasios y entrenamientos',
    icon: 'Trophy'
  },
  {
    name: 'Trámites',
    slug: 'tramites',
    description: 'Gestorías, escribanías y asesorías',
    icon: 'FileText'
  },
  {
    name: 'Mascotas',
    slug: 'mascotas',
    description: 'Veterinarias y peluquerías caninas',
    icon: 'PawPrint'
  },
  {
    name: 'Otros',
    slug: 'otros',
    description: 'Servicios generales y otros rubros',
    icon: 'MoreHorizontal'
  },
  {
    name: 'Gastronomía',
    slug: 'gastronomia',
    description: 'Restaurantes, bares y cafeterías',
    icon: 'Utensils'
  },
  {
    name: 'Educación',
    slug: 'educacion',
    description: 'Cursos, talleres y clases particulares',
    icon: 'GraduationCap'
  },
  {
    name: 'Automotor',
    slug: 'automotor',
    description: 'Mecánica, lavaderos y gomerías',
    icon: 'Car'
  }
];

const normalizeText = (text: string = '') =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

async function main() {
  console.log('🌱 Iniciando seeder de Turnos Ya...');

  // 1. Cargar o actualizar categorías oficiales
  console.log('📂 Cargando categorías...');
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        isActive: true
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        isActive: true
      }
    });
  }
  console.log(`✅ ${DEFAULT_CATEGORIES.length} categorías cargadas correctamente.`);

  // 2. Asociar comercios existentes con su respectiva categoría
  const allCategories = await prisma.category.findMany();
  const allBusinesses = await prisma.business.findMany();

  console.log('🔗 Verificando vinculación de comercios con categorías...');
  for (const biz of allBusinesses) {
    if (biz.category) {
      const normBizCat = normalizeText(biz.category);
      const matched = allCategories.find(c =>
        c.slug === normBizCat ||
        normalizeText(c.name) === normBizCat
      );

      if (matched && biz.categoryId !== matched.id) {
        await prisma.business.update({
          where: { id: biz.id },
          data: {
            categoryId: matched.id,
            category: matched.name
          }
        });
        console.log(`   ✔ "${biz.name}" asignado a "${matched.name}" (ID ${matched.id})`);
      }
    }
  }

  // 3. Crear usuario administrador inicial si no existe
  const email = process.env.SEED_ADMIN_EMAIL;
  const plainPassword = process.env.SEED_ADMIN_PASSWORD;

  if (email && plainPassword) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      await prisma.user.create({
        data: {
          name: 'Administrador Pruebas',
          email: email,
          password: hashedPassword,
          role: 'owner'
        }
      });
      console.log('✅ Usuario inicial creado exitosamente:', email);
    } else {
      console.log(`ℹ️ Usuario inicial ya existe (${email}).`);
    }
  }

  console.log('🎉 Seeder finalizado con éxito.');
}

main()
  .catch(e => {
    console.error('❌ Error ejecutando el seeder:', e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
