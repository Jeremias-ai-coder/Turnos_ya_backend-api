import { IUserRepository } from '../interfaces/user.interface';
import { IBusinessRepository } from '../interfaces/business.interface';
import { IAppointmentRepository } from '../interfaces/appointment.interface';
import { AppError } from '../middlewares/errorHandler';
import { Role, PrismaClient } from '@prisma/client';
import { CacheService, cacheService } from './cache.service';

export class AdminService {
  constructor(
    private userRepo: IUserRepository,
    private businessRepo: IBusinessRepository,
    private appointmentRepo: IAppointmentRepository,
    private prisma?: PrismaClient,
    private cache: CacheService = cacheService
  ) {}

  async getAllUsers() {
    const users = await this.userRepo.findAll();
    return { data: users, meta: { total: users.length } };
  }

  async updateUserRole(id: number, role: string) {
    if (role === 'administrator') {
      throw new AppError('Por motivos de seguridad, el rol de Administrador no puede ser asignado desde el panel', 403);
    }
    if (!['client', 'owner'].includes(role)) {
      throw new AppError('Rol inválido. Sólo se puede alternar entre Cliente y Dueño', 400);
    }
    const targetUser = await this.userRepo.findById(id);
    if (targetUser?.role === 'administrator') {
      throw new AppError('El rol de un Administrador del Sistema está protegido y no puede ser modificado', 403);
    }
    const user = await this.userRepo.update(id, { role: role as Role });

    // Invalidar estadísticas de roles cacheadas
    await this.cache.del('admin:stats');

    return { id: user.id, name: user.name, role: user.role };
  }

  async deleteUser(id: number) {
    await this.userRepo.delete(id);
    await this.cache.del('admin:stats');
    return { message: 'Usuario eliminado correctamente' };
  }

  async getStats() {
    return this.cache.getOrSet(
      'admin:stats',
      async () => {
        const [totalUsers, totalBusinesses, totalAppointments, totalAdmins, totalOwners, totalClients] = await Promise.all([
          this.userRepo.count(),
          this.businessRepo.count(),
          this.appointmentRepo.count(),
          this.userRepo.count('administrator'),
          this.userRepo.count('owner'),
          this.userRepo.count('client'),
        ]);

        let todayAppointments = 0;
        let pendingBugReports = 0;
        const appointmentsByStatus: Record<string, number> = {
          CONFIRMED: 0,
          PENDING: 0,
          COMPLETED: 0,
          CANCELLED: 0,
        };
        let recentAppointments: any[] = [];
        let recentUsers: any[] = [];

        if (this.prisma) {
          try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
            const endOfToday = new Date(`${todayStr}T23:59:59.999Z`);

            const [todayCount, pendingReportsCount, aptStatuses, recentApts, rUsers] = await Promise.all([
              this.prisma.appointment.count({
                where: {
                  date: { gte: startOfToday, lte: endOfToday }
                }
              }),
              this.prisma.bugReport.count({
                where: { status: 'PENDING' }
              }),
              this.prisma.appointment.groupBy({
                by: ['status'],
                _count: { status: true }
              }),
              this.prisma.appointment.findMany({
                take: 5,
                orderBy: [{ date: 'desc' }, { time: 'desc' }],
                include: {
                  user: { select: { id: true, name: true, email: true } },
                  business: { select: { id: true, name: true } },
                  service: { select: { id: true, name: true, price: true } }
                }
              }),
              this.prisma.user.findMany({
                take: 5,
                where: { deletedAt: null },
                orderBy: { id: 'desc' },
                select: { id: true, name: true, email: true, role: true }
              })
            ]);

            todayAppointments = todayCount;
            pendingBugReports = pendingReportsCount;
            recentAppointments = recentApts;
            recentUsers = rUsers;

            aptStatuses.forEach((item: any) => {
              if (item.status in appointmentsByStatus) {
                appointmentsByStatus[item.status] = item._count.status;
              }
            });
          } catch (err) {
            console.warn('[ADMIN] Error al calcular estadísticas avanzadas:', err);
          }
        }

        return {
          totalUsers,
          totalBusinesses,
          totalAppointments,
          totalAdmins,
          totalOwners,
          totalClients,
          todayAppointments,
          pendingBugReports,
          appointmentsByStatus,
          recentAppointments,
          recentUsers
        };
      },
      60 // 60 segundos TTL
    );
  }

  async getAllAppointments() {
    const appointments = await this.appointmentRepo.findAll(100);
    return { data: appointments, meta: { total: appointments.length } };
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  async clearCache() {
    await this.cache.clear();
    return { message: 'Caché global purgada exitosamente' };
  }
}
