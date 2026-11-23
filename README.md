# StockPilot – Smart Inventory and Warehouse Management Platform

StockPilot is a production-grade inventory and warehouse management platform built with React, TypeScript, Vite, Tailwind CSS, Node.js, Express, and Prisma ORM.

StockPilot empowers businesses to manage multi-warehouse operations, catalog products with unique SKU enforcement, supplier procurement, multi-step inter-warehouse stock transfers, purchase orders with partial deliveries, append-only inventory movement ledgers, and physical stock count audit reconciliations.

---

## 1. Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons
- **Backend**: Node.js, Express.js, TypeScript, REST APIs, Zod validation, JWT authentication, bcryptjs
- **Database**: Prisma ORM with SQLite (for isolated zero-credential local testing & dev) and PostgreSQL (for production deployments)
- **Testing**: Vitest, Supertest (complete automated test suite)

---

## 2. Core Capabilities & Workflows

### Multi-Warehouse Transfer Workflow
```
Draft ──> Requested ──> Approved ──> In Transit ──> Received
  │           │           │
  └── Cancelled / Rejected ─┘
```
- Deducts stock from origin facility strictly upon **Dispatch (In Transit)**.
- Credits destination stock strictly upon **Receive**.
- State machine prevents duplicate deductions or double receiving.
- Restores stock if cancelled in transit.

### Purchase Order Workflow
```
Draft ──> Submitted ──> Approved ──> Partially Received ──> Received
  │           │           │
  └── Cancelled / Rejected ─┘
```
- Supports partial receiving with individual line item tracking.
- Prevents receiving more than the remaining pending balance.
- Updates warehouse inventory via the central movement engine.

### Centralized Inventory Movement Ledger
- **Append-only ledger** maintaining `previousBalance`, `newBalance`, `quantity`, `referenceId`, `userId`, `timestamp`, and `reason`.
- ACID transaction boundaries and concurrency protection preventing negative balances or balance corruptions.

### Stock Audit & Reconciliation
- Snapshot system quantities when an audit session is created.
- Physical count recording with automated discrepancy calculations.
- Enforces mandatory justification reasons whenever discrepancies exist.
- Balances are updated via the movement engine **only when approved** by an Administrator or Warehouse Manager.

### Role-Based Access Control (RBAC)
- **Administrator**: Full privileges over catalog, warehouses, settings, and workflows.
- **Warehouse Manager**: Manages facilities, approves transfers, purchase orders, and stock audits.
- **Inventory Operator**: Dispatches/receives transfers, intakes PO shipments, enters physical audit counts.
- **Read-only Auditor**: Read-only access to ledger, stock valuation, low-stock reports, and CSV downloads.

---

## 3. Pre-Seeded Demo User Accounts

All pre-seeded demo accounts share the password: `password123`

| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Administrator** | `admin@stockpilot.io` | `password123` | Full access to all operations |
| **Warehouse Manager** | `manager@stockpilot.io` | `password123` | Transfer, PO & Audit approvals |
| **Inventory Operator** | `operator@stockpilot.io` | `password123` | Dispatches, receipts, physical counts |
| **Auditor** | `auditor@stockpilot.io` | `password123` | Read-only ledger, valuation, CSV exports |

*The web UI also provides a 1-click **"Instant Demo Sign-In"** and top-bar **"Switch Demo Role"** switcher to test different roles effortlessly without manual typing.*

---

## 4. Installation & Quick Start

### Prerequisites
- Node.js (v20+ recommended)
- npm (v10+)

### Step 1: Install Dependencies
```bash
# Install root & backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Step 2: Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```
Default `.env` settings:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="file:./stockpilot.db"
JWT_SECRET=stockpilot-dev-jwt-secret-key-32chars-min
JWT_EXPIRES_IN=24h
CLIENT_URL=http://localhost:5173
```

### Step 3: Database Setup & Seeding
```bash
# Generate Prisma Client, apply schema, and seed initial demo data
npm run setup
```
Or run individual commands:
```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

---

## 5. Running the Application

### Development Mode

Run backend and frontend:
```bash
# Terminal 1: Backend Server (runs on http://localhost:4000)
npm run dev

# Terminal 2: Frontend App (runs on http://localhost:5173)
cd frontend
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## 6. Running Automated Tests

To execute the complete automated test suite (all 16 required test cases + regression tests):

```bash
npm test
```

### Verified Test Suites
1. **Product creation** (`backend/tests/products.test.ts`)
2. **Duplicate SKU rejection** (`backend/tests/products.test.ts`)
3. **Warehouse creation** (`backend/tests/warehouses.test.ts`)
4. **Inventory initialization** (`backend/tests/warehouses.test.ts`)
5. **Stock receiving** (`backend/tests/movements.test.ts`)
6. **Stock issuance** (`backend/tests/movements.test.ts`)
7. **Insufficient stock rejection** (`backend/tests/movements.test.ts`)
8. **Concurrent stock updates** (`backend/tests/movements.test.ts`)
9. **Warehouse transfers workflow** (`backend/tests/transfers.test.ts`)
10. **Duplicate transfer prevention** (`backend/tests/transfers.test.ts`)
11. **Partial purchase order receiving** (`backend/tests/purchaseOrders.test.ts`)
12. **Purchase order cancellation** (`backend/tests/purchaseOrders.test.ts`)
13. **Stock audit discrepancies & adjustments** (`backend/tests/stockAudit.test.ts`)
14. **Unauthorized inventory operations / RBAC** (`backend/tests/rbac.test.ts`)
15. **Inventory ledger integrity** (`backend/tests/movements.test.ts`)
16. **CSV report generation** (`backend/tests/reports.test.ts`)
17. **Regression Protection Suite** (`backend/tests/regression.test.ts`)

---

## 7. PostgreSQL Production Configuration

For production deployment with PostgreSQL:
1. Update your `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/stockpilot?schema=public"
   ```
2. Replace `prisma/schema.prisma` with `prisma/schema.postgresql.prisma` or change the provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Run migrations:
   ```bash
   npx prisma migrate dev --name init
   ```

---

## 8. Documentation Links
- [Database Schema Documentation](docs/DATABASE.md)
- [REST API Documentation](docs/API.md)

---

## 9. Security Notice
- No hardcoded API keys, tokens, or plaintext passwords are committed to the repository.
- Sensitive environment variables are stored in `.env` (ignored by git).
- Passwords are encrypted with bcrypt (10 rounds).
- Endpoints are protected by JWT authentication and granular RBAC authorization guards.
