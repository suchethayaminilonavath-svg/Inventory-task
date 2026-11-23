import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MovementService } from '../services/movementService.js';
import { MovementType } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

const manualMovementSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  movementType: z.nativeEnum(MovementType),
  quantity: z.number().int(), // positive or negative
  reason: z.string().min(3),
});

export class MovementController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await MovementService.getMovements({
        productId: req.query.productId as string,
        warehouseId: req.query.warehouseId as string,
        movementType: req.query.movementType as string,
        referenceId: req.query.referenceId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async recordManual(req: Request, res: Response, next: NextFunction) {
    try {
      const data = manualMovementSchema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      // Validate sign according to movement type
      let delta = data.quantity;
      if (
        data.movementType === MovementType.STOCK_ISSUED ||
        data.movementType === MovementType.DAMAGED_STOCK
      ) {
        delta = -Math.abs(delta);
      } else if (
        data.movementType === MovementType.STOCK_RECEIVED ||
        data.movementType === MovementType.RETURNED_STOCK
      ) {
        delta = Math.abs(delta);
      }

      const movement = await MovementService.recordMovement({
        productId: data.productId,
        warehouseId: data.warehouseId,
        movementType: data.movementType,
        quantity: delta,
        reason: data.reason,
        referenceType: 'MANUAL',
        userId,
      });

      res.status(201).json({
        message: 'Movement recorded and balance updated',
        movement,
      });
    } catch (err) {
      next(err);
    }
  }
}
