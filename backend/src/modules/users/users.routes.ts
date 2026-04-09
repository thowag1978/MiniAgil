import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate } from '../../middlewares/authMiddleware';

export const userRoutes = Router();
const usersController = new UsersController();

userRoutes.use(authenticate);

userRoutes.get('/', usersController.list);
userRoutes.post('/', usersController.create);
userRoutes.patch('/:id/role', usersController.updateRole);
userRoutes.patch('/:id/password', usersController.updatePassword);
userRoutes.delete('/:id', usersController.delete);
