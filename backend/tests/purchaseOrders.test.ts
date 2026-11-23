import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminToken, managerToken, operatorToken } from './setup.js';
import prisma from '../src/config/db.js';
import { PurchaseOrderStatus } from '../src/types/index.js';

describe('Purchase Order Management Tests', () => {
  let supplier: any;
  let warehouse: any;
  let productA: any;
  let productB: any;
  let poId: string;

  it('setup PO fixtures', async () => {
    supplier = await prisma.supplier.findFirst({ where: { status: 'ACTIVE' } });
    warehouse = await prisma.warehouse.findFirst({ where: { isActive: true } });

    const pA = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'PO Test Product Alpha', uom: 'pcs' });
    productA = pA.body.product;

    const pB = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'PO Test Product Beta', uom: 'pcs' });
    productB = pB.body.product;
  });

  // Test 11: Partial purchase order receiving
  it('11. should handle partial purchase order receiving without duplicating quantities', async () => {
    // 1. Create PO: 100 of productA, 50 of productB
    const createRes = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        taxRate: 0.05,
        items: [
          { productId: productA.id, quantity: 100, unitPrice: 10.0 },
          { productId: productB.id, quantity: 50, unitPrice: 20.0 },
        ],
      });

    expect(createRes.status).toBe(201);
    poId = createRes.body.purchaseOrder.id;
    expect(createRes.body.purchaseOrder.subtotal).toBe(2000.0);
    expect(createRes.body.purchaseOrder.total).toBe(2100.0);

    // 2. Submit PO (DRAFT -> SUBMITTED)
    await request(app)
      .post(`/api/purchase-orders/${poId}/submit`)
      .set('Authorization', `Bearer ${operatorToken}`);

    // 3. Approve PO (SUBMITTED -> APPROVED)
    await request(app)
      .post(`/api/purchase-orders/${poId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    // 4. Partial receipt: Receive 40 of productA (out of 100)
    const partRes = await request(app)
      .post(`/api/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        items: [{ productId: productA.id, quantityReceived: 40 }],
      });

    expect(partRes.status).toBe(200);
    expect(partRes.body.purchaseOrder.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);

    // Verify productA received quantity is 40
    const itemA = partRes.body.purchaseOrder.items.find((i: any) => i.productId === productA.id);
    expect(itemA.receivedQuantity).toBe(40);

    // Verify warehouse stock increased by 40
    const invA = await prisma.warehouseInventory.findUnique({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: productA.id } },
    });
    expect(invA?.quantity).toBe(40);

    // 5. Complete receipt: Receive remaining 60 of productA and 50 of productB
    const compRes = await request(app)
      .post(`/api/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        items: [
          { productId: productA.id, quantityReceived: 60 },
          { productId: productB.id, quantityReceived: 50 },
        ],
      });

    expect(compRes.status).toBe(200);
    expect(compRes.body.purchaseOrder.status).toBe(PurchaseOrderStatus.RECEIVED);

    // Verify inventory balances: productA = 100, productB = 50
    const [finalInvA, finalInvB] = await Promise.all([
      prisma.warehouseInventory.findUnique({
        where: { warehouseId_productId: { warehouseId: warehouse.id, productId: productA.id } },
      }),
      prisma.warehouseInventory.findUnique({
        where: { warehouseId_productId: { warehouseId: warehouse.id, productId: productB.id } },
      }),
    ]);

    expect(finalInvA?.quantity).toBe(100);
    expect(finalInvB?.quantity).toBe(50);
  });

  // Test 12: Purchase order cancellation
  it('12. should handle purchase order cancellation and prevent receiving goods on cancelled orders', async () => {
    // 1. Create and approve a new PO
    const createRes = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        items: [{ productId: productA.id, quantity: 25, unitPrice: 10.0 }],
      });

    const cancelPoId = createRes.body.purchaseOrder.id;

    // 2. Cancel order
    const cancelRes = await request(app)
      .post(`/api/purchase-orders/${cancelPoId}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Supplier out of raw materials' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.purchaseOrder.status).toBe(PurchaseOrderStatus.CANCELLED);

    // 3. Attempt to receive goods on the cancelled order -> must fail
    const receiveRes = await request(app)
      .post(`/api/purchase-orders/${cancelPoId}/receive`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        items: [{ productId: productA.id, quantityReceived: 25 }],
      });

    expect(receiveRes.status).toBe(400);
    expect(receiveRes.body.error).toMatch(/cannot receive goods|must be approved/i);
  });
});
