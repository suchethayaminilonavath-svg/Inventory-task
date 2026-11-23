# StockPilot Database Schema Documentation

StockPilot uses **Prisma ORM** with a schema supporting both PostgreSQL (production) and SQLite (isolated zero-credential testing and local development).

---

## Entity Relationship Overview

```
 [Category] 1 ---- * [Product] * ---- 1 [WarehouseInventory] 1 ---- 1 [Warehouse]
                         |                          |
                         |                          |
           +-------------+-------------+            |
           |             |             |            |
           *             *             *            *
    [SupplierProduct] [POItem]  [TransferItem] [Movement]
           *             |             |            |
           |             |             |            |
           1             1             1            1
      [Supplier]   [PurchaseOrder] [Transfer]   [User]
                         |             |            |
                         *             *            *
                      [AuditLog]   [StockAudit] [AuditItem]
```

---

## Models Description

### 1. User
Represents system actors and controls access via Role-Based Access Control (RBAC).
- `id` (UUID, PK): Unique identifier.
- `email` (String, Unique): User email address.
- `passwordHash` (String): Salted bcrypt password hash.
- `name` (String): Full name.
- `role` (String): One of `ADMIN`, `WAREHOUSE_MANAGER`, `INVENTORY_OPERATOR`, `AUDITOR`.
- `isActive` (Boolean): Active status flag.
- `createdAt`, `updatedAt` (DateTime).

### 2. Category
Organizes products in the catalog.
- `id` (UUID, PK): Unique identifier.
- `name` (String, Unique): Category name.
- `description` (String, Optional): Category summary.
- `createdAt`, `updatedAt` (DateTime).

### 3. Product
Central item catalog record.
- `id` (UUID, PK): Unique identifier.
- `sku` (String, Unique, Indexed): Unique Stock Keeping Unit (e.g., `ELEC-MCU-32`).
- `name` (String): Product name.
- `description` (String, Optional): Product specifications.
- `categoryId` (UUID, FK, Optional): Foreign key to `Category`.
- `uom` (String): Unit of measurement (`units`, `pcs`, `box`, `kg`, etc.).
- `minStockThreshold` (Int): Minimum stock warning threshold (default: 10).
- `isArchived` (Boolean): Soft delete / archive flag (default: false).
- `createdAt`, `updatedAt` (DateTime).

### 4. Warehouse
Physical inventory locations and fulfillment centers.
- `id` (UUID, PK): Unique identifier.
- `code` (String, Unique, Indexed): Short warehouse code (e.g., `WH-CENTRAL`).
- `name` (String): Facility name.
- `address`, `city`, `state`, `country`, `postalCode` (Strings): Physical address.
- `contactName`, `contactEmail`, `contactPhone` (Strings, Optional): Facility manager details.
- `isActive` (Boolean): Operational status flag.
- `createdAt`, `updatedAt` (DateTime).

### 5. WarehouseInventory
Current stock level for a specific product inside a specific warehouse.
- `id` (UUID, PK): Unique identifier.
- `warehouseId` (UUID, FK): Foreign key to `Warehouse`.
- `productId` (UUID, FK): Foreign key to `Product`.
- `quantity` (Int): Current in-stock quantity (enforced non-negative by movement engine).
- `minThreshold` (Int): Location-specific threshold.
- `updatedAt` (DateTime).
- **Unique Constraint**: `@@unique([warehouseId, productId])` prevents duplicate inventory rows for the same SKU at the same facility.

### 6. Supplier
Vendor entities providing products.
- `id` (UUID, PK): Unique identifier.
- `name` (String): Vendor company name.
- `code` (String, Unique, Indexed): Vendor code (e.g., `SUP-APEX`).
- `contactName`, `email`, `phone`, `address` (Strings, Optional).
- `status` (String): `ACTIVE` or `INACTIVE`.
- `createdAt`, `updatedAt` (DateTime).

### 7. SupplierProduct
Vendor price list and lead times for catalog products.
- `id` (UUID, PK): Unique identifier.
- `supplierId` (UUID, FK): Foreign key to `Supplier`.
- `productId` (UUID, FK): Foreign key to `Product`.
- `supplierSku` (String, Optional): Vendor's part number.
- `leadTimeDays` (Int): Expected delivery lead time in days.
- `costPrice` (Float): Cost per unit from this supplier.
- `createdAt` (DateTime).
- **Unique Constraint**: `@@unique([supplierId, productId])`.

### 8. PurchaseOrder
Procurement orders placed with suppliers for intake at a warehouse.
- `id` (UUID, PK): Unique identifier.
- `orderNumber` (String, Unique, Indexed): Human-readable PO number (e.g., `PO-839201-102`).
- `supplierId` (UUID, FK): Foreign key to `Supplier`.
- `warehouseId` (UUID, FK): Receiving warehouse.
- `status` (String, Indexed): `DRAFT`, `SUBMITTED`, `APPROVED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `REJECTED`, `CANCELLED`.
- `subtotal`, `tax`, `total` (Float): Financial calculations.
- `notes` (String, Optional).
- `createdById` (UUID, FK): User who drafted/submitted the PO.
- `approvedById` (UUID, FK, Optional): Manager who approved/rejected the PO.
- `createdAt`, `updatedAt` (DateTime).

### 9. PurchaseOrderItem
Individual line items in a purchase order.
- `id` (UUID, PK): Unique identifier.
- `purchaseOrderId` (UUID, FK): Foreign key to `PurchaseOrder`.
- `productId` (UUID, FK): Foreign key to `Product`.
- `quantity` (Int): Ordered quantity.
- `unitPrice` (Float): Unit price at time of order.
- `subtotal` (Float): `quantity * unitPrice`.
- `receivedQuantity` (Int): Cumulative units received so far (default: 0).

### 10. StockTransfer
Inter-warehouse inventory relocation.
- `id` (UUID, PK): Unique identifier.
- `transferNumber` (String, Unique, Indexed): Transfer code (e.g., `TRF-481920-301`).
- `sourceWarehouseId` (UUID, FK): Origin warehouse (stock deducted).
- `destinationWarehouseId` (UUID, FK): Destination warehouse (stock credited).
- `status` (String, Indexed): `DRAFT`, `REQUESTED`, `APPROVED`, `IN_TRANSIT`, `RECEIVED`, `REJECTED`, `CANCELLED`.
- `requestedById` (UUID, FK): Operator/Manager requesting transfer.
- `approvedById` (UUID, FK, Optional): Manager approving transfer.
- `notes` (String, Optional).
- `createdAt`, `updatedAt` (DateTime).

### 11. StockTransferItem
Line items for a stock transfer.
- `id` (UUID, PK): Unique identifier.
- `stockTransferId` (UUID, FK): Foreign key to `StockTransfer`.
- `productId` (UUID, FK): Foreign key to `Product`.
- `quantityRequested` (Int): Quantity intended to move.
- `quantityTransferred` (Int): Quantity actually dispatched and received.

### 12. InventoryMovement
**Central Append-Only Audit Ledger.** Every change in physical stock is recorded here. Historical rows are never edited or overwritten.
- `id` (UUID, PK): Unique identifier.
- `productId` (UUID, FK, Indexed): Affected product.
- `warehouseId` (UUID, FK, Indexed): Affected warehouse.
- `movementType` (String, Indexed): `STOCK_RECEIVED`, `STOCK_ISSUED`, `TRANSFER_OUT`, `TRANSFER_IN`, `MANUAL_ADJUSTMENT`, `DAMAGED_STOCK`, `RETURNED_STOCK`.
- `quantity` (Int): Delta quantity (+ for credits, - for debits).
- `previousBalance` (Int): Stock balance prior to this movement.
- `newBalance` (Int): Stock balance resulting from this movement (`previousBalance + quantity === newBalance`).
- `referenceId` (String, Optional, Indexed): PO ID, Transfer ID, Audit ID, or manual reference.
- `referenceType` (String, Optional): `PURCHASE_ORDER`, `TRANSFER`, `AUDIT`, `MANUAL`.
- `userId` (UUID, FK, Optional): Actor who initiated the change.
- `timestamp` (DateTime, Indexed): Accurate movement execution time.
- `reason` (String): Explanatory note or audit justification.

### 13. StockAudit
Physical inventory audit session.
- `id` (UUID, PK): Unique identifier.
- `auditNumber` (String, Unique, Indexed): Audit code (e.g., `AUD-910283-401`).
- `warehouseId` (UUID, FK, Indexed): Audited facility.
- `status` (String, Indexed): `DRAFT`, `IN_PROGRESS`, `SUBMITTED`, `APPROVED`, `REJECTED`.
- `conductedById` (UUID, FK): User conducting physical count.
- `approvedById` (UUID, FK, Optional): Manager who reconciles/approves adjustments.
- `notes` (String, Optional).
- `conductedAt` (DateTime, Optional).
- `createdAt`, `updatedAt` (DateTime).

### 14. StockAuditItem
Physical count vs system snapshot comparisons.
- `id` (UUID, PK): Unique identifier.
- `stockAuditId` (UUID, FK): Foreign key to `StockAudit`.
- `productId` (UUID, FK): Audited product.
- `systemQuantity` (Int): Frozen system balance at audit creation time.
- `physicalQuantity` (Int, Optional): Count entered by auditor.
- `discrepancyQuantity` (Int): `physicalQuantity - systemQuantity`.
- `reason` (String, Optional): Mandatory explanation when discrepancy != 0.
- `isAdjusted` (Boolean): Flag set true when approved and adjusted via MovementService.
- **Unique Constraint**: `@@unique([stockAuditId, productId])`.

### 15. AuditLog
System-wide security and mutation log.
- `id` (UUID, PK): Unique identifier.
- `entityType` (String): `PRODUCT`, `WAREHOUSE`, `PO`, `TRANSFER`, `AUDIT`, `USER`.
- `entityId` (String): ID of affected record.
- `action` (String): `CREATE`, `UPDATE`, `ARCHIVE`, `STATUS_CHANGE`.
- `userId` (UUID, FK, Optional): User who performed the action.
- `details` (String, Optional): JSON payload of metadata.
- `timestamp` (DateTime, Indexed).
