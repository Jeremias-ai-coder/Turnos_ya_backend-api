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

      if (matched && biz.categoryId !== matched.id) {
        await prisma.business.update({
          where: { id: biz.id },
          data: {
            categoryId: matched.id,
            category: matched.name
          }
        });
        linkedCount++;
        console.log(`   ✔ "${biz.name}" vinculado a "${matched.name}" (ID ${matched.id})`);
      }
    }
  }

  if (linkedCount === 0) {
    console.log(`   ℹ Los ${allBusinesses.length} comercios ya están vinculados a sus categorías.`);
  }
}
