import { PrismaClient } from '@prisma/client';
import { CacheService, cacheService } from './cache.service';
import { AppError } from '../middlewares/errorHandler';

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

  async getAllCategoriesForAdmin() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { businesses: true }
        }
      }
    });
  }

  async createCategory(data: { name: string; slug?: string; description?: string; icon?: string; isActive?: boolean }) {
    const cleanName = data.name.trim();
    if (cleanName.length < 2) {
      throw new AppError('El nombre de la categoría debe tener al menos 2 caracteres', 400);
    }

    const slug = (data.slug?.trim() || cleanName)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: cleanName },
          { slug }
        ]
      }
    });

    if (existing) {
      throw new AppError('Ya existe una categoría con ese nombre o slug', 400);
    }

    const created = await this.prisma.category.create({
      data: {
        name: cleanName,
        slug,
        description: data.description?.trim() || null,
        icon: data.icon?.trim() || 'Tag',
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    await this.cache.del('categories:all');
    return created;
  }

  async updateCategory(id: number, data: { name?: string; slug?: string; description?: string; icon?: string; isActive?: boolean }) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Categoría no encontrada', 404);
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.slug !== undefined) {
      updateData.slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : null;
    }
    if (data.icon !== undefined) {
      updateData.icon = data.icon ? data.icon.trim() : 'Tag';
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateData
    });

    await Promise.all([
      this.cache.del('categories:all'),
      this.cache.del(`category:slug:${existing.slug}`),
      updateData.slug ? this.cache.del(`category:slug:${updateData.slug}`) : Promise.resolve()
    ]);

    return updated;
  }

  async toggleCategoryStatus(id: number) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Categoría no encontrada', 404);
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: { isActive: !existing.isActive }
    });

    await Promise.all([
      this.cache.del('categories:all'),
      this.cache.del(`category:slug:${existing.slug}`)
    ]);

    return updated;
  }

  async deleteCategory(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { businesses: true }
        }
      }
    });

    if (!category) {
      throw new AppError('Categoría no encontrada', 404);
    }

    if (category._count.businesses > 0) {
      throw new AppError(`No es posible eliminar la categoría "${category.name}" porque tiene ${category._count.businesses} comercio(s) adherido(s). Podés desactivarla para ocultarla del catálogo.`, 400);
    }

    const deleted = await this.prisma.category.delete({ where: { id } });
    await Promise.all([
      this.cache.del('categories:all'),
      this.cache.del(`category:slug:${category.slug}`)
    ]);

    return deleted;
  }
}
