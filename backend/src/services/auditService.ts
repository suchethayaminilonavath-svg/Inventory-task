import { Prisma } from '@prisma/client';
import prisma from '../config/db.js';
import { StockAuditStatus, MovementType } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { MovementService } from './movementService.js';

export interface CreateAuditDTO {
  warehouseId: string;
  productIds?: string[]; // if omitted, includes all active products with inventory in warehouse
  notes?: string;
}

export interface RecordAuditCountDTO {
  productId: string;
  physicalQuantity: number;
  reason?: string;
}

export class StockAuditService {
  /**
   * Create a new stock audit session in DRAFT state
   * Captures snapshot system quantities.
   */
  static async createAudit(data: CreateAuditDTO, userId: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
    });
    if (!warehouse || !warehouse.isActive) {
      throw new AppError('Warehouse not found or inactive', 400);
    }

    const auditNumber = `AUD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    return prisma.$transaction(async (tx) => {
      // Find products to include
      let productsToAudit: { id: string }[] = [];
      if (data.productIds && data.productIds.length > 0) {
        productsToAudit = await tx.product.findMany({
          where: { id: { in: data.productIds }, isArchived: false },
          select: { id: true },
        });
      } else {
        // All active products
        productsToAudit = await tx.product.findMany({
          where: { isArchived: false },
          select: { id: true },
        });
      }

      if (productsToAudit.length === 0) {
        throw new AppError('No eligible products found for stock audit', 400);
      }

      // Fetch current snapshot inventory for each product
      const inventories = await tx.warehouseInventory.findMany({
        where: {
          warehouseId: data.warehouseId,
          productId: { in: productsToAudit.map((p) => p.id) },
        },
      });

      const invMap = new Map(inventories.map((i) => [i.productId, i.quantity]));

      const itemsData = productsToAudit.map((p) => {
        const sysQty = invMap.get(p.id) ?? 0;
        return {
          productId: p.id,
          systemQuantity: sysQty,
          physicalQuantity: null,
          discrepancyQuantity: 0,
          reason: null,
          isAdjusted: false,
        };
      });

      const audit = await tx.stockAudit.create({
        data: {
          auditNumber,
          warehouseId: data.warehouseId,
          status: StockAuditStatus.DRAFT,
          notes: data.notes,
          conductedById: userId,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: { include: { product: true } },
          warehouse: true,
          conductedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      return audit;
    });
  }

  /**
   * Record physical count for products
   */
  static async recordCounts(
    auditId: string,
    counts: RecordAuditCountDTO[],
    userId: string
  ) {
    const audit = await prisma.stockAudit.findUnique({
      where: { id: auditId },
      include: { items: true },
    });

    if (!audit) throw new AppError('Stock audit not found', 404);
    if (
      audit.status !== StockAuditStatus.DRAFT &&
      audit.status !== StockAuditStatus.IN_PROGRESS
    ) {
      throw new AppError(`Cannot record counts for audit in '${audit.status}' state.`, 400);
    }

    return prisma.$transaction(async (tx) => {
      for (const count of counts) {
        if (count.physicalQuantity < 0) {
          throw new AppError('Physical quantity cannot be negative', 400);
        }

        const item = audit.items.find((i) => i.productId === count.productId);
        if (!item) {
          throw new AppError(`Product '${count.productId}' is not in this audit session`, 400);
        }

        const discrepancy = count.physicalQuantity - item.systemQuantity;
        if (discrepancy !== 0 && (!count.reason || !count.reason.trim())) {
          throw new AppError(
            `A reason is required for discrepancy of ${discrepancy} on product ID '${count.productId}'`,
            400
          );
        }

        await tx.stockAuditItem.update({
          where: { id: item.id },
          data: {
            physicalQuantity: count.physicalQuantity,
            discrepancyQuantity: discrepancy,
            reason: count.reason?.trim() || null,
          },
        });
      }

      return tx.stockAudit.update({
        where: { id: auditId },
        data: {
          status: StockAuditStatus.IN_PROGRESS,
          conductedAt: new Date(),
        },
        include: {
          items: { include: { product: true } },
          warehouse: true,
          conductedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });
    });
  }

  /**
   * Submit audit for manager approval (IN_PROGRESS -> SUBMITTED)
   */
  static async submitAudit(auditId: string, userId: string) {
    const audit = await prisma.stockAudit.findUnique({
      where: { id: auditId },
      include: { items: true },
    });

    if (!audit) throw new AppError('Stock audit not found', 404);
    if (
      audit.status !== StockAuditStatus.DRAFT &&
      audit.status !== StockAuditStatus.IN_PROGRESS
    ) {
      throw new AppError(`Cannot submit audit in '${audit.status}' state.`, 400);
    }

    // Ensure all items have been counted
    const uncounted = audit.items.filter((i) => i.physicalQuantity === null);
    if (uncounted.length > 0) {
      throw new AppError(`Cannot submit audit: ${uncounted.length} item(s) have not been physically counted.`, 400);
    }

    return prisma.stockAudit.update({
      where: { id: auditId },
      data: { status: StockAuditStatus.SUBMITTED },
      include: {
        items: { include: { product: true } },
        warehouse: true,
        conductedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  /**
   * Approve audit adjustments (SUBMITTED -> APPROVED)
   * Only approved adjustments update inventory balances!
   */
  static async approveAudit(auditId: string, approvedById: string) {
    return prisma.$transaction(async (tx) => {
      const audit = await tx.stockAudit.findUnique({
        where: { id: auditId },
        include: {
          items: { include: { product: true } },
          warehouse: true,
        },
      });

      if (!audit) throw new AppError('Stock audit not found', 404);
      if (audit.status !== StockAuditStatus.SUBMITTED) {
        throw new AppError(`Cannot approve audit in '${audit.status}' state. Must be SUBMITTED.`, 400);
      }

      // Apply adjustments for items with discrepancies
      for (const item of audit.items) {
        if (item.discrepancyQuantity !== 0 && !item.isAdjusted) {
          const moveType =
            item.discrepancyQuantity < 0 && item.reason?.toLowerCase().includes('damage')
              ? MovementType.DAMAGED_STOCK
              : MovementType.MANUAL_ADJUSTMENT;

          await MovementService.recordMovement(
            {
              productId: item.productId,
              warehouseId: audit.warehouseId,
              movementType: moveType,
              quantity: item.discrepancyQuantity,
              reason: `Stock Audit Reconciliation (${audit.auditNumber}): ${item.reason || 'Variance reconciliation'}`,
              referenceId: audit.id,
              referenceType: 'AUDIT',
              userId: approvedById,
            },
            tx
          );

          await tx.stockAuditItem.update({
            where: { id: item.id },
            data: { isAdjusted: true },
          });
        }
      }

      return tx.stockAudit.update({
        where: { id: auditId },
        data: {
          status: StockAuditStatus.APPROVED,
          approvedById,
        },
        include: {
          items: { include: { product: true } },
          warehouse: true,
          conductedBy: { select: { id: true, name: true, email: true, role: true } },
          approvedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });
    });
  }

  /**
   * Reject audit (SUBMITTED -> REJECTED)
   */
  static async rejectAudit(auditId: string, userId: string, reason?: string) {
    const audit = await prisma.stockAudit.findUnique({ where: { id: auditId } });
    if (!audit) throw new AppError('Stock audit not found', 404);
    if (audit.status !== StockAuditStatus.SUBMITTED) {
      throw new AppError(`Cannot reject audit in '${audit.status}' state. Must be SUBMITTED.`, 400);
    }

    return prisma.stockAudit.update({
      where: { id: auditId },
      data: {
        status: StockAuditStatus.REJECTED,
        notes: reason ? `${audit.notes || ''} [Rejected: ${reason}]`.trim() : audit.notes,
      },
    });
  }

  /**
   * List audits
   */
  static async getAudits(filters: {
    status?: string;
    warehouseId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.StockAuditWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;

    const [total, audits] = await Promise.all([
      prisma.stockAudit.count({ where }),
      prisma.stockAudit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: true } },
          warehouse: true,
          conductedBy: { select: { id: true, name: true, email: true, role: true } },
          approvedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    return {
      audits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getAuditById(id: string) {
    const audit = await prisma.stockAudit.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        warehouse: true,
        conductedBy: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!audit) throw new AppError('Stock audit not found', 404);
    return audit;
  }
}
