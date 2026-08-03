import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { NotificationsController } from './notifications.controller';

const controller = new NotificationsController();
export const notificationRoutes = Router();

notificationRoutes.use(authenticate);
notificationRoutes.get('/', controller.list);
notificationRoutes.get('/unread-count', controller.unreadCount);
notificationRoutes.patch('/read-all', controller.markAllRead);
notificationRoutes.patch('/:id/read', controller.markRead);
