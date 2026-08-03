import { Response } from 'express';
import { canViewProject } from '../../services/permissions';
import { InvalidSavedViewFiltersError } from '../../services/savedViewFilters';
import { operationalReport, parseReportFilters, streamCsv } from './reports.service';

export class ReportsController {
  private async authorized(req: any, res: Response) {
    const filters = parseReportFilters(req.query);
    if (!(await canViewProject(req.user.id, filters.projectId))) { res.status(404).json({ error: 'Project not found or access denied' }); return null; }
    return filters;
  }
  operational = async (req: any, res: Response) => { try { const filters = await this.authorized(req, res); if (filters) res.json(await operationalReport(filters)); } catch (error) { if (error instanceof InvalidSavedViewFiltersError) return res.status(400).json({ error: error.message }); throw error; } };
  exportCsv = async (req: any, res: Response) => { try { const filters = await this.authorized(req, res); if (filters) await streamCsv(res, filters, String(req.params.type)); } catch (error) { if (error instanceof InvalidSavedViewFiltersError) return res.status(400).json({ error: error.message }); throw error; } };
}
