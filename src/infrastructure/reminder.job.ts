import { NotificationService } from '../services/notification.service';

export class ReminderJob {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(private notificationService: NotificationService) {}

  start(intervalMs: number = 60000) {
    if (this.timer) return;

    // Ejecutar chequeo inicial
    this.executeCheck();

    this.timer = setInterval(() => {
      this.executeCheck();
    }, intervalMs);

    console.log(`[ReminderJob] Tarea en segundo plano iniciada (intervalo: ${intervalMs / 1000}s)`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async executeCheck() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.notificationService.checkAndSendHourlyReminders();
    } catch (err) {
      console.error('[ReminderJob] Error al procesar recordatorios:', err);
    } finally {
      this.isRunning = false;
    }
  }
}
