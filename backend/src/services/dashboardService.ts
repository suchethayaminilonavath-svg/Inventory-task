import prisma from '../config/db.js';
import { PurchaseOrderStatus, TransferStatus } from '../types/index.js';

export class DashboardService {
  static async getDashboardMetrics() {
    const [
      totalProducts,
      totalWarehouses,
      inventories,
      products,
      pendingPOs,
      pendingTransfers,
      recentMovements,
    ] = await Promise.all([
      prisma.product.count({ where: { isArchived: false } }),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.warehouseInventory.findMany({
        select: {
          productId: true,
          quantity: true,
          minThreshold: true,
        },
      }),
      prisma.product.findMany({
        where: { isArchived: false },
        select: { id: true, minStockThreshold: true },
      }),
      prisma.purchaseOrder.count({
        where: {
          status: {
            in: [PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED],
          },
        },
      }),
      prisma.stockTransfer.count({
        where: {
          status: {
            in: [TransferStatus.REQUESTED, TransferStatus.APPROVED, TransferStatus.IN_TRANSIT],
          },
        },
      }),
      prisma.inventoryMovement.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          product: { select: { id: true, sku: true, name: true, uom: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Aggregate stock by product
    const productStockMap = new Map<string, number>();
    let totalInventoryQuantity = 0;

    for (const inv of inventories) {
      totalInventoryQuantity += inv.quantity;
      const current = productStockMap.get(inv.productId) || 0;
      productStockMap.set(inv.productId, current + inv.quantity);
    }

    let lowStockProducts = 0;
    let outOfStockProducts = 0;

    for (const prod of products) {
      const stock = productStockMap.get(prod.id) ?? 0;
      if (stock === 0) {
        outOfStockProducts++;
      } else if (stock <= prod.minStockThreshold) {
        lowStockProducts++;
      }
    }

    return {
      totalProducts,
      totalWarehouses,
      totalInventoryQuantity,
      lowStockProducts,
      outOfStockProducts,
      pendingPurchaseOrders: pendingPOs,
      pendingWarehouseTransfers: pendingTransfers,
      recentMovements,
    };
  }
}
