import { Prisma } from '@prisma/client';
import prisma from '../config/db.js';
import { PurchaseOrderStatus, MovementType } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { MovementService } from './movementService.js';

export interface CreatePurchaseOrderDTO {
  supplierId: string;
  warehouseId: string;
  notes?: string;
  taxRate?: number;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface ReceivePOItemDTO {
  productId: string;
  quantityReceived: number;
}

export class PurchaseOrderService {
  /**
   * Create PO in DRAFT state
   */
  static async createPO(data: CreatePurchaseOrderDTO, userId: string) {
    if (!data.items || data.items.length === 0) {
      throw new AppError('Purchase order must contain at least one item', 400);
    }

    const [supplier, warehouse] = await Promise.all([
      prisma.supplier.findUnique({ where: { id: data.supplierId } }),
      prisma.warehouse.findUnique({ where: { id: data.warehouseId } }),
    ]);

    if (!supplier) throw new AppError('Supplier not found', 404);
    if (supplier.status !== 'ACTIVE') throw new AppError('Cannot create PO with inactive supplier', 400);
    if (!warehouse) throw new AppError('Warehouse not found', 404);
    if (!warehouse.isActive) throw new AppError('Cannot create PO for inactive warehouse', 400);

    // Calculate totals
    let subtotal = 0;
    const itemsData = data.items.map((item) => {
      if (item.quantity <= 0) throw new AppError('Item quantity must be greater than zero', 400);
      if (item.unitPrice < 0) throw new AppError('Item unit price cannot be negative', 400);
      const itemSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
      subtotal += itemSubtotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: itemSubtotal,
        receivedQuantity: 0,
      };
    });

    const taxRate = data.taxRate ?? 0;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const orderNumber = `PO-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    return prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        status: PurchaseOrderStatus.DRAFT,
        subtotal,
        tax,
        total,
        notes: data.notes,
        createdById: userId,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: { include: { product: true } },
        supplier: true,
        warehouse: true,
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  /**
   * Submit PO (DRAFT -> SUBMITTED)
   */
  static async submitPO(poId: string, userId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new AppError('Purchase order not found', 404);
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new AppError(`Cannot submit purchase order in '${po.status}' state. Must be DRAFT.`, 400);
    }

    return prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: PurchaseOrderStatus.SUBMITTED },
      include: { items: { include: { product: true } }, supplier: true, warehouse: true },
    });
  }

  /**
   * Approve PO (SUBMITTED -> APPROVED)
   */
  static async approvePO(poId: string, approvedById: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new AppError('Purchase order not found', 404);
    if (po.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new AppError(`Cannot approve purchase order in '${po.status}' state. Must be SUBMITTED.`, 400);
    }

    return prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedById,
      },
      include: { items: { include: { product: true } }, supplier: true, warehouse: true, approvedBy: true },
    });
  }

  /**
   * Reject PO (SUBMITTED -> REJECTED)
   */
  static async rejectPO(poId: string, userId: string, reason?: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new AppError('Purchase order not found', 404);
    if (po.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new AppError(`Cannot reject purchase order in '${po.status}' state. Must be SUBMITTED.`, 400);
    }

    return prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PurchaseOrderStatus.REJECTED,
        notes: reason ? `${po.notes || ''} [Rejected: ${reason}]`.trim() : po.notes,
      },
    });
  }

  /**
   * Cancel PO (DRAFT, SUBMITTED, APPROVED -> CANCELLED)
   */
  static async cancelPO(poId: string, userId: string, reason?: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new AppError('Purchase order not found', 404);
    if (
      po.status === PurchaseOrderStatus.RECEIVED ||
      po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED ||
      po.status === PurchaseOrderStatus.REJECTED ||
      po.status === PurchaseOrderStatus.CANCELLED
    ) {
      throw new AppError(`Cannot cancel purchase order in '${po.status}' state.`, 400);
    }

    return prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
        notes: reason ? `${po.notes || ''} [Cancelled: ${reason}]`.trim() : po.notes,
      },
    });
  }

  /**
   * Record partial or complete receiving of goods.
   * Updates warehouse inventory via movement engine.
   * Guarantees no duplicate or excess quantity received.
   */
  static async receiveGoods(
    poId: string,
    receivingItems: ReceivePOItemDTO[],
    userId: string
  ) {
    if (!receivingItems || receivingItems.length === 0) {
      throw new AppError('At least one item must be received', 400);
    }

    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: {
          items: { include: { product: true } },
          warehouse: true,
          supplier: true,
        },
      });

      if (!po) throw new AppError('Purchase order not found', 404);

      if (
        po.status !== PurchaseOrderStatus.APPROVED &&
        po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
      ) {
        throw new AppError(
          `Cannot receive goods for purchase order in '${po.status}' state. Must be APPROVED or PARTIALLY_RECEIVED.`,
          400
        );
      }

      // Process received items
      for (const rec of receivingItems) {
        if (rec.quantityReceived <= 0) {
          throw new AppError('Quantity received must be greater than zero', 400);
        }

        const poItem = po.items.find((i) => i.productId === rec.productId);
        if (!poItem) {
          throw new AppError(`Product '${rec.productId}' is not part of this purchase order`, 400);
        }

        const pendingQty = poItem.quantity - poItem.receivedQuantity;
        if (rec.quantityReceived > pendingQty) {
          throw new AppError(
            `Received quantity (${rec.quantityReceived}) exceeds pending quantity (${pendingQty}) for product '${poItem.product.name}'. Duplicate or excess receipt blocked.`,
            400
          );
        }

        // 1. Update receivedQuantity on PO item
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            receivedQuantity: poItem.receivedQuantity + rec.quantityReceived,
          },
        });

        // 2. Record stock movement into destination warehouse
        await MovementService.recordMovement(
          {
            productId: rec.productId,
            warehouseId: po.warehouseId,
            movementType: MovementType.STOCK_RECEIVED,
            quantity: rec.quantityReceived,
            reason: `PO Receipt ${po.orderNumber} from ${po.supplier.name}`,
            referenceId: po.id,
            referenceType: 'PURCHASE_ORDER',
            userId,
          },
          tx
        );
      }

      // Check updated status of all items
      const updatedPOItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: poId },
      });

      const allFullyReceived = updatedPOItems.every((item) => item.receivedQuantity >= item.quantity);
      const someReceived = updatedPOItems.some((item) => item.receivedQuantity > 0);

      const newStatus = allFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : someReceived
        ? PurchaseOrderStatus.PARTIALLY_RECEIVED
        : po.status;

      return tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: newStatus },
        include: {
          items: { include: { product: true } },
          supplier: true,
          warehouse: true,
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          approvedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });
    });
  }

  /**
   * List purchase orders
   */
  static async getPurchaseOrders(filters: {
    status?: string;
    supplierId?: string;
    warehouseId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;

    const [total, purchaseOrders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: true } },
          supplier: true,
          warehouse: true,
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          approvedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    return {
      purchaseOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPOById(id: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        supplier: true,
        warehouse: true,
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!po) throw new AppError('Purchase order not found', 404);
    return po;
  }
}
