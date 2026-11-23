import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PurchaseOrderService } from '../services/purchaseOrderService.js';
import { AppError } from '../middleware/errorHandler.js';

const createPOSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  notes: z.string().optional(),
  taxRate: z.number().min(0).default(0),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
    })
  ).min(1),
});

const receiveItemsSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantityReceived: z.number().int().min(1),
    })
  ).min(1),
});

export class PurchaseOrderController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PurchaseOrderService.getPurchaseOrders({
        status: req.query.status as string,
        supplierId: req.query.supplierId as string,
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
      const po = await PurchaseOrderService.getPOById(req.params.id);
      res.json({ purchaseOrder: po });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createPOSchema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const po = await PurchaseOrderService.createPO(data, userId);
      res.status(201).json({ purchaseOrder: po });
    } catch (err) {
      next(err);
    }
  }

  static async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const po = await PurchaseOrderService.submitPO(req.params.id, userId);
      res.json({ message: 'Purchase order submitted for approval', purchaseOrder: po });
    } catch (err) {
      next(err);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const po = await PurchaseOrderService.approvePO(req.params.id, userId);
      res.json({ message: 'Purchase order approved', purchaseOrder: po });
    } catch (err) {
      next(err);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const po = await PurchaseOrderService.rejectPO(req.params.id, userId, req.body?.reason);
      res.json({ message: 'Purchase order rejected', purchaseOrder: po });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const po = await PurchaseOrderService.cancelPO(req.params.id, userId, req.body?.reason);
      res.json({ message: 'Purchase order cancelled', purchaseOrder: po });
    } catch (err) {
      next(err);
    }
  }

  static async receive(req: Request, res: Response, next: NextFunction) {
    try {
      const data = receiveItemsSchema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const po = await PurchaseOrderService.receiveGoods(req.params.id, data.items, userId);
      res.json({ message: 'Goods received and inventory updated successfully', purchaseOrder: po });
    } catch (err) {
      next(err);
    }
  }
}
