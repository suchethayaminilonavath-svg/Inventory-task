import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StockAuditService } from '../services/auditService.js';
import { AppError } from '../middleware/errorHandler.js';

const createAuditSchema = z.object({
  warehouseId: z.string().uuid(),
  productIds: z.array(z.string().uuid()).optional(),
  notes: z.string().optional(),
});

const recordCountsSchema = z.object({
  counts: z.array(
    z.object({
      productId: z.string().uuid(),
      physicalQuantity: z.number().int().min(0),
      reason: z.string().optional(),
    })
  ).min(1),
});

export class StockAuditController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StockAuditService.getAudits({
        status: req.query.status as string,
        warehouseId: req.query.warehouseId as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const audit = await StockAuditService.getAuditById(req.params.id);
      res.json({ audit });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createAuditSchema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const audit = await StockAuditService.createAudit(data, userId);
      res.status(201).json({ audit });
    } catch (err) {
      next(err);
    }
  }

  static async recordCounts(req: Request, res: Response, next: NextFunction) {
    try {
      const data = recordCountsSchema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const audit = await StockAuditService.recordCounts(req.params.id, data.counts, userId);
      res.json({ message: 'Audit counts recorded successfully', audit });
    } catch (err) {
      next(err);
    }
  }

  static async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const audit = await StockAuditService.submitAudit(req.params.id, userId);
      res.json({ message: 'Audit submitted for manager approval', audit });
    } catch (err) {
      next(err);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const audit = await StockAuditService.approveAudit(req.params.id, userId);
      res.json({ message: 'Audit adjustments approved and inventory reconciled', audit });
    } catch (err) {
      next(err);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const audit = await StockAuditService.rejectAudit(req.params.id, userId, req.body?.reason);
      res.json({ message: 'Audit rejected', audit });
    } catch (err) {
      next(err);
    }
  }
}
