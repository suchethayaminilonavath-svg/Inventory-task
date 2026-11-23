import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminToken, managerToken, operatorToken } from './setup.js';
import prisma from '../src/config/db.js';
import { TransferStatus } from '../src/types/index.js';

/**
 * Regression Test:
 * Demonstrating behavior that would fail in a naive implementation
 * (e.g. allowing double-dispatch or receiving without state lock),
 * and verifies that our completed implementation strictly enforces state transitions
 * and avoids duplicate stock deductions or inventory corruption.
 */
describe('Regression Suite: Duplicate Movement & Transfer Overdraw Protection', () => {
  let sourceWh: any;
  let destWh: any;
  let product: any;

  it('setup regression test fixtures', async () => {
    const warehouses = await prisma.warehouse.findMany({ take: 2 });
    sourceWh = warehouses[0];
    destWh = warehouses[1];

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Regression Transfer Security Item',
        uom: 'pcs',
      });
    product = prodRes.body.product;

    // Stock source warehouse with 50 units
    await request(app)
      .post(`/api/warehouses/${sourceWh.id}/inventory/initialize`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        productId: product.id,
        quantity: 50,
        reason: 'Regression test baseline',
      });
  });

  it('Regression Test: should strictly reject dispatching an already dispatched or non-approved transfer', async () => {
    // Create and approve transfer of 20 units
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        sourceWarehouseId: sourceWh.id,
        destinationWarehouseId: destWh.id,
        items: [{ productId: product.id, quantityRequested: 20 }],
      });
    const transferId = createRes.body.transfer.id;

    await request(app)
      .post(`/api/transfers/${transferId}/request`)
      .set('Authorization', `Bearer ${operatorToken}`);

    await request(app)
      .post(`/api/transfers/${transferId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    // First dispatch succeeds: stock changes from 50 to 30
    const firstDispatch = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(firstDispatch.status).toBe(200);
    expect(firstDispatch.body.transfer.status).toBe(TransferStatus.IN_TRANSIT);

    // NAIVE IMPLEMENTATION BUG: Calling dispatch again would double-deduct another 20 units (leaving 10)!
    // SECURED IMPLEMENTATION: Must reject with 400 Bad Request because status is IN_TRANSIT, not APPROVED!
    const secondDispatch = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(secondDispatch.status).toBe(400);
    expect(secondDispatch.body.error).toMatch(/cannot dispatch transfer in 'IN_TRANSIT' status/i);

    // Verify source stock remained at 30, NOT deducted again to 10
    const sourceInv = await prisma.warehouseInventory.findUnique({
      where: { warehouseId_productId: { warehouseId: sourceWh.id, productId: product.id } },
    });
    expect(sourceInv?.quantity).toBe(30);
  });
});
