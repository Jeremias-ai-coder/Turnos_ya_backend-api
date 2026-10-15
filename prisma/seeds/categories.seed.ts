import { PrismaClient } from '@prisma/client';

export const DEFAULT_CATEGORIES = [
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

export async function seedCategories(prisma: PrismaClient) {
  console.log('📂 [1/3] Sembrando categorías...');

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

  console.log(`   ✔ ${DEFAULT_CATEGORIES.length} categorías sincronizadas.`);
}
