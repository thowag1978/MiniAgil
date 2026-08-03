import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { AttachmentsController, authorizeAttachmentUpload } from './attachments.controller';
import { attachmentUpload } from './attachments.upload';

const controller = new AttachmentsController();

export const itemAttachmentRoutes = Router({ mergeParams: true });
itemAttachmentRoutes.use(authenticate);
itemAttachmentRoutes.get('/', controller.list);
itemAttachmentRoutes.post('/', authorizeAttachmentUpload, attachmentUpload, controller.create);

export const attachmentRoutes = Router();
attachmentRoutes.use(authenticate);
attachmentRoutes.get('/:attachmentId/download', controller.download);
attachmentRoutes.delete('/:attachmentId', controller.delete);
