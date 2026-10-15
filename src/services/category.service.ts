import { PrismaClient } from '@prisma/client';

export class CategoryService {
  constructor(private prisma: PrismaClient) {}

  async getAllCategories() {
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
  }

  async getCategoryBySlug(slug: string) {
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
  }
}
