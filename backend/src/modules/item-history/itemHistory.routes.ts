import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { ItemHistoryController } from './itemHistory.controller';

export const itemHistoryRoutes = Router({ mergeParams: true });
const itemHistoryController = new ItemHistoryController();

itemHistoryRoutes.use(authenticate);
itemHistoryRoutes.get('/', itemHistoryController.list);
