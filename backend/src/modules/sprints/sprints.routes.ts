import { Router } from 'express';
import { SprintsController } from './sprints.controller';
import { authenticate } from '../../middlewares/authMiddleware';

export const sprintRoutes = Router();
const sprintsController = new SprintsController();

sprintRoutes.use(authenticate);

sprintRoutes.post('/', sprintsController.create);
sprintRoutes.get('/', sprintsController.list);
sprintRoutes.patch('/:id/status', sprintsController.updateStatus);
