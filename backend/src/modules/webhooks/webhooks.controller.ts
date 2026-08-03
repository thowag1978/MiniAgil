import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { isProjectOwnerOrAdmin } from '../../services/permissions';
import { createWebhook, enqueueTestDelivery, listDeliveries, listWebhooks, retryDelivery, updateWebhook, WebhookError } from '../../services/webhooks';

function handle(error: unknown, res: Response) { if (error instanceof WebhookError) return res.status(error.statusCode).json({ error: error.message }); if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'A webhook with this name already exists' }); throw error; }
export class WebhooksController {
  private async manage(req: any, res: Response) { if (!(await isProjectOwnerOrAdmin(req.user.id, req.params.projectId))) { res.status(403).json({ error: 'Only project OWNER or ADMIN can manage webhooks' }); return false; } return true; }
  list = async (req: any, res: Response) => { if (!(await this.manage(req, res))) return; res.json(await listWebhooks(req.params.projectId)); };
  create = async (req: any, res: Response) => { if (!(await this.manage(req, res))) return; try { res.status(201).json(await createWebhook({ projectId: req.params.projectId, name: req.body.name, url: req.body.url, events: req.body.events, active: req.body.is_active })); } catch (error) { return handle(error, res); } };
  update = async (req: any, res: Response) => { if (!(await this.manage(req, res))) return; try { res.json(await updateWebhook(req.params.projectId, req.params.webhookId, req.body)); } catch (error) { return handle(error, res); } };
  deliveries = async (req: any, res: Response) => { if (!(await this.manage(req, res))) return; res.json(await listDeliveries(req.params.projectId, req.query.webhook_id ? String(req.query.webhook_id) : undefined)); };
  test = async (req: any, res: Response) => { if (!(await this.manage(req, res))) return; try { res.status(202).json(await enqueueTestDelivery(req.params.projectId, req.params.webhookId, req.user.id)); } catch (error) { return handle(error, res); } };
  retry = async (req: any, res: Response) => { if (!(await this.manage(req, res))) return; try { res.json(await retryDelivery(req.params.projectId, req.params.deliveryId)); } catch (error) { return handle(error, res); } };
}
