import { PrismaClient, Business } from '@prisma/client';
import { IBusinessRepository, CreateBusinessDTO, UpdateBusinessDTO } from '../interfaces/business.interface';

export class PrismaBusinessRepository implements IBusinessRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(skip: number, take: number, search?: string): Promise<[any[], number]> {
    const cleanSearch = search?.trim();
    const whereClause = cleanSearch ? {
      OR: [
        { name: { contains: cleanSearch } },
        { description: { contains: cleanSearch } },
        { address: { contains: cleanSearch } },
        { category: { contains: cleanSearch } },
        { categoryRel: { name: { contains: cleanSearch } } },
        {
          services: {
            some: {
              OR: [
                { name: { contains: cleanSearch } },
                { description: { contains: cleanSearch } }
              ]
            }
          }
        }
      ]
    } : undefined;

    const [businesses, total] = await Promise.all([
      this.prisma.business.findMany({
        skip,
        take,
        where: whereClause,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          categoryRel: { select: { id: true, name: true, slug: true, icon: true } },
          services: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              durationMinutes: true,
              status: true
            }
          },
          appointments: {
            where: { review: { isNot: null } },
            select: {
              review: {
                select: { rating: true }
              }
            }
          }
        }
      }),
      this.prisma.business.count({ where: whereClause })
    ]);

    const formatted = businesses.map(b => {
      const reviews = b.appointments?.map((a: any) => a.review).filter(Boolean) || [];
      const count = reviews.length;
      const avg = count > 0 ? Number((reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / count).toFixed(1)) : null;
      return {
        ...b,
        category: b.categoryRel?.name || b.category || null,
        categoryRel: b.categoryRel || null,
        categoryId: b.categoryId,
        services: b.services || [],
        rating: avg,
        reviewCount: count
      };
    });

    return [formatted, total];
  }

  async findById(id: number): Promise<any | null> {
    const b = await this.prisma.business.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        categoryRel: { select: { id: true, name: true, slug: true, icon: true } },
        services: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            durationMinutes: true,
            status: true
          }
        },
        appointments: {
          where: { review: { isNot: null } },
          select: {
            review: {
              select: { rating: true }
            }
          }
        }
      }
    });

    if (!b) return null;

    const reviews = b.appointments?.map((a: any) => a.review).filter(Boolean) || [];
    const count = reviews.length;
    const avg = count > 0 ? Number((reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / count).toFixed(1)) : null;

    return {
      ...b,
      category: b.categoryRel?.name || b.category || null,
      categoryRel: b.categoryRel || null,
      categoryId: b.categoryId,
      services: b.services || [],
      rating: avg,
      reviewCount: count
    };
  }

  async findByOwnerId(ownerId: number): Promise<Business[]> {
    return this.prisma.business.findMany({
      where: { ownerId },
      include: {
        categoryRel: { select: { id: true, name: true, slug: true, icon: true } }
      }
    });
  }

  async create(ownerId: number, data: CreateBusinessDTO): Promise<Business> {
    let categoryId = data.categoryId;
    let categoryName = data.category;

    if (categoryId && !categoryName) {
      const cat = await this.prisma.category.findUnique({ where: { id: categoryId } });
      if (cat) categoryName = cat.name;
    } else if (categoryName && !categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: {
          OR: [
            { name: categoryName },
            { slug: categoryName.toLowerCase().trim() }
          ]
        }
      });
      if (cat) categoryId = cat.id;
    }

    return this.prisma.business.create({
      data: {
        ...data,
        category: categoryName,
        categoryId: categoryId,
        ownerId
      }
    });
  }

  async update(id: number, data: UpdateBusinessDTO): Promise<Business> {
    let categoryId = data.categoryId;
    let categoryName = data.category;

    if (categoryId !== undefined && categoryName === undefined) {
      if (categoryId) {
        const cat = await this.prisma.category.findUnique({ where: { id: categoryId } });
        if (cat) categoryName = cat.name;
      }
    } else if (categoryName !== undefined && categoryId === undefined) {
      if (categoryName) {
        const cat = await this.prisma.category.findFirst({
          where: {
            OR: [
              { name: categoryName },
              { slug: categoryName.toLowerCase().trim() }
            ]
          }
        });
        if (cat) categoryId = cat.id;
      }
    }

    return this.prisma.business.update({
      where: { id },
      data: {
        ...data,
        ...(categoryName !== undefined ? { category: categoryName } : {}),
        ...(categoryId !== undefined ? { categoryId: categoryId } : {})
      }
    });
  }

  async count(): Promise<number> {
    return this.prisma.business.count();
  }
}
