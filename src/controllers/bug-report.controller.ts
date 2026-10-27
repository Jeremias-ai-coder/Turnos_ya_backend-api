import { Request, Response } from 'express';
import { BugReportService } from '../services/bug-report.service';

export class BugReportController {
  constructor(private bugReportService: BugReportService) {}

  createBugReport = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { section, summary, steps, deviceInfo, pageUrl } = req.body;

    const report = await this.bugReportService.createReport({
      userId,
      section,
      summary,
      steps,
      deviceInfo,
      pageUrl,
    });

    res.status(201).json({
      success: true,
      message: 'Tu reporte fue recibido correctamente. El equipo técnico lo revisará a la brevedad.',
      data: report,
    });
  };

  getAdminBugReports = async (req: Request, res: Response) => {
    const { page, limit, status } = req.query;

    const result = await this.bugReportService.getAllReports({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: status as string | undefined,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  };

  updateBugReportStatus = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { status, adminNotes } = req.body;

    const updated = await this.bugReportService.updateReportStatus(id, status, adminNotes);

    res.status(200).json({
      success: true,
      message: 'Estado del reporte actualizado correctamente',
      data: updated,
    });
  };
}
