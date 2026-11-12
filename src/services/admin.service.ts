import { IUserRepository } from '../interfaces/user.interface';
import { IBusinessRepository } from '../interfaces/business.interface';
import { IAppointmentRepository } from '../interfaces/appointment.interface';
import { AppError } from '../middlewares/errorHandler';
import { Role, PrismaClient } from '@prisma/client';
import { CacheService, cacheService } from './cache.service';

export const ROOT_ADMIN_EMAIL = 'turnosyapp@gmail.com';

export function isRootAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === ROOT_ADMIN_EMAIL.toLowerCase();
}

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

  async updateUserRole(id: number, role: string, executorId?: number) {
    const targetUser = await this.userRepo.findById(id);
    if (!targetUser) {
      throw new AppError('Usuario no encontrado', 404);
    }

    // 1. Inmunidad de la Cuenta Raíz: su rol no puede ser alterado bajo ninguna circunstancia
    if (isRootAdminEmail(targetUser.email)) {
      throw new AppError('El rol de la Cuenta Raíz del sistema es inmutable y está protegido contra cambios de privilegios.', 403);
    }

    // 2. Solo la Cuenta Raíz puede promover o democionar administradores
    let isExecutorRoot = false;
    if (executorId) {
      const executor = await this.userRepo.findById(executorId);
      isExecutorRoot = isRootAdminEmail(executor?.email);
    }

    if (role === 'administrator') {
      if (!isExecutorRoot) {
        throw new AppError('Solo el Administrador Principal (Cuenta Raíz) puede asignar el rol de Administrador.', 403);
      }
    } else if (!['client', 'owner'].includes(role)) {
      throw new AppError('Rol inválido. Sólo se puede alternar entre Cliente y Dueño', 400);
    }

    if (targetUser.role === 'administrator' && !isExecutorRoot) {
      throw new AppError('Solo el Administrador Principal (Cuenta Raíz) puede modificar el rol de un Administrador.', 403);
    }

    const user = await this.userRepo.update(id, { role: role as Role });

    // Invalidar estadísticas de roles cacheadas
    await this.cache.del('admin:stats');

    return { id: user.id, name: user.name, role: user.role };
  }

  async deleteUser(id: number, executorId?: number) {
    const targetUser = await this.userRepo.findById(id);
    if (!targetUser) {
      throw new AppError('Usuario no encontrado', 404);
    }

    // 1. Inmunidad Absoluta de la Cuenta Raíz / SuperAdmin
    if (isRootAdminEmail(targetUser.email)) {
      throw new AppError('La Cuenta Raíz del sistema es inmutable y está estrictamente protegida contra eliminación.', 403);
    }

    // 2. Nadie puede auto-eliminarse
    if (executorId && executorId === id) {
      throw new AppError('No puedes eliminar tu propia cuenta de administrador.', 400);
    }

    // 3. Jerarquía de Privilegios: Si el usuario a eliminar es un Administrador,
    // únicamente la Cuenta Raíz (SuperAdmin) tiene autorización para eliminarlo.
    if (targetUser.role === 'administrator') {
      let isExecutorRoot = false;
      if (executorId) {
        const executor = await this.userRepo.findById(executorId);
        isExecutorRoot = isRootAdminEmail(executor?.email);
      }
      if (!isExecutorRoot) {
        throw new AppError('Solo el Administrador Principal (Cuenta Raíz) tiene autorización para eliminar a otros administradores.', 403);
      }
    }

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
        let pendingBusinesses = 0;
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

            const [todayCount, bugCount, pendingBizCount, statusGroups, appointments, users] = await Promise.all([
              this.prisma.appointment.count({
                where: { date: todayStr },
              }),
              this.prisma.bugReport.count({
                where: { status: 'PENDING' },
              }),
              this.prisma.business.count({
                where: { status: 'pending_approval' },
              }),
              this.prisma.appointment.groupBy({
                by: ['status'],
                _count: { status: true },
              }),
              this.prisma.appointment.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                  business: { select: { id: true, name: true } },
                  user: { select: { id: true, name: true, email: true } },
                },
              }),
              this.prisma.user.findMany({
                take: 5,
                orderBy: { id: 'desc' },
                select: { id: true, name: true, email: true, role: true },
              }),
            ]);

            todayAppointments = todayCount;
            pendingBugReports = bugCount;
            pendingBusinesses = pendingBizCount;
            statusGroups.forEach((sg: any) => {
              if (appointmentsByStatus[sg.status] !== undefined) {
                appointmentsByStatus[sg.status] = sg._count.status;
              }
            });
            recentAppointments = appointments;
            recentUsers = users;
          } catch {
            // Si el cliente prisma no está listo, se mantienen los valores por defecto
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
          pendingBusinesses,
          appointmentsByStatus,
          recentAppointments,
          recentUsers,
        };
      },
      30
    );
  }

  async getAllAppointments() {
    return this.appointmentRepo.findAll();
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  async clearCache() {
    await this.cache.clear();
    return { message: 'Caché invalidada completamente' };
  }
}
