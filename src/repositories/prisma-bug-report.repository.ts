import { PrismaClient, BugReport, BugReportStatus } from '@prisma/client';

export interface CreateBugReportDTO {
  userId: number;
  section: string;
  summary: string;
  steps: string;
  deviceInfo?: string;
  pageUrl?: string;
}

export class PrismaBugReportRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateBugReportDTO): Promise<BugReport> {
    return this.prisma.bugReport.create({
      data: {
        userId: data.userId,
        section: data.section,
        summary: data.summary,
        steps: data.steps,
        deviceInfo: data.deviceInfo,
        pageUrl: data.pageUrl,
        status: 'PENDING',
      },
    });
  }

  async findAll(options?: {
    status?: BugReportStatus;
    skip?: number;
    take?: number;
  }): Promise<{ reports: any[]; total: number }> {
    const where: any = {};
    if (options?.status) {
      where.status = options.status;
    }

    const [reports, total] = await Promise.all([
      this.prisma.bugReport.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: options?.skip,
        take: options?.take,
      }),
      this.prisma.bugReport.count({ where }),
    ]);

    return { reports, total };
  }

  async findById(id: number): Promise<BugReport | null> {
    return this.prisma.bugReport.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async updateStatus(
    id: number,
    status: BugReportStatus,
    adminNotes?: string
  ): Promise<BugReport> {
    const data: any = { status };
    if (adminNotes !== undefined) {
      data.adminNotes = adminNotes;
    }
    return this.prisma.bugReport.update({
      where: { id },
      data,
    });
  }

  async countByStatus(): Promise<{ pending: number; inReview: number; resolved: number; discarded: number; total: number }> {
    const [pending, inReview, resolved, discarded, total] = await Promise.all([
      this.prisma.bugReport.count({ where: { status: 'PENDING' } }),
      this.prisma.bugReport.count({ where: { status: 'IN_REVIEW' } }),
      this.prisma.bugReport.count({ where: { status: 'RESOLVED' } }),
      this.prisma.bugReport.count({ where: { status: 'DISCARDED' } }),
      this.prisma.bugReport.count(),
    ]);

    return { pending, inReview, resolved, discarded, total };
  }
}
