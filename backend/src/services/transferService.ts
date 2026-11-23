import { Prisma } from '@prisma/client';
import prisma from '../config/db.js';
import { TransferStatus, MovementType } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { MovementService } from './movementService.js';

export interface CreateTransferDTO {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  notes?: string;
  items: {
    productId: string;
    quantityRequested: number;
  }[];
}

export class TransferService {
  /**
   * Create a new transfer in DRAFT state
   */
  static async createTransfer(data: CreateTransferDTO, userId: string) {
    if (data.sourceWarehouseId === data.destinationWarehouseId) {
      throw new AppError('Source and destination warehouses cannot be the same', 400);
    }

    if (!data.items || data.items.length === 0) {
      throw new AppError('Transfer must contain at least one item', 400);
    }

    // Verify warehouses exist
    const [source, dest] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: data.sourceWarehouseId } }),
      prisma.warehouse.findUnique({ where: { id: data.destinationWarehouseId } }),
    ]);

    if (!source || !source.isActive) throw new AppError('Invalid or inactive source warehouse', 400);
    if (!dest || !dest.isActive) throw new AppError('Invalid or inactive destination warehouse', 400);

    const transferNumber = `TRF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    return prisma.$transaction(async (tx) => {
      // Validate items and check initial available stock
      for (const item of data.items) {
        if (item.quantityRequested <= 0) {
          throw new AppError('Quantity requested must be greater than zero', 400);
        }

        const inv = await tx.warehouseInventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: data.sourceWarehouseId,
              productId: item.productId,
            },
          },
          include: { product: true },
        });

        const available = inv?.quantity ?? 0;
        if (available < item.quantityRequested) {
          const prodName = inv?.product.name || item.productId;
          throw new AppError(
            `Cannot create transfer: Source warehouse has insufficient stock for '${prodName}'. Available: ${available}, requested: ${item.quantityRequested}`,
            400
          );
        }
      }

      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          sourceWarehouseId: data.sourceWarehouseId,
          destinationWarehouseId: data.destinationWarehouseId,
          status: TransferStatus.DRAFT,
          notes: data.notes,
          requestedById: userId,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantityRequested: item.quantityRequested,
              quantityTransferred: 0,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          sourceWarehouse: true,
          destinationWarehouse: true,
          requestedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      return transfer;
    });
  }

  /**
   * Request transfer approval (DRAFT -> REQUESTED)
   */
  static async requestTransfer(transferId: string, userId: string) {
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true },
    });

    if (!transfer) throw new AppError('Transfer not found', 404);
    if (transfer.status !== TransferStatus.DRAFT) {
      throw new AppError(`Cannot request transfer in '${transfer.status}' status. Must be DRAFT.`, 400);
    }

    return prisma.stockTransfer.update({
      where: { id: transferId },
      data: { status: TransferStatus.REQUESTED },
      include: { items: { include: { product: true } }, sourceWarehouse: true, destinationWarehouse: true },
    });
  }

  /**
   * Approve transfer (REQUESTED -> APPROVED)
   */
  static async approveTransfer(transferId: string, approvedById: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: { items: { include: { product: true } } },
      });

      if (!transfer) throw new AppError('Transfer not found', 404);
      if (transfer.status !== TransferStatus.REQUESTED) {
        throw new AppError(`Cannot approve transfer in '${transfer.status}' status. Must be REQUESTED.`, 400);
      }

      // Re-verify stock before approving
      for (const item of transfer.items) {
        const inv = await tx.warehouseInventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: transfer.sourceWarehouseId,
              productId: item.productId,
            },
          },
        });
        const currentQty = inv?.quantity ?? 0;
        if (currentQty < item.quantityRequested) {
          throw new AppError(
            `Approval failed: Insufficient stock for product '${item.product.name}' in source warehouse. Available: ${currentQty}, needed: ${item.quantityRequested}`,
            400
          );
        }
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.APPROVED,
          approvedById,
        },
        include: { items: { include: { product: true } }, sourceWarehouse: true, destinationWarehouse: true, approvedBy: true },
      });
    });
  }

  /**
   * Dispatch transfer to transit (APPROVED -> IN_TRANSIT)
   * Deducts inventory from source warehouse via movement ledger!
   */
  static async dispatchTransfer(transferId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: { items: { include: { product: true } }, sourceWarehouse: true, destinationWarehouse: true },
      });

      if (!transfer) throw new AppError('Transfer not found', 404);
      if (transfer.status !== TransferStatus.APPROVED) {
        throw new AppError(`Cannot dispatch transfer in '${transfer.status}' status. Must be APPROVED.`, 400);
      }

      // Deduct stock from source warehouse
      for (const item of transfer.items) {
        await MovementService.recordMovement(
          {
            productId: item.productId,
            warehouseId: transfer.sourceWarehouseId,
            movementType: MovementType.TRANSFER_OUT,
            quantity: -item.quantityRequested,
            reason: `Dispatched in Transfer ${transfer.transferNumber} to ${transfer.destinationWarehouse.name}`,
            referenceId: transfer.id,
            referenceType: 'TRANSFER',
            userId,
          },
          tx
        );

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { quantityTransferred: item.quantityRequested },
        });
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.IN_TRANSIT },
        include: { items: { include: { product: true } }, sourceWarehouse: true, destinationWarehouse: true },
      });
    });
  }

  /**
   * Receive transfer (IN_TRANSIT -> RECEIVED)
   * Adds inventory to destination warehouse via movement ledger!
   * Strictly prevents duplicate receiving.
   */
  static async receiveTransfer(transferId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: { items: { include: { product: true } }, sourceWarehouse: true, destinationWarehouse: true },
      });

      if (!transfer) throw new AppError('Transfer not found', 404);
      if (transfer.status !== TransferStatus.IN_TRANSIT) {
        throw new AppError(
          `Cannot receive transfer in '${transfer.status}' status. Must be IN_TRANSIT. Duplicate receiving prevented.`,
          400
        );
      }

      // Add stock to destination warehouse
      for (const item of transfer.items) {
        await MovementService.recordMovement(
          {
            productId: item.productId,
            warehouseId: transfer.destinationWarehouseId,
            movementType: MovementType.TRANSFER_IN,
            quantity: item.quantityTransferred,
            reason: `Received from Transfer ${transfer.transferNumber} from ${transfer.sourceWarehouse.name}`,
            referenceId: transfer.id,
            referenceType: 'TRANSFER',
            userId,
          },
          tx
        );
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.RECEIVED },
        include: { items: { include: { product: true } }, sourceWarehouse: true, destinationWarehouse: true },
      });
    });
  }

  /**
   * Reject transfer (REQUESTED / APPROVED -> REJECTED)
   */
  static async rejectTransfer(transferId: string, userId: string, reason?: string) {
    const transfer = await prisma.stockTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) throw new AppError('Transfer not found', 404);

    if (transfer.status !== TransferStatus.REQUESTED && transfer.status !== TransferStatus.APPROVED) {
      throw new AppError(`Cannot reject transfer in '${transfer.status}' status.`, 400);
    }

    return prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: TransferStatus.REJECTED,
        notes: reason ? `${transfer.notes || ''} [Rejected: ${reason}]`.trim() : transfer.notes,
      },
    });
  }

  /**
   * Cancel transfer (DRAFT / REQUESTED / APPROVED / IN_TRANSIT -> CANCELLED)
   * If in transit, refunds deducted inventory back to source warehouse!
   */
  static async cancelTransfer(transferId: string, userId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: { items: true, sourceWarehouse: true },
      });

      if (!transfer) throw new AppError('Transfer not found', 404);

      if (
        transfer.status === TransferStatus.RECEIVED ||
        transfer.status === TransferStatus.REJECTED ||
        transfer.status === TransferStatus.CANCELLED
      ) {
        throw new AppError(`Cannot cancel transfer already in terminal status '${transfer.status}'.`, 400);
      }

      // If already in transit, restore deducted items back to source warehouse
      if (transfer.status === TransferStatus.IN_TRANSIT) {
        for (const item of transfer.items) {
          if (item.quantityTransferred > 0) {
            await MovementService.recordMovement(
              {
                productId: item.productId,
                warehouseId: transfer.sourceWarehouseId,
                movementType: MovementType.RETURNED_STOCK,
                quantity: item.quantityTransferred,
                reason: `Cancelled in-transit Transfer ${transfer.transferNumber}. Stock restored. ${reason || ''}`.trim(),
                referenceId: transfer.id,
                referenceType: 'TRANSFER',
                userId,
              },
              tx
            );
          }
        }
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.CANCELLED,
          notes: reason ? `${transfer.notes || ''} [Cancelled: ${reason}]`.trim() : transfer.notes,
        },
      });
    });
  }

  /**
   * List transfers with filtering
   */
  static async getTransfers(filters: {
    status?: string;
    sourceWarehouseId?: string;
    destinationWarehouseId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.StockTransferWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.sourceWarehouseId) where.sourceWarehouseId = filters.sourceWarehouseId;
    if (filters.destinationWarehouseId) where.destinationWarehouseId = filters.destinationWarehouseId;

    const [total, transfers] = await Promise.all([
      prisma.stockTransfer.count({ where }),
      prisma.stockTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: true } },
          sourceWarehouse: true,
          destinationWarehouse: true,
          requestedBy: { select: { id: true, name: true, email: true, role: true } },
          approvedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    return {
      transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getTransferById(id: string) {
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        sourceWarehouse: true,
        destinationWarehouse: true,
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!transfer) throw new AppError('Transfer not found', 404);
    return transfer;
  }
}
