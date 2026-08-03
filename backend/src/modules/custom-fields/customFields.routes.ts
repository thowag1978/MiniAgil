import { Router } from 'express';
import { CustomFieldsController } from './customFields.controller';
export const customFieldRoutes = Router({ mergeParams: true });
const controller = new CustomFieldsController();
customFieldRoutes.get('/', controller.list);
customFieldRoutes.post('/', controller.create);
customFieldRoutes.patch('/:fieldId', controller.update);
customFieldRoutes.post('/:fieldId/options', controller.createOption);
customFieldRoutes.patch('/:fieldId/options/:optionId', controller.updateOption);
