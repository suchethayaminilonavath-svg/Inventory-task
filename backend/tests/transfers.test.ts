import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminToken, managerToken, operatorToken } from './setup.js';
import prisma from '../src/config/db.js';
import { TransferStatus } from '../src/types/index.js';

describe('Warehouse Transfers & State Workflow Tests', () => {
  let sourceWh: any;
  let destWh: any;
  let product: any;
  let transferId: string;

  it('setup transfer test fixtures', async () => {
    const warehouses = await prisma.warehouse.findMany({ take: 2 });
    sourceWh = warehouses[0];
    destWh = warehouses[1];

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Inter-Warehouse Transfer Product',
        uom: 'box',
        minStockThreshold: 10,
      });
    product = prodRes.body.product;

    // Stock source warehouse with 80 units
    await request(app)
      .post(`/api/warehouses/${sourceWh.id}/inventory/initialize`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        productId: product.id,
        quantity: 80,
        reason: 'Transfer testing intake',
      });
  });

  // Test 9: Warehouse transfers workflow
  it('9. should execute the complete transfer workflow: Draft -> Requested -> Approved -> In Transit -> Received', async () => {
    // 1. Create transfer in DRAFT
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        sourceWarehouseId: sourceWh.id,
        destinationWarehouseId: destWh.id,
        notes: 'Transfer 30 boxes from Central to East',
        items: [{ productId: product.id, quantityRequested: 30 }],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.transfer.status).toBe(TransferStatus.DRAFT);
    transferId = createRes.body.transfer.id;

    // 2. Operator requests transfer approval (DRAFT -> REQUESTED)
    const reqRes = await request(app)
      .post(`/api/transfers/${transferId}/request`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(reqRes.status).toBe(200);
    expect(reqRes.body.transfer.status).toBe(TransferStatus.REQUESTED);

    // 3. Manager approves transfer (REQUESTED -> APPROVED)
    const appRes = await request(app)
      .post(`/api/transfers/${transferId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(appRes.status).toBe(200);
    expect(appRes.body.transfer.status).toBe(TransferStatus.APPROVED);

    // 4. Operator dispatches transfer (APPROVED -> IN_TRANSIT)
    // Source inventory should be deducted
    const dispatchRes = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.transfer.status).toBe(TransferStatus.IN_TRANSIT);

    // Check source warehouse stock: 80 - 30 = 50
    const sourceInv = await prisma.warehouseInventory.findUnique({
      where: { warehouseId_productId: { warehouseId: sourceWh.id, productId: product.id } },
    });
    expect(sourceInv?.quantity).toBe(50);

    // 5. Destination warehouse receives transfer (IN_TRANSIT -> RECEIVED)
    // Destination inventory should be credited
    const receiveRes = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.transfer.status).toBe(TransferStatus.RECEIVED);

    // Check destination warehouse stock: 0 + 30 = 30
    const destInv = await prisma.warehouseInventory.findUnique({
      where: { warehouseId_productId: { warehouseId: destWh.id, productId: product.id } },
    });
    expect(destInv?.quantity).toBe(30);
  });

  // Test 10: Duplicate transfer prevention
  it('10. should prevent duplicate receiving of an already received transfer', async () => {
    // Attempt to receive again the already received transfer
    const res = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicate receiving prevented|must be in_transit/i);

    // Verify destination stock did NOT increase again
    const destInv = await prisma.warehouseInventory.findUnique({
      where: { warehouseId_productId: { warehouseId: destWh.id, productId: product.id } },
    });
    expect(destInv?.quantity).toBe(30);
  });

  it('should prevent creating a transfer exceeding available stock', async () => {
    // Current stock in sourceWh is 50. Attempt to transfer 100.
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        sourceWarehouseId: sourceWh.id,
        destinationWarehouseId: destWh.id,
        items: [{ productId: product.id, quantityRequested: 100 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient stock/i);
  });
});
