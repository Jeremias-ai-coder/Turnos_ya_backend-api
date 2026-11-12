import { PrismaClient, Business, BusinessStatus } from '@prisma/client';
import { IBusinessRepository, CreateBusinessDTO, UpdateBusinessDTO } from '../interfaces/business.interface';

export class PrismaBusinessRepository implements IBusinessRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(skip: number, take: number, search?: string, status: BusinessStatus | 'ALL' = 'approved'): Promise<[any[], number]> {
    const cleanSearch = search?.trim();
    const searchFilter = cleanSearch ? {
      OR: [
        { name: { contains: cleanSearch } },
        { description: { contains: cleanSearch } },
        { address: { contains: cleanSearch } },
        { city: { contains: cleanSearch } },
        { province: { contains: cleanSearch } },
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
    } : {};

    const statusFilter = status === 'ALL' ? {} : { status: status as BusinessStatus };

    const whereClause = {
      ...searchFilter,
      ...statusFilter
    };

    const [businesses, total] = await Promise.all([
      this.prisma.business.findMany({
        skip,
        take,
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
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
          schedules: {
            select: {
              id: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true
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
        owner: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
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
        schedules: {
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true
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
      orderBy: { createdAt: 'desc' },
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
        ownerId,
        status: 'pending_approval'
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

  async delete(id: number): Promise<Business> {
    return this.prisma.business.delete({ where: { id } });
  }

  async count(status: BusinessStatus | 'ALL' = 'approved'): Promise<number> {
    const where = status === 'ALL' ? {} : { status };
    return this.prisma.business.count({ where });
  }
}
