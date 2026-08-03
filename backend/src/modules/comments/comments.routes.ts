import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { CommentsController } from './comments.controller';

const commentsController = new CommentsController();

export const itemCommentRoutes = Router({ mergeParams: true });
itemCommentRoutes.use(authenticate);
itemCommentRoutes.get('/', commentsController.list);
itemCommentRoutes.post('/', commentsController.create);

export const commentRoutes = Router();
commentRoutes.use(authenticate);
commentRoutes.patch('/:commentId', commentsController.update);
commentRoutes.delete('/:commentId', commentsController.delete);
