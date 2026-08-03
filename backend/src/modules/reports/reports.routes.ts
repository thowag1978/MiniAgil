import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { ReportsController } from './reports.controller';
export const reportRoutes = Router();
const controller = new ReportsController();
reportRoutes.use(authenticate);
reportRoutes.get('/operational', controller.operational);
reportRoutes.get('/export/:type', controller.exportCsv);
