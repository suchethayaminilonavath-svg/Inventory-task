import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../config/db.js';
import { MovementType } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

export interface RecordMovementParams {
  productId: string;
  warehouseId: string;
  movementType: MovementType | string;
  quantity: number; // positive for additions, negative for deductions
  reason: string;
  referenceId?: string;
  referenceType?: 'PURCHASE_ORDER' | 'TRANSFER' | 'AUDIT' | 'MANUAL';
  userId?: string;
}

export class MovementService {
  /**
   * Central atomic inventory movement engine.
   * Can be executed within an existing Prisma transaction or will start its own.
   */
  static async recordMovement(
    params: RecordMovementParams,
    externalTx?: Prisma.TransactionClient
  ) {
    const {
      productId,
      warehouseId,
      movementType,
      quantity,
      reason,
      referenceId,
      referenceType,
      userId,
    } = params;

    if (quantity === 0) {
      throw new AppError('Movement quantity cannot be zero', 400);
    }

    const executeInTransaction = async (tx: Prisma.TransactionClient) => {
      // 1. Verify product exists and is not archived
      const product = await tx.product.findUnique({
        where: { id: productId },
      });
      if (!product) {
        throw new AppError(`Product with ID '${productId}' not found`, 404);
      }
      if (product.isArchived) {
        throw new AppError(`Cannot move inventory for archived product '${product.name}' (${product.sku})`, 400);
      }

      // 2. Verify warehouse exists and is active
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!warehouse) {
        throw new AppError(`Warehouse with ID '${warehouseId}' not found`, 404);
      }
      if (!warehouse.isActive) {
        throw new AppError(`Cannot move inventory in inactive warehouse '${warehouse.name}'`, 400);
      }

      // 3. Find current warehouse inventory balance
      const currentInventory = await tx.warehouseInventory.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId,
          },
        },
      });

      const previousBalance = currentInventory?.quantity ?? 0;
      const newBalance = previousBalance + quantity;

      // 4. Guard against negative stock balances
      if (newBalance < 0) {
        throw new AppError(
          `Insufficient stock for product '${product.name}' in warehouse '${warehouse.name}'. Available: ${previousBalance}, Attempted deduction: ${Math.abs(quantity)}`,
          400
        );
      }

      // 5. Update or create the inventory balance
      await tx.warehouseInventory.upsert({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId,
          },
        },
        update: {
          quantity: newBalance,
        },
        create: {
          warehouseId,
          productId,
          quantity: newBalance,
          minThreshold: product.minStockThreshold,
        },
      });

      // 6. Record append-only movement ledger entry
      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          warehouseId,
          movementType,
          quantity,
          previousBalance,
          newBalance,
          referenceId: referenceId ?? null,
          referenceType: referenceType ?? 'MANUAL',
          userId: userId ?? null,
          reason,
          timestamp: new Date(),
        },
        include: {
          product: { select: { id: true, sku: true, name: true, uom: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return movement;
    };

    if (externalTx) {
      return executeInTransaction(externalTx);
    } else {
      return prisma.$transaction(async (tx) => {
        return executeInTransaction(tx);
      });
    }
  }

  /**
   * Query movements with filtering and pagination
   */
  static async getMovements(filters: {
    productId?: string;
    warehouseId?: string;
    movementType?: string;
    referenceId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = {};

    if (filters.productId) where.productId = filters.productId;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.movementType) where.movementType = filters.movementType;
    if (filters.referenceId) where.referenceId = filters.referenceId;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
      if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    const [total, movements] = await Promise.all([
      prisma.inventoryMovement.count({ where }),
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          product: { select: { id: true, sku: true, name: true, uom: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
