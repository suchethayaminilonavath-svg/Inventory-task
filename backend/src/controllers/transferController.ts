import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TransferService } from '../services/transferService.js';
import { AppError } from '../middleware/errorHandler.js';

const createTransferSchema = z.object({
  sourceWarehouseId: z.string().uuid(),
  destinationWarehouseId: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantityRequested: z.number().int().min(1),
    })
  ).min(1),
});

export class TransferController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TransferService.getTransfers({
        status: req.query.status as string,
        sourceWarehouseId: req.query.sourceWarehouseId as string,
        destinationWarehouseId: req.query.destinationWarehouseId as string,
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
      const transfer = await TransferService.getTransferById(req.params.id);
      res.json({ transfer });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createTransferSchema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const transfer = await TransferService.createTransfer(data, userId);
      res.status(201).json({ transfer });
    } catch (err) {
      next(err);
    }
  }

  static async request(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const transfer = await TransferService.requestTransfer(req.params.id, userId);
      res.json({ message: 'Transfer requested for approval', transfer });
    } catch (err) {
      next(err);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const transfer = await TransferService.approveTransfer(req.params.id, userId);
      res.json({ message: 'Transfer approved', transfer });
    } catch (err) {
      next(err);
    }
  }

  static async dispatch(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const transfer = await TransferService.dispatchTransfer(req.params.id, userId);
      res.json({ message: 'Transfer dispatched. Stock deducted from source warehouse.', transfer });
    } catch (err) {
      next(err);
    }
  }

  static async receive(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const transfer = await TransferService.receiveTransfer(req.params.id, userId);
      res.json({ message: 'Transfer received. Stock added to destination warehouse.', transfer });
    } catch (err) {
      next(err);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const transfer = await TransferService.rejectTransfer(req.params.id, userId, req.body?.reason);
      res.json({ message: 'Transfer rejected', transfer });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const transfer = await TransferService.cancelTransfer(req.params.id, userId, req.body?.reason);
      res.json({ message: 'Transfer cancelled', transfer });
    } catch (err) {
      next(err);
    }
  }
}
