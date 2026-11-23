# StockPilot REST API Documentation

All API endpoints are prefixed with `/api`. Protected routes require a Bearer token in the `Authorization` header:
`Authorization: Bearer <jwt_token>`

---

## 1. Authentication (`/api/auth`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a new user account |
| `POST` | `/api/auth/login` | Public | Login with email and password |
| `POST` | `/api/auth/logout` | Authenticated | Logout session |
| `GET` | `/api/auth/me` | Authenticated | Get current authenticated user profile |

---

## 2. Product Management (`/api/products`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/products` | All Roles | List products with pagination, search, category filter |
| `GET` | `/api/products/:id` | All Roles | Get product details with multi-warehouse inventory |
| `POST` | `/api/products` | Admin, Manager | Create product with unique SKU validation |
| `PUT` | `/api/products/:id` | Admin, Manager | Update product attributes |
| `DELETE` | `/api/products/:id` | Admin, Manager | Archive product |
| `GET` | `/api/products/export/csv` | All Roles | Download product catalog as CSV |
| `POST` | `/api/products/import/csv` | Admin, Manager | Bulk import products from CSV |

---

## 3. Warehouse Management (`/api/warehouses`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/warehouses` | All Roles | List all active warehouses with unit & SKU counts |
| `GET` | `/api/warehouses/:id` | All Roles | Get warehouse details and stock |
| `GET` | `/api/warehouses/:id/inventory` | All Roles | Get warehouse-specific stock levels |
| `POST` | `/api/warehouses` | Admin, Manager | Create new warehouse |
| `PUT` | `/api/warehouses/:id` | Admin, Manager | Update warehouse contact / address info |
| `POST` | `/api/warehouses/:id/inventory/initialize` | Admin, Manager, Operator | Record initial stock intake via MovementService |

---

## 4. Supplier Management (`/api/suppliers`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/suppliers` | All Roles | List suppliers with search and status filter |
| `GET` | `/api/suppliers/:id` | All Roles | Get supplier details and active catalog |
| `GET` | `/api/suppliers/:id/purchase-history` | All Roles | Get procurement history for supplier |
| `POST` | `/api/suppliers` | Admin, Manager | Register new supplier |
| `PUT` | `/api/suppliers/:id` | Admin, Manager | Update supplier details |
| `POST` | `/api/suppliers/:id/products` | Admin, Manager | Map catalog product with cost price and lead time |

---

## 5. Purchase Order Management (`/api/purchase-orders`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/purchase-orders` | All Roles | List purchase orders with status filtering |
| `GET` | `/api/purchase-orders/:id` | All Roles | Get purchase order details and line items |
| `POST` | `/api/purchase-orders` | Admin, Manager, Operator | Create purchase order in DRAFT status |
| `POST` | `/api/purchase-orders/:id/submit` | Admin, Manager, Operator | Transition PO from DRAFT → SUBMITTED |
| `POST` | `/api/purchase-orders/:id/approve` | Admin, Manager | Approve PO (SUBMITTED → APPROVED) |
| `POST` | `/api/purchase-orders/:id/reject` | Admin, Manager | Reject PO (SUBMITTED → REJECTED) |
| `POST` | `/api/purchase-orders/:id/cancel` | Admin, Manager | Cancel PO |
| `POST` | `/api/purchase-orders/:id/receive` | Admin, Manager, Operator | Receive delivery (partial or complete) |

---

## 6. Stock Transfers (`/api/transfers`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/transfers` | All Roles | List stock transfers with status filtering |
| `GET` | `/api/transfers/:id` | All Roles | Get transfer details |
| `POST` | `/api/transfers` | Admin, Manager, Operator | Create transfer in DRAFT status |
| `POST` | `/api/transfers/:id/request` | Admin, Manager, Operator | Request approval (DRAFT → REQUESTED) |
| `POST` | `/api/transfers/:id/approve` | Admin, Manager | Approve transfer (REQUESTED → APPROVED) |
| `POST` | `/api/transfers/:id/dispatch` | Admin, Manager, Operator | Dispatch goods (APPROVED → IN_TRANSIT, deducts stock) |
| `POST` | `/api/transfers/:id/receive` | Admin, Manager, Operator | Receive goods (IN_TRANSIT → RECEIVED, credits stock) |
| `POST` | `/api/transfers/:id/reject` | Admin, Manager | Reject transfer |
| `POST` | `/api/transfers/:id/cancel` | Admin, Manager | Cancel transfer (refunds in-transit stock) |

---

## 7. Inventory Movement Engine (`/api/movements`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/movements` | All Roles | Query append-only movement ledger with pagination |
| `POST` | `/api/movements/manual` | Admin, Manager, Operator | Record atomic manual stock adjustment/issuance |

---

## 8. Stock Audit & Reconciliation (`/api/audits`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/audits` | All Roles | List stock audit sessions |
| `GET` | `/api/audits/:id` | All Roles | Get audit session details and count items |
| `POST` | `/api/audits` | Admin, Manager, Operator | Create new audit session with snapshot stock |
| `POST` | `/api/audits/:id/counts` | Admin, Manager, Operator | Record physical counts and required discrepancy reasons |
| `POST` | `/api/audits/:id/submit` | Admin, Manager, Operator | Submit audit for review (IN_PROGRESS → SUBMITTED) |
| `POST` | `/api/audits/:id/approve` | Admin, Manager | Approve audit and reconcile warehouse balances |
| `POST` | `/api/audits/:id/reject` | Admin, Manager | Reject audit |

---

## 9. Reports & Analytics (`/api/reports`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/reports/dashboard` | All Roles | Get live operational KPI metrics |
| `GET` | `/api/reports/valuation` | All Roles | Stock valuation report with unit costs |
| `GET` | `/api/reports/valuation/csv` | All Roles | Export valuation report to CSV |
| `GET` | `/api/reports/low-stock` | All Roles | Low stock deficit report |
| `GET` | `/api/reports/low-stock/csv` | All Roles | Export low stock report to CSV |
| `GET` | `/api/reports/warehouse-stock` | All Roles | Warehouse distribution report |
| `GET` | `/api/reports/movements/csv` | All Roles | Export inventory ledger to CSV |
| `GET` | `/api/reports/audit-discrepancies` | All Roles | Audit discrepancy report |
| `GET` | `/api/reports/audit-discrepancies/csv`| All Roles | Export audit discrepancies to CSV |
