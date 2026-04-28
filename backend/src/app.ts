import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { projectRoutes } from './modules/projects/projects.routes';
import { sprintRoutes } from './modules/sprints/sprints.routes';
import { itemRoutes } from './modules/items/items.routes';
import { userRoutes } from './modules/users/users.routes';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/sprints', sprintRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/users', userRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use(errorHandler);
  return app;
}
