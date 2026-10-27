import { BugReportStatus } from '@prisma/client';
import { PrismaBugReportRepository, CreateBugReportDTO } from '../repositories/prisma-bug-report.repository';
import { AppError } from '../middlewares/errorHandler';

export class BugReportService {
  constructor(private bugReportRepository: PrismaBugReportRepository) {}

  async createReport(data: CreateBugReportDTO) {
    if (!data.section || !data.section.trim()) {
      throw new AppError('El campo "¿Dónde te has encontrado el error?" es obligatorio', 400);
    }
    if (!data.summary || !data.summary.trim()) {
      throw new AppError('El resumen del error es obligatorio', 400);
    }
    if (!data.steps || !data.steps.trim()) {
      throw new AppError('Los pasos para reproducir el error son obligatorios', 400);
    }

    return this.bugReportRepository.create({
      userId: data.userId,
      section: data.section.trim(),
      summary: data.summary.trim(),
      steps: data.steps.trim(),
      deviceInfo: data.deviceInfo?.trim() || undefined,
      pageUrl: data.pageUrl?.trim() || undefined,
    });
  }

  async getAllReports(options: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    let validStatus: BugReportStatus | undefined;
    if (options.status && ['PENDING', 'IN_REVIEW', 'RESOLVED', 'DISCARDED'].includes(options.status)) {
      validStatus = options.status as BugReportStatus;
    }

    const [{ reports, total }, counts] = await Promise.all([
      this.bugReportRepository.findAll({ status: validStatus, skip, take: limit }),
      this.bugReportRepository.countByStatus(),
    ]);

    return {
      data: reports,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts,
    };
  }

  async updateReportStatus(id: number, status: string, adminNotes?: string) {
    const validStatuses: BugReportStatus[] = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'DISCARDED'];
    if (!validStatuses.includes(status as BugReportStatus)) {
      throw new AppError(`Estado inválido. Opciones permitidas: ${validStatuses.join(', ')}`, 400);
    }

    const existing = await this.bugReportRepository.findById(id);
    if (!existing) {
      throw new AppError('Reporte de error no encontrado', 404);
    }

    return this.bugReportRepository.updateStatus(id, status as BugReportStatus, adminNotes);
  }
}
