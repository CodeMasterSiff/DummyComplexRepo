import express from 'express';
import cors from 'cors';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errors';
import authRoutes from './routes/auth';
import patientRoutes from './routes/patients';
import catalogRoutes from './routes/catalog';
import appointmentRoutes from './routes/appointments';
import waitlistRoutes from './routes/waitlist';
import staffRoutes from './routes/staff';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(authenticate);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/waitlist', waitlistRoutes);
  app.use('/api/staff', staffRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
