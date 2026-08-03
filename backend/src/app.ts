import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { projectRoutes } from './modules/projects/projects.routes';
import { sprintRoutes } from './modules/sprints/sprints.routes';
import { itemRoutes } from './modules/items/items.routes';
import { userRoutes } from './modules/users/users.routes';
import { teamRoutes } from './modules/teams/teams.routes';
import { commentRoutes, itemCommentRoutes } from './modules/comments/comments.routes';
import { itemHistoryRoutes } from './modules/item-history/itemHistory.routes';
import { attachmentRoutes, itemAttachmentRoutes } from './modules/attachments/attachments.routes';
import { itemWatcherRoutes } from './modules/watchers/watchers.routes';
import { notificationRoutes } from './modules/notifications/notifications.routes';
import { savedViewRoutes } from './modules/saved-views/savedViews.routes';
import { itemBugRetestRoutes } from './modules/bug-retests/bugRetests.routes';
import { reportRoutes } from './modules/reports/reports.routes';
import { codeLinkRoutes, itemCodeLinkRoutes } from './modules/code-links/codeLinks.routes';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/sprints', sprintRoutes);
  app.use('/api/items/:itemId/comments', itemCommentRoutes);
  app.use('/api/items/:itemId/history', itemHistoryRoutes);
  app.use('/api/items/:itemId/attachments', itemAttachmentRoutes);
  app.use('/api/items/:itemId/watchers', itemWatcherRoutes);
  app.use('/api/items/:itemId/retests', itemBugRetestRoutes);
  app.use('/api/items/:itemId/code-links', itemCodeLinkRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/attachments', attachmentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/saved-views', savedViewRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/code-links', codeLinkRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use(errorHandler);
  return app;
}
