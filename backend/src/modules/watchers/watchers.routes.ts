import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { WatchersController } from './watchers.controller';

const controller = new WatchersController();
export const itemWatcherRoutes = Router({ mergeParams: true });

itemWatcherRoutes.use(authenticate);
itemWatcherRoutes.get('/', controller.list);
itemWatcherRoutes.post('/me', controller.follow);
itemWatcherRoutes.delete('/me', controller.unfollow);
