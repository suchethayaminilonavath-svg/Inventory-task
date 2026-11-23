export type Role = 'ADMIN' | 'WAREHOUSE_MANAGER' | 'INVENTORY_OPERATOR' | 'AUDITOR';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  _count?: { products: number };
}

export interface WarehouseInventory {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  minThreshold: number;
  warehouse?: Warehouse;
  product?: Product;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  category?: Category | null;
  uom: string;
  minStockThreshold: number;
  isArchived: boolean;
  totalStock?: number;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  warehouseInventories?: WarehouseInventory[];
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  skuCount?: number;
  totalUnits?: number;
  lowStockCount?: number;
  inventories?: WarehouseInventory[];
  createdAt: string;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;
  supplierSku?: string;
  leadTimeDays: number;
  costPrice: number;
  product?: Product;
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
  _count?: { supplierProducts: number; purchaseOrders: number };
  supplierProducts?: SupplierProduct[];
  purchaseOrders?: PurchaseOrder[];
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  receivedQuantity: number;
  product?: Product;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  warehouseId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  createdById: string;
  approvedById?: string;
  supplier: Supplier;
  warehouse: Warehouse;
  createdBy: User;
  approvedBy?: User;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferItem {
  id: string;
  stockTransferId: string;
  productId: string;
  quantityRequested: number;
  quantityTransferred: number;
  product?: Product;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  status: 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
  requestedById: string;
  approvedById?: string;
  notes?: string;
  sourceWarehouse: Warehouse;
  destinationWarehouse: Warehouse;
  requestedBy: User;
  approvedBy?: User;
  items: StockTransferItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  warehouseId: string;
  movementType: 'STOCK_RECEIVED' | 'STOCK_ISSUED' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'MANUAL_ADJUSTMENT' | 'DAMAGED_STOCK' | 'RETURNED_STOCK';
  quantity: number;
  previousBalance: number;
  newBalance: number;
  referenceId?: string;
  referenceType?: string;
  userId?: string;
  timestamp: string;
  reason: string;
  product?: { id: string; sku: string; name: string; uom: string };
  warehouse?: { id: string; code: string; name: string };
  user?: { id: string; name: string; email: string };
}

export interface StockAuditItem {
  id: string;
  stockAuditId: string;
  productId: string;
  systemQuantity: number;
  physicalQuantity: number | null;
  discrepancyQuantity: number;
  reason?: string;
  isAdjusted: boolean;
  product?: Product;
}

export interface StockAudit {
  id: string;
  auditNumber: string;
  warehouseId: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  conductedById: string;
  approvedById?: string;
  notes?: string;
  conductedAt?: string;
  warehouse: Warehouse;
  conductedBy: User;
  approvedBy?: User;
  items: StockAuditItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMetrics {
  totalProducts: number;
  totalWarehouses: number;
  totalInventoryQuantity: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  pendingPurchaseOrders: number;
  pendingWarehouseTransfers: number;
  recentMovements: InventoryMovement[];
}
