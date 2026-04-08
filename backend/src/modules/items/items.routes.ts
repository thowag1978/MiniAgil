import { Router } from 'express';
import { ItemsController } from './items.controller';
import { authenticate } from '../../middlewares/authMiddleware';

export const itemRoutes = Router();
const itemsController = new ItemsController();

itemRoutes.use(authenticate);

itemRoutes.post('/', itemsController.create);
itemRoutes.get('/', itemsController.list);
itemRoutes.patch('/:id', itemsController.updateField);
