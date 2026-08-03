import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { BugRetestsController } from './bugRetests.controller';

export const itemBugRetestRoutes = Router({ mergeParams: true });
const controller = new BugRetestsController();
itemBugRetestRoutes.use(authenticate);
itemBugRetestRoutes.get('/', controller.list);
itemBugRetestRoutes.post('/', controller.create);
