import { Router } from 'express';
import { WorkflowsController } from './workflows.controller';

export const workflowRoutes = Router({ mergeParams: true });
const controller = new WorkflowsController();

workflowRoutes.get('/', controller.list);
workflowRoutes.get('/type/:itemType', controller.getByType);
workflowRoutes.post('/', controller.create);
workflowRoutes.patch('/:workflowId', controller.update);
workflowRoutes.post('/:workflowId/statuses', controller.createStatus);
workflowRoutes.patch('/:workflowId/statuses/reorder', controller.reorderStatuses);
workflowRoutes.patch('/:workflowId/statuses/:statusId', controller.updateStatus);
workflowRoutes.delete('/:workflowId/statuses/:statusId', controller.deleteStatus);
workflowRoutes.get('/:workflowId/transitions', controller.listTransitions);
workflowRoutes.post('/:workflowId/transitions', controller.createTransition);
workflowRoutes.patch('/:workflowId/transitions/:transitionId', controller.updateTransition);
