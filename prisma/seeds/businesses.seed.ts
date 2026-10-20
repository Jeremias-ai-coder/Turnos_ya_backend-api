import { PrismaClient } from '@prisma/client';

const normalizeText = (text: string = '') =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export async function seedBusinesses(prisma: PrismaClient) {
  console.log('🏢 [3/3] Sincronizando comercios y relaciones de categorías...');

  const allCategories = await prisma.category.findMany();
  const allBusinesses = await prisma.business.findMany();

  let linkedCount = 0;
  for (const biz of allBusinesses) {
    if (biz.category) {
      const normBizCat = normalizeText(biz.category);
      const matched = allCategories.find(c =>
        c.slug === normBizCat ||
        normalizeText(c.name) === normBizCat
      );

      const coordsMap: Record<number, { lat: number; lon: number }> = {
        10: { lat: -34.6150, lon: -58.3750 },
        11: { lat: -34.6041, lon: -58.3871 },
        12: { lat: -34.5878, lon: -58.4116 },
        13: { lat: -34.5898, lon: -58.4312 },
        14: { lat: -34.6198, lon: -58.4412 },
        15: { lat: -34.5458, lon: -58.4592 },
        16: { lat: -34.5885, lon: -58.4285 },
      };

      const coords = coordsMap[biz.id];
      if ((matched && biz.categoryId !== matched.id) || (coords && (!biz.latitude || !biz.longitude))) {
        await prisma.business.update({
          where: { id: biz.id },
          data: {
            ...(matched ? { categoryId: matched.id, category: matched.name } : {}),
            ...(coords ? { latitude: coords.lat, longitude: coords.lon } : {}),
          }
        });
        linkedCount++;
        console.log(`   ✔ "${biz.name}" actualizado con categoría y coordenadas GPS`);
      }
    }
  }

  if (linkedCount === 0) {
    console.log(`   ℹ Los ${allBusinesses.length} comercios ya están vinculados a sus categorías.`);
  }
}
