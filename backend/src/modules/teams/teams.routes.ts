import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { TeamsController } from './teams.controller';

export const teamRoutes = Router();
const teamsController = new TeamsController();

teamRoutes.use(authenticate);
teamRoutes.get('/', teamsController.list);
teamRoutes.post('/', teamsController.create);
teamRoutes.patch('/:id', teamsController.update);
teamRoutes.delete('/:id', teamsController.delete);
