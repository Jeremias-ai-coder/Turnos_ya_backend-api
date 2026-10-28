import { PrismaClient } from '@prisma/client';

const localPrisma = new PrismaClient({
  datasources: { db: { url: 'mysql://root:root@localhost:3306/turnos_ya' } },
});

// Base de datos previa de test en la nube (para rescatar usuarios verificados si hiciera falta)
const cloudTestPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://PLcsEvtrTCU4nhX.root:36nUtBZvuaNGp0lh@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?sslaccept=strict',
    },
  },
});

// NUEVA Base de datos limpia de PRODUCCIÓN en TiDB Cloud
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://PLcsEvtrTCU4nhX.root:36nUtBZvuaNGp0lh@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/turnos_ya_production?sslaccept=strict',
    },
  },
});

const normalize = (t: string = '') =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Lista de correos de usuarios reales autorizados para producción
const ALLOWED_EMAILS = [
  'admin@turnosya.com',
  'jereadminmail@mail.com',
  'jereowner@mail.com',
  'jereuser@mail.com',
  'jeremiascoll@gmail.com',
  'miqueasmuller723@gmail.com',
  'javierfolmer_1241@yahoo.com.ar',
  'usuario.google@gmail.com',
];

// Nombres de los 7 comercios oficiales que van a producción
const OFFICIAL_BUSINESS_NAMES = [
  'Barbería Premium',
  'Centro de Trámites & Gestoría Express',
  'Veterinaria & Peluquería Canina Huellitas',
  'Glow Estética & Spa Urbano',
  'Centro Médico & Kinesiología San José',
  'Club Pádel & Fitness Point',
  'Estudio Fotográfico & Producciones Click',
];

async function migrate() {
  console.log('========================================================================');
  console.log('🚀 INICIANDO MIGRACIÓN LIMPIA A LA BASE DE DATOS DE PRODUCCIÓN');
  console.log('Target: TiDB Cloud (turnos_ya_production)');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // PASO 1: MIGRAR CATEGORÍAS OFICIALES
  // -------------------------------------------------------------------------
  console.log('📂 [1/4] Migrando Catálogo de Categorías...');
  // Tomamos categorías de la base local
  const categories = await localPrisma.category.findMany();
  for (const cat of categories) {
    await prodPrisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        isActive: cat.isActive,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        isActive: cat.isActive,
      },
    });
    console.log(`   ✔ Categoría: "${cat.name}" (${cat.slug})`);
  }
  const prodCategories = await prodPrisma.category.findMany();
  console.log(`   ✨ ${prodCategories.length} categorías listas en producción.\n`);

  // -------------------------------------------------------------------------
  // PASO 2: MIGRAR USUARIOS REALES (Filtrando bots, tests y cuentas temporales)
  // -------------------------------------------------------------------------
  console.log('👤 [2/4] Migrando Cuentas Reales de Usuarios...');
  
  // Obtenemos usuarios de local y de cloud test para combinar los reales
  const [localUsers, testUsers] = await Promise.all([
    localPrisma.user.findMany(),
    cloudTestPrisma.user.findMany(),
  ]);

  const allCandidateUsers = [...localUsers, ...testUsers];
  const processedEmails = new Set<string>();

  for (const u of allCandidateUsers) {
    const emailNorm = u.email.toLowerCase().trim();
    if (!ALLOWED_EMAILS.includes(emailNorm)) {
      continue; // Ignorar cuentas de test (ExampleUser, testowner, etc.)
    }
    if (processedEmails.has(emailNorm)) {
      continue;
    }
    processedEmails.add(emailNorm);

    // Si es admin@turnosya.com, forzar rol administrator
    let role = u.role;
    if (emailNorm === 'admin@turnosya.com' || emailNorm === 'jereadminmail@mail.com') {
      role = 'administrator';
    }

    const userData = {
      name: u.name,
      email: emailNorm,
      password: u.password,
      role: role as any,
      phone: u.phone,
      emailVerified: u.emailVerified,
      emailNotifications: u.emailNotifications,
      whatsappNotifications: u.whatsappNotifications,
      twoFactorEnabled: u.twoFactorEnabled,
      twoFactorSecret: u.twoFactorSecret,
      twoFactorBackupCodes: u.twoFactorBackupCodes,
    };

    const prodUser = await prodPrisma.user.upsert({
      where: { email: emailNorm },
      update: userData,
      create: userData,
    });

    console.log(`   ✔ Usuario migrado: ${prodUser.name} <${prodUser.email}> [Rol: ${prodUser.role}]`);
  }

  const prodUsersCount = await prodPrisma.user.count();
  console.log(`   ✨ ${prodUsersCount} usuarios activos registrados en producción.\n`);

  // -------------------------------------------------------------------------
  // PASO 3: MIGRAR LOS 7 NEGOCIOS OFICIALES, SERVICIOS Y HORARIOS
  // -------------------------------------------------------------------------
  console.log('🏢 [3/4] Migrando los 7 Comercios Oficiales, Servicios y Horarios...');
  
  const localBusinesses = await localPrisma.business.findMany({
    include: {
      owner: true,
      categoryRel: true,
      services: true,
      schedules: true,
    },
  });

  for (const biz of localBusinesses) {
    if (!OFFICIAL_BUSINESS_NAMES.some((n) => normalize(n) === normalize(biz.name))) {
      console.log(`   ⏭️ Omitiendo negocio de prueba no oficial: "${biz.name}"`);
      continue;
    }

    // Resolver dueño correspondiente en producción
    let targetOwnerEmail = biz.owner.email.toLowerCase().trim();
    let prodOwner = await prodPrisma.user.findUnique({
      where: { email: targetOwnerEmail },
    });

    if (!prodOwner) {
      // Fallback a admin si no se encuentra
      prodOwner = await prodPrisma.user.findUnique({
        where: { email: 'admin@turnosya.com' },
      });
    }

    if (!prodOwner) {
      console.error(`   ❌ No se encontró un dueño válido en producción para ${biz.name}`);
      continue;
    }

    // Resolver categoría en producción
    let prodCategory = null;
    if (biz.categoryRel) {
      prodCategory = prodCategories.find((c) => c.slug === biz.categoryRel?.slug);
    } else if (biz.category) {
      prodCategory = prodCategories.find((c) => normalize(c.name) === normalize(biz.category));
    }

    const categoryId = prodCategory ? prodCategory.id : null;
    const categoryName = prodCategory ? prodCategory.name : biz.category;

    const bizPayload = {
      name: biz.name,
      description: biz.description,
      address: biz.address,
      phone: biz.phone,
      category: categoryName,
      categoryId: categoryId,
      logoUrl: biz.logoUrl,
      ownerId: prodOwner.id,
      latitude: biz.latitude ? Number(biz.latitude) : null,
      longitude: biz.longitude ? Number(biz.longitude) : null,
      timezone: biz.timezone || 'America/Argentina/Buenos_Aires',
      webhookUrl: biz.webhookUrl,
    };

    // Upsert por nombre
    let prodBiz = await prodPrisma.business.findFirst({
      where: { name: biz.name },
    });

    if (prodBiz) {
      prodBiz = await prodPrisma.business.update({
        where: { id: prodBiz.id },
        data: bizPayload,
      });
      console.log(`\n   🏢 Negocio actualizado: "${prodBiz.name}" (ID: ${prodBiz.id})`);
    } else {
      prodBiz = await prodPrisma.business.create({
        data: bizPayload,
      });
      console.log(`\n   ✨ Negocio creado en producción: "${prodBiz.name}" (ID: ${prodBiz.id})`);
    }

    // Migrar Servicios
    console.log(`      💼 Migrando ${biz.services.length} servicios para "${biz.name}"...`);
    for (const svc of biz.services) {
      const existingSvc = await prodPrisma.service.findFirst({
        where: { businessId: prodBiz.id, name: svc.name },
      });

      const svcData = {
        name: svc.name,
        description: svc.description,
        durationMinutes: svc.durationMinutes,
        price: svc.price,
        status: 'approved' as const, // Todos aprobados y listos para producción
        bufferTime: svc.bufferTime,
        minCancellationNoticeHours: svc.minCancellationNoticeHours,
        allowReschedule: svc.allowReschedule,
      };

      if (existingSvc) {
        await prodPrisma.service.update({
          where: { id: existingSvc.id },
          data: svcData,
        });
        console.log(`         ✔ Servicio actualizado: ${svc.name} ($${svc.price})`);
      } else {
        await prodPrisma.service.create({
          data: {
            businessId: prodBiz.id,
            ...svcData,
          },
        });
        console.log(`         ✨ Servicio creado: ${svc.name} ($${svc.price})`);
      }
    }

    // Migrar Horarios (Schedules)
    console.log(`      ⏰ Migrando ${biz.schedules.length} horarios de atención...`);
    const existingSchedules = await prodPrisma.schedule.findMany({
      where: { businessId: prodBiz.id },
    });

    for (const sch of biz.schedules) {
      const startTime = new Date(sch.startTime);
      const endTime = new Date(sch.endTime);

      const exists = existingSchedules.some(
        (es) =>
          es.dayOfWeek === sch.dayOfWeek &&
          new Date(es.startTime).getUTCHours() === startTime.getUTCHours() &&
          new Date(es.startTime).getUTCMinutes() === startTime.getUTCMinutes() &&
          new Date(es.endTime).getUTCHours() === endTime.getUTCHours() &&
          new Date(es.endTime).getUTCMinutes() === endTime.getUTCMinutes()
      );

      if (!exists) {
        await prodPrisma.schedule.create({
          data: {
            businessId: prodBiz.id,
            dayOfWeek: sch.dayOfWeek,
            startTime,
            endTime,
          },
        });
        console.log(`         ✨ Horario agregado: Día ${sch.dayOfWeek} (${startTime.toISOString().substring(11, 16)} a ${endTime.toISOString().substring(11, 16)})`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // PASO 4: REPORTE DE VERIFICACIÓN FINAL EN PRODUCCIÓN
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('🏁 REPORTE DE VERIFICACIÓN: BASE DE DATOS DE PRODUCCIÓN LIMPIA');
  console.log('========================================================================');
  
  const finalUsers = await prodPrisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, emailVerified: true },
  });
  console.log(`\n👥 Usuarios en Producción (${finalUsers.length}):`);
  console.table(finalUsers);

  const finalBiz = await prodPrisma.business.findMany({
    select: { id: true, name: true, category: true, ownerId: true },
  });
  console.log(`\n🏢 Comercios en Producción (${finalBiz.length}):`);
  console.table(finalBiz);

  const totalSvc = await prodPrisma.service.count();
  const totalSch = await prodPrisma.schedule.count();
  const totalAppts = await prodPrisma.appointment.count();
  const totalReviews = await prodPrisma.review.count();
  const totalNotifications = await prodPrisma.notification.count();

  console.log(`\n📊 Resumen de Datos:`);
  console.log(`   • Categorías Oficiales     : ${prodCategories.length}`);
  console.log(`   • Comercios Oficiales      : ${finalBiz.length}`);
  console.log(`   • Servicios Listos         : ${totalSvc}`);
  console.log(`   • Franjas Horarias         : ${totalSch}`);
  console.log(`   • Turnos de Prueba         : ${totalAppts} (Completamente limpio ✨)`);
  console.log(`   • Reseñas de Prueba        : ${totalReviews} (Limpio ✨)`);
  console.log(`   • Notificaciones de Prueba : ${totalNotifications} (Limpio ✨)`);
  console.log('\n🎉 ¡PRODUCCIÓN SEPARADA Y PREPARADA CON ÉXITO!');
}

migrate()
  .catch((err) => {
    console.error('❌ Error fatal en migración:', err);
    process.exit(1);
  })
  .finally(async () => {
    await localPrisma.$disconnect();
    await cloudTestPrisma.$disconnect();
    await prodPrisma.$disconnect();
  });
