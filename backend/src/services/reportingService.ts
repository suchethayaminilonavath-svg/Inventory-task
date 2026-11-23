import prisma from '../config/db.js';
import { generateCSV } from '../utils/csv.js';

export class ReportingService {
  /**
   * 1. Stock Valuation Report
   */
  static async getStockValuationReport() {
    const inventories = await prisma.warehouseInventory.findMany({
      include: {
        product: {
          include: {
            category: true,
            supplierProducts: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        warehouse: true,
      },
      orderBy: { warehouseId: 'asc' },
    });

    const report = inventories.map((inv) => {
      const unitCost = inv.product.supplierProducts[0]?.costPrice ?? 0;
      const totalValue = Math.round(inv.quantity * unitCost * 100) / 100;
      return {
        warehouseId: inv.warehouseId,
        warehouseCode: inv.warehouse.code,
        warehouseName: inv.warehouse.name,
        productId: inv.productId,
        sku: inv.product.sku,
        productName: inv.product.name,
        category: inv.product.category?.name || 'Uncategorized',
        uom: inv.product.uom,
        quantity: inv.quantity,
        unitCost,
        totalValue,
      };
    });

    const totalValuation = report.reduce((sum, r) => sum + r.totalValue, 0);
    const totalItems = report.reduce((sum, r) => sum + r.quantity, 0);

    return {
      summary: {
        totalInventoryCount: totalItems,
        totalValuation: Math.round(totalValuation * 100) / 100,
        uniqueProducts: new Set(report.map((r) => r.productId)).size,
        warehousesCovered: new Set(report.map((r) => r.warehouseId)).size,
      },
      data: report,
    };
  }

  static async exportStockValuationCSV() {
    const { data } = await this.getStockValuationReport();
    return generateCSV(data, [
      { key: 'warehouseCode', label: 'Warehouse Code' },
      { key: 'warehouseName', label: 'Warehouse Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'productName', label: 'Product Name' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'uom', label: 'UOM' },
      { key: 'unitCost', label: 'Unit Cost ($)' },
      { key: 'totalValue', label: 'Total Value ($)' },
    ]);
  }

  /**
   * 2. Low Stock Inventory Report
   */
  static async getLowStockReport() {
    const inventories = await prisma.warehouseInventory.findMany({
      include: {
        product: { include: { category: true } },
        warehouse: true,
      },
    });

    const lowStockItems = inventories
      .filter((inv) => inv.quantity <= inv.minThreshold)
      .map((inv) => ({
        warehouseCode: inv.warehouse.code,
        warehouseName: inv.warehouse.name,
        sku: inv.product.sku,
        productName: inv.product.name,
        category: inv.product.category?.name || 'Uncategorized',
        currentQuantity: inv.quantity,
        minThreshold: inv.minThreshold,
        deficit: Math.max(0, inv.minThreshold - inv.quantity),
        status: inv.quantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      }))
      .sort((a, b) => a.currentQuantity - b.currentQuantity);

    return {
      summary: {
        totalLowStockItems: lowStockItems.length,
        outOfStockCount: lowStockItems.filter((i) => i.currentQuantity === 0).length,
      },
      data: lowStockItems,
    };
  }

  static async exportLowStockCSV() {
    const { data } = await this.getLowStockReport();
    return generateCSV(data, [
      { key: 'warehouseCode', label: 'Warehouse Code' },
      { key: 'warehouseName', label: 'Warehouse Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'productName', label: 'Product Name' },
      { key: 'currentQuantity', label: 'Current Quantity' },
      { key: 'minThreshold', label: 'Min Threshold' },
      { key: 'deficit', label: 'Deficit' },
      { key: 'status', label: 'Status' },
    ]);
  }

  /**
   * 3. Warehouse Stock Report
   */
  static async getWarehouseStockReport(warehouseId?: string) {
    const warehouses = await prisma.warehouse.findMany({
      where: warehouseId ? { id: warehouseId } : undefined,
      include: {
        inventories: {
          include: {
            product: { include: { category: true } },
          },
        },
      },
    });

    const report = warehouses.map((w) => {
      const totalUnits = w.inventories.reduce((sum, i) => sum + i.quantity, 0);
      const lowStockCount = w.inventories.filter((i) => i.quantity <= i.minThreshold).length;

      return {
        warehouseId: w.id,
        warehouseCode: w.code,
        warehouseName: w.name,
        city: w.city,
        totalSkus: w.inventories.length,
        totalUnits,
        lowStockCount,
        items: w.inventories.map((i) => ({
          sku: i.product.sku,
          productName: i.product.name,
          category: i.product.category?.name || 'Uncategorized',
          quantity: i.quantity,
          minThreshold: i.minThreshold,
          uom: i.product.uom,
        })),
      };
    });

    return report;
  }

  /**
   * 4. Inventory Movements Ledger Report
   */
  static async getMovementLedgerReport(filters: {
    warehouseId?: string;
    productId?: string;
    movementType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.productId) where.productId = filters.productId;
    if (filters.movementType) where.movementType = filters.movementType;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
      if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    const movements = await prisma.inventoryMovement.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: {
        product: true,
        warehouse: true,
        user: true,
      },
    });

    return movements.map((m) => ({
      id: m.id,
      timestamp: m.timestamp.toISOString(),
      movementType: m.movementType,
      sku: m.product.sku,
      productName: m.product.name,
      warehouseCode: m.warehouse.code,
      warehouseName: m.warehouse.name,
      quantity: m.quantity,
      previousBalance: m.previousBalance,
      newBalance: m.newBalance,
      referenceType: m.referenceType || 'N/A',
      referenceId: m.referenceId || 'N/A',
      performedBy: m.user?.name || 'System',
      reason: m.reason,
    }));
  }

  static async exportMovementsCSV(filters: any) {
    const data = await this.getMovementLedgerReport(filters);
    return generateCSV(data, [
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'movementType', label: 'Movement Type' },
      { key: 'sku', label: 'SKU' },
      { key: 'productName', label: 'Product Name' },
      { key: 'warehouseCode', label: 'Warehouse Code' },
      { key: 'warehouseName', label: 'Warehouse Name' },
      { key: 'quantity', label: 'Delta Quantity' },
      { key: 'previousBalance', label: 'Previous Balance' },
      { key: 'newBalance', label: 'New Balance' },
      { key: 'performedBy', label: 'Performed By' },
      { key: 'referenceType', label: 'Ref Type' },
      { key: 'reason', label: 'Reason' },
    ]);
  }

  /**
   * 5. Stock Audit Discrepancies Report
   */
  static async getAuditDiscrepanciesReport() {
    const auditItems = await prisma.stockAuditItem.findMany({
      where: {
        discrepancyQuantity: { not: 0 },
      },
      include: {
        product: true,
        stockAudit: {
          include: {
            warehouse: true,
            conductedBy: true,
            approvedBy: true,
          },
        },
      },
      orderBy: { stockAudit: { createdAt: 'desc' } },
    });

    return auditItems.map((item) => ({
      auditNumber: item.stockAudit.auditNumber,
      auditStatus: item.stockAudit.status,
      warehouseCode: item.stockAudit.warehouse.code,
      warehouseName: item.stockAudit.warehouse.name,
      sku: item.product.sku,
      productName: item.product.name,
      systemQuantity: item.systemQuantity,
      physicalQuantity: item.physicalQuantity ?? 0,
      discrepancyQuantity: item.discrepancyQuantity,
      reason: item.reason || 'None provided',
      isAdjusted: item.isAdjusted ? 'Yes' : 'No',
      conductedBy: item.stockAudit.conductedBy.name,
      approvedBy: item.stockAudit.approvedBy?.name || 'Pending Approval',
    }));
  }

  static async exportAuditDiscrepanciesCSV() {
    const data = await this.getAuditDiscrepanciesReport();
    return generateCSV(data, [
      { key: 'auditNumber', label: 'Audit #' },
      { key: 'auditStatus', label: 'Status' },
      { key: 'warehouseCode', label: 'Warehouse' },
      { key: 'sku', label: 'SKU' },
      { key: 'productName', label: 'Product Name' },
      { key: 'systemQuantity', label: 'System Qty' },
      { key: 'physicalQuantity', label: 'Physical Qty' },
      { key: 'discrepancyQuantity', label: 'Discrepancy' },
      { key: 'reason', label: 'Reason' },
      { key: 'isAdjusted', label: 'Adjusted' },
      { key: 'conductedBy', label: 'Conducted By' },
      { key: 'approvedBy', label: 'Approved By' },
    ]);
  }
}
