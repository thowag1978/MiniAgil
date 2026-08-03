import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { SavedViewsController } from './savedViews.controller';

const controller = new SavedViewsController();

export const projectSavedViewRoutes = Router({ mergeParams: true });
projectSavedViewRoutes.get('/', controller.list);
projectSavedViewRoutes.post('/', controller.create);

export const savedViewRoutes = Router();
savedViewRoutes.use(authenticate);
savedViewRoutes.patch('/:id', controller.update);
savedViewRoutes.delete('/:id', controller.delete);
