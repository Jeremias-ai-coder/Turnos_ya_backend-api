import { PrismaClient } from '@prisma/client';
import { CacheService, cacheService } from './cache.service';

export class CategoryService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheService = cacheService
  ) {}

  async getAllCategories() {
    return this.cache.getOrSet(
      'categories:all',
      async () => {
        return this.prisma.category.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
            isActive: true,
            _count: {
              select: { businesses: true }
            }
          }
        });
      },
      1800 // 30 minutos TTL
    );
  }

  async getCategoryBySlug(slug: string) {
    return this.cache.getOrSet(
      `category:slug:${slug}`,
      async () => {
        return this.prisma.category.findUnique({
          where: { slug },
          include: {
            businesses: {
              select: {
                id: true,
                name: true,
                address: true,
                phone: true,
                logoUrl: true
              }
            }
          }
        });
      },
      1800 // 30 minutos TTL
    );
  }
}
