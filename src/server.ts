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

import fs from 'fs';

const app = express();

// Request logger for debugging mobile connectivity
app.use((req, res, next) => {
  const logLine = `[${new Date().toISOString()}] ${req.method} ${req.url} (ip: ${req.ip})\n`;
  console.log(logLine.trim());
  try {
    fs.appendFileSync('requests.log', logLine);
  } catch {}
  next();
});

app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
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

// Global error handler (RFC 7807)
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on 0.0.0.0:${PORT}`);
  // Iniciar tarea periódica de recordatorios de turnos (cada 60 segundos)
  reminderJob.start(60000);
});

