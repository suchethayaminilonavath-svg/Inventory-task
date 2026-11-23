import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminToken, managerToken, operatorToken } from './setup.js';
import prisma from '../src/config/db.js';
import { StockAuditStatus } from '../src/types/index.js';

describe('Stock Audit and Reconciliation Tests', () => {
  let warehouse: any;
  let product: any;
  let auditId: string;

  it('setup stock audit fixtures', async () => {
    warehouse = await prisma.warehouse.findFirst({ where: { isActive: true } });

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Audit Calibration Component',
        uom: 'units',
        minStockThreshold: 10,
      });
    product = prodRes.body.product;

    // Initialize system stock with 50 units
    await request(app)
      .post(`/api/warehouses/${warehouse.id}/inventory/initialize`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        productId: product.id,
        quantity: 50,
        reason: 'Pre-audit baseline',
      });
  });

  // Test 13: Stock audit discrepancies
  it('13. should identify discrepancies, require reasons, and apply adjustments only when approved', async () => {
    // 1. Create audit session for this warehouse & product
    const createRes = await request(app)
      .post('/api/audits')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        warehouseId: warehouse.id,
        productIds: [product.id],
        notes: 'Monthly physical inventory count audit',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.audit.status).toBe(StockAuditStatus.DRAFT);
    auditId = createRes.body.audit.id;

    // Verify snapshot system quantity is 50
    const auditItem = createRes.body.audit.items.find((i: any) => i.productId === product.id);
    expect(auditItem.systemQuantity).toBe(50);

    // 2. Operator enters physical count: 42 (Discrepancy: -8). Missing reason must be rejected!
    const noReasonRes = await request(app)
      .post(`/api/audits/${auditId}/counts`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        counts: [{ productId: product.id, physicalQuantity: 42 }],
      });

    expect(noReasonRes.status).toBe(400);
    expect(noReasonRes.body.error).toMatch(/reason is required/i);

    // 3. Operator enters physical count with reason: 42 (discrepancy: -8, reason: "Water damage during roof leak")
    const countRes = await request(app)
      .post(`/api/audits/${auditId}/counts`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        counts: [
          {
            productId: product.id,
            physicalQuantity: 42,
            reason: 'Water damage during roof leak',
          },
        ],
      });

    expect(countRes.status).toBe(200);
    const updatedItem = countRes.body.audit.items.find((i: any) => i.productId === product.id);
    expect(updatedItem.discrepancyQuantity).toBe(-8);
    expect(updatedItem.isAdjusted).toBe(false);

    // CRITICAL: Stock in warehouse must STILL be 50 (unapproved audits do not alter stock!)
    const stockBeforeApprove = await prisma.warehouseInventory.findUnique({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
    });
    expect(stockBeforeApprove?.quantity).toBe(50);

    // 4. Operator submits audit (IN_PROGRESS -> SUBMITTED)
    const submitRes = await request(app)
      .post(`/api/audits/${auditId}/submit`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.audit.status).toBe(StockAuditStatus.SUBMITTED);

    // 5. Manager approves audit (SUBMITTED -> APPROVED)
    const approveRes = await request(app)
      .post(`/api/audits/${auditId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.audit.status).toBe(StockAuditStatus.APPROVED);

    // Now, warehouse inventory balance MUST be updated to 42 via movement engine!
    const stockAfterApprove = await prisma.warehouseInventory.findUnique({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
    });
    expect(stockAfterApprove?.quantity).toBe(42);

    // Verify movement entry was recorded in ledger
    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        referenceId: auditId,
        referenceType: 'AUDIT',
      },
    });
    expect(movement).toBeDefined();
    expect(movement?.quantity).toBe(-8);
    expect(movement?.newBalance).toBe(42);
  });
});
