import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { MovementService } from '../services/movementService.js';
import { MovementType } from '../types/index.js';

const warehouseSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(10),
  address: z.string().min(3),
  city: z.string().min(2),
  state: z.string().optional(),
  country: z.string().default('USA'),
  postalCode: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

const initializeStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  minThreshold: z.number().int().min(0).optional(),
  reason: z.string().optional(),
});

export class WarehouseController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const warehouses = await prisma.warehouse.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { inventories: true } },
          inventories: {
            select: { quantity: true },
          },
        },
      });

      const formatted = warehouses.map((w) => {
        const totalUnits = w.inventories.reduce((sum, inv) => sum + inv.quantity, 0);
        return {
          id: w.id,
          name: w.name,
          code: w.code,
          address: w.address,
          city: w.city,
          state: w.state,
          country: w.country,
          postalCode: w.postalCode,
          contactName: w.contactName,
          contactEmail: w.contactEmail,
          contactPhone: w.contactPhone,
          isActive: w.isActive,
          skuCount: w._count.inventories,
          totalUnits,
          createdAt: w.createdAt,
        };
      });

      res.json({ warehouses: formatted });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const warehouse = await prisma.warehouse.findUnique({
        where: { id },
        include: {
          inventories: {
            include: {
              product: { include: { category: true } },
            },
            orderBy: { product: { name: 'asc' } },
          },
        },
      });

      if (!warehouse) throw new AppError('Warehouse not found', 404);

      const totalUnits = warehouse.inventories.reduce((sum, i) => sum + i.quantity, 0);
      const lowStockCount = warehouse.inventories.filter((i) => i.quantity <= i.minThreshold).length;

      res.json({
        warehouse: {
          ...warehouse,
          totalUnits,
          lowStockCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = warehouseSchema.parse(req.body);
      const codeUpper = data.code.toUpperCase().trim();

      const existing = await prisma.warehouse.findUnique({ where: { code: codeUpper } });
      if (existing) {
        throw new AppError(`Warehouse with code '${codeUpper}' already exists`, 409);
      }

      const warehouse = await prisma.warehouse.create({
        data: {
          ...data,
          code: codeUpper,
        },
      });

      res.status(201).json({ warehouse });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = warehouseSchema.partial().parse(req.body);

      if (data.code) {
        const codeUpper = data.code.toUpperCase().trim();
        const duplicate = await prisma.warehouse.findUnique({ where: { code: codeUpper } });
        if (duplicate && duplicate.id !== id) {
          throw new AppError(`Warehouse with code '${codeUpper}' already exists`, 409);
        }
        data.code = codeUpper;
      }

      const warehouse = await prisma.warehouse.update({
        where: { id },
        data,
      });

      res.json({ warehouse });
    } catch (err) {
      next(err);
    }
  }

  static async getWarehouseInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const inventories = await prisma.warehouseInventory.findMany({
        where: { warehouseId: id },
        include: {
          product: { include: { category: true } },
        },
        orderBy: { product: { name: 'asc' } },
      });

      const formatted = inventories.map((inv) => ({
        ...inv,
        isLowStock: inv.quantity <= inv.minThreshold,
        isOutOfStock: inv.quantity === 0,
      }));

      res.json({ inventories: formatted });
    } catch (err) {
      next(err);
    }
  }

  static async initializeStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: warehouseId } = req.params;
      const data = initializeStockSchema.parse(req.body);

      // Record movement via MovementService to ensure ledger integrity!
      const movement = await MovementService.recordMovement({
        productId: data.productId,
        warehouseId,
        movementType: MovementType.STOCK_RECEIVED,
        quantity: data.quantity,
        reason: data.reason || 'Initial stock assignment',
        referenceType: 'MANUAL',
        userId: req.user?.id,
      });

      res.status(201).json({
        message: 'Stock initialized successfully',
        movement,
      });
    } catch (err) {
      next(err);
    }
  }
}
