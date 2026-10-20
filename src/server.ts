import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import businessRoutes from './routes/business.routes';
import appointmentRoutes from './routes/appointment.routes';
import adminRoutes from './routes/admin.routes';
import healthRoutes from './routes/health.routes';
import notificationRoutes from './routes/notification.routes';
import categoryRoutes from './routes/category.routes';
import { reminderJob } from './container';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import { startKeepAlive } from './utils/keepAlive';

const app = express();

app.use(requestLogger);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes v1
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', authRoutes);
app.use('/api/v1/businesses', businessRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);

// Direct route aliases (para compatibilidad si el cliente omite /api/v1)
app.use('/auth', authRoutes);
app.use('/users', authRoutes);
app.use('/businesses', businessRoutes);
app.use('/categories', categoryRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);

// Global error handler (RFC 7807)
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'super_secret' || process.env.JWT_SECRET === 'cambiar_por_clave_secreta_jwt')) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ ADVERTENCIA DE SEGURIDAD: JWT_SECRET no está configurado o utiliza un valor por defecto inseguro en producción.');
  }
  console.log(`Server is running on 0.0.0.0:${PORT}`);
  // Iniciar tarea periódica de recordatorios de turnos (cada 60 segundos)
  reminderJob.start(60000);
  // Iniciar auto-ping Keep-Alive para Render / QA
  startKeepAlive(10);
});

