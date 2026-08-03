import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { canUpdateItem, canViewProject, isProjectOwnerOrAdmin } from '../../services/permissions';
import { CodeLinkError, createItemCodeLink, createRepository, deleteItemCodeLink, listItemCodeLinks, listRepositories } from '../../services/codeLinks';
function handle(error: unknown, res: Response) { if (error instanceof CodeLinkError) return res.status(error.statusCode).json({ error: error.message }); if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'Repository already registered in this project' }); throw error; }
export class CodeLinksController {
  repositories = async (req:any,res:Response)=>{if(!(await canViewProject(req.user.id,req.params.projectId)))return res.status(404).json({error:'Project not found'});res.json(await listRepositories(req.params.projectId));};
  createRepository = async(req:any,res:Response)=>{if(!(await isProjectOwnerOrAdmin(req.user.id,req.params.projectId)))return res.status(403).json({error:'Only project OWNER or ADMIN can register repositories'});try{res.status(201).json(await createRepository(req.params.projectId,req.body));}catch(error){return handle(error,res);}};
  list = async(req:any,res:Response)=>{const item=await prisma.item.findUnique({where:{id:req.params.itemId},select:{id:true,project_id:true}});if(!item||!(await canViewProject(req.user.id,item.project_id)))return res.status(404).json({error:'Item not found or access denied'});res.json(await listItemCodeLinks(item.id));};
  create = async(req:any,res:Response)=>{const item=await prisma.item.findUnique({where:{id:req.params.itemId},select:{id:true,project_id:true}});if(!item||!(await canUpdateItem(req.user.id,item.project_id)))return res.status(404).json({error:'Item not found or access denied'});try{res.status(201).json(await createItemCodeLink({itemId:item.id,projectId:item.project_id,userId:req.user.id,repositoryId:String(req.body.repository_id||''),body:req.body}));}catch(error){return handle(error,res);}};
  delete = async(req:any,res:Response)=>{const link=await prisma.itemCodeLink.findFirst({where:{id:req.params.linkId},select:{item:{select:{project_id:true}}}});if(!link||!(await canUpdateItem(req.user.id,link.item.project_id)))return res.status(404).json({error:'Code link not found or access denied'});try{await deleteItemCodeLink(req.params.linkId,link.item.project_id);res.status(204).send();}catch(error){return handle(error,res);}};
}
