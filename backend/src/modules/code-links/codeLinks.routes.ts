import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { CodeLinksController } from './codeLinks.controller';
const controller=new CodeLinksController();
export const repositoryRoutes=Router({mergeParams:true});repositoryRoutes.get('/',controller.repositories);repositoryRoutes.post('/',controller.createRepository);
export const itemCodeLinkRoutes=Router({mergeParams:true});itemCodeLinkRoutes.use(authenticate);itemCodeLinkRoutes.get('/',controller.list);itemCodeLinkRoutes.post('/',controller.create);
export const codeLinkRoutes=Router();codeLinkRoutes.use(authenticate);codeLinkRoutes.delete('/:linkId',controller.delete);
