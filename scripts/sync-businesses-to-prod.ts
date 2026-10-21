import { PrismaClient } from '@prisma/client';

const localPrisma = new PrismaClient({
  datasources: { db: { url: 'mysql://root:root@localhost:3306/turnos_ya' } },
});

const prodUrl =
  'mysql://PLcsEvtrTCU4nhX.root:36nUtBZvuaNGp0lh@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?sslaccept=strict';
const prodPrisma = new PrismaClient({
  datasources: { db: { url: prodUrl } },
});

const normalizeText = (text: string = '') =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

async function sync() {
  console.log('🚀 Iniciando sincronización de negocios local -> producción...');

  // 1. Obtener datos locales
  const localBusinesses = await localPrisma.business.findMany({
    include: {
      owner: true,
      categoryRel: true,
      services: true,
      schedules: true,
    },
  });
  console.log(`📦 Encontrados ${localBusinesses.length} negocios en la base local.`);

  // 2. Obtener categorías de producción
  const prodCategories = await prodPrisma.category.findMany();
  console.log(`📂 Encontradas ${prodCategories.length} categorías en producción.`);

  // 3. Iterar cada negocio local
  for (const localBiz of localBusinesses) {
    console.log(`\n========================================`);
    console.log(`🏢 Sincronizando negocio: "${localBiz.name}"...`);

    // Resolver dueño en producción
    let prodOwner = await prodPrisma.user.findUnique({
      where: { email: localBiz.owner.email },
    });

    if (!prodOwner) {
      console.log(`   ➕ Creando dueño en producción: ${localBiz.owner.email}`);
      prodOwner = await prodPrisma.user.create({
        data: {
          name: localBiz.owner.name,
          email: localBiz.owner.email,
          password: localBiz.owner.password,
          role: localBiz.owner.role,
          phone: localBiz.owner.phone,
          emailVerified: localBiz.owner.emailVerified,
          emailNotifications: localBiz.owner.emailNotifications,
          whatsappNotifications: localBiz.owner.whatsappNotifications,
        },
      });
    } else {
      console.log(`   ✔ Dueño encontrado en producción: ${prodOwner.email} (ID: ${prodOwner.id})`);
    }

    // Resolver categoría en producción
    let prodCategory = null;
    if (localBiz.categoryRel) {
      prodCategory = prodCategories.find(
        (c) =>
          c.slug === localBiz.categoryRel?.slug ||
          normalizeText(c.name) === normalizeText(localBiz.categoryRel?.name)
      );
    } else if (localBiz.category) {
      const normCat = normalizeText(localBiz.category);
      prodCategory = prodCategories.find(
        (c) => c.slug === normCat || normalizeText(c.name) === normCat
      );
    }

    const categoryId = prodCategory ? prodCategory.id : null;
    const categoryName = prodCategory ? prodCategory.name : localBiz.category;

    // Buscar si ya existe el negocio en producción por nombre
    let prodBiz = await prodPrisma.business.findFirst({
      where: { name: localBiz.name },
    });

    const bizData = {
      name: localBiz.name,
      description: localBiz.description,
      address: localBiz.address,
      phone: localBiz.phone,
      category: categoryName,
      categoryId: categoryId,
      logoUrl: localBiz.logoUrl,
      ownerId: prodOwner.id,
      latitude: localBiz.latitude ? Number(localBiz.latitude) : null,
      longitude: localBiz.longitude ? Number(localBiz.longitude) : null,
      timezone: localBiz.timezone,
      webhookUrl: localBiz.webhookUrl,
    };

    if (prodBiz) {
      console.log(`   🔄 Actualizando datos de negocio existente en prod (ID: ${prodBiz.id})...`);
      prodBiz = await prodPrisma.business.update({
        where: { id: prodBiz.id },
        data: bizData,
      });
    } else {
      console.log(`   ✨ Creando nuevo negocio en producción...`);
      prodBiz = await prodPrisma.business.create({
        data: bizData,
      });
      console.log(`   ✔ Creado con ID: ${prodBiz.id}`);
    }

    // Sincronizar servicios
    console.log(`   💼 Sincronizando ${localBiz.services.length} servicios...`);
    for (const svc of localBiz.services) {
      const existingService = await prodPrisma.service.findFirst({
        where: {
          businessId: prodBiz.id,
          name: svc.name,
        },
      });

      const svcData = {
        name: svc.name,
        description: svc.description,
        durationMinutes: svc.durationMinutes,
        price: svc.price,
        status: 'approved' as const, // Aprobado para que esté disponible para reservar
        bufferTime: svc.bufferTime,
        minCancellationNoticeHours: svc.minCancellationNoticeHours,
        allowReschedule: svc.allowReschedule,
      };

      if (existingService) {
        await prodPrisma.service.update({
          where: { id: existingService.id },
          data: svcData,
        });
        console.log(`      ✔ Servicio actualizado: "${svc.name}" ($${svc.price})`);
      } else {
        await prodPrisma.service.create({
          data: {
            businessId: prodBiz.id,
            ...svcData,
          },
        });
        console.log(`      ✨ Servicio creado: "${svc.name}" ($${svc.price})`);
      }
    }

    // Sincronizar horarios de atención (schedules)
    console.log(`   ⏰ Sincronizando ${localBiz.schedules.length} horarios de atención...`);
    const existingSchedules = await prodPrisma.schedule.findMany({
      where: { businessId: prodBiz.id },
    });

    for (const sch of localBiz.schedules) {
      const schStartTime = new Date(sch.startTime);
      const schEndTime = new Date(sch.endTime);

      const alreadyExists = existingSchedules.some((es) => {
        const esStartTime = new Date(es.startTime);
        const esEndTime = new Date(es.endTime);
        return (
          es.dayOfWeek === sch.dayOfWeek &&
          esStartTime.getUTCHours() === schStartTime.getUTCHours() &&
          esStartTime.getUTCMinutes() === schStartTime.getUTCMinutes() &&
          esEndTime.getUTCHours() === schEndTime.getUTCHours() &&
          esEndTime.getUTCMinutes() === schEndTime.getUTCMinutes()
        );
      });

      if (!alreadyExists) {
        await prodPrisma.schedule.create({
          data: {
            businessId: prodBiz.id,
            dayOfWeek: sch.dayOfWeek,
            startTime: schStartTime,
            endTime: schEndTime,
          },
        });
        console.log(`      ✨ Horario agregado: Día ${sch.dayOfWeek} (${schStartTime.toISOString().substring(11, 16)} a ${schEndTime.toISOString().substring(11, 16)})`);
      } else {
        console.log(`      ✔ Horario ya existente: Día ${sch.dayOfWeek} (${schStartTime.toISOString().substring(11, 16)} a ${schEndTime.toISOString().substring(11, 16)})`);
      }
    }
  }

  console.log(`\n🎉 ¡Sincronización completada exitosamente!`);
}

sync()
  .catch((err) => {
    console.error('❌ Error durante la sincronización:', err);
    process.exit(1);
  })
  .finally(async () => {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  });
