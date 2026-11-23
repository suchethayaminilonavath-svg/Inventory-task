import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminToken, operatorToken } from './setup.js';
import prisma from '../src/config/db.js';
import { MovementService } from '../src/services/movementService.js';
import { MovementType } from '../src/types/index.js';

describe('Inventory Movement Engine & Concurrency Tests', () => {
  let warehouse: any;
  let product: any;

  it('setup test warehouse and product', async () => {
    warehouse = await prisma.warehouse.findFirst({ where: { isActive: true } });
    expect(warehouse).toBeDefined();

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Movement Engine Calibration Unit',
        uom: 'pcs',
        minStockThreshold: 15,
      });
    product = prodRes.body.product;
    expect(product).toBeDefined();
  });

  // Test 5: Stock receiving
  it('5. should record stock receiving and update balance', async () => {
    const res = await request(app)
      .post('/api/movements/manual')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        productId: product.id,
        warehouseId: warehouse.id,
        movementType: MovementType.STOCK_RECEIVED,
        quantity: 100,
        reason: 'Shipment batch incoming',
      });

    expect(res.status).toBe(201);
    expect(res.body.movement).toBeDefined();
    expect(res.body.movement.previousBalance).toBe(0);
    expect(res.body.movement.quantity).toBe(100);
    expect(res.body.movement.newBalance).toBe(100);
    expect(res.body.movement.movementType).toBe(MovementType.STOCK_RECEIVED);
  });

  // Test 6: Stock issuance
  it('6. should record stock issuance and deduct balance correctly', async () => {
    const res = await request(app)
      .post('/api/movements/manual')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        productId: product.id,
        warehouseId: warehouse.id,
        movementType: MovementType.STOCK_ISSUED,
        quantity: 30, // should deduct 30
        reason: 'Issued to production floor',
      });

    expect(res.status).toBe(201);
    expect(res.body.movement.previousBalance).toBe(100);
    expect(res.body.movement.quantity).toBe(-30);
    expect(res.body.movement.newBalance).toBe(70);
  });

  // Test 7: Insufficient stock rejection
  it('7. should reject stock deduction exceeding available inventory with 400 Bad Request', async () => {
    // Current stock is 70. Attempt to deduct 150.
    const res = await request(app)
      .post('/api/movements/manual')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        productId: product.id,
        warehouseId: warehouse.id,
        movementType: MovementType.STOCK_ISSUED,
        quantity: 150,
        reason: 'Excessive dispatch attempt',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient stock/i);

    // Verify balance was untouched
    const inv = await prisma.warehouseInventory.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });
    expect(inv?.quantity).toBe(70);
  });

  // Test 8: Concurrent stock updates
  it('8. should safely handle concurrent stock deductions without causing negative balance or race conditions', async () => {
    // Current balance is 70.
    // Launch 4 concurrent requests trying to deduct 25 each (Total: 100 > 70).
    // Exactly 2 requests of 25 can succeed (2 * 25 = 50, remaining 20).
    // The other 2 requests MUST fail because remaining 20 < 25.
    const promises = [1, 2, 3, 4].map((i) =>
      request(app)
        .post('/api/movements/manual')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          productId: product.id,
          warehouseId: warehouse.id,
          movementType: MovementType.STOCK_ISSUED,
          quantity: 25,
          reason: `Concurrent deduction task #${i}`,
        })
    );

    const responses = await Promise.all(promises);
    const successes = responses.filter((r) => r.status === 201);
    const failures = responses.filter((r) => r.status === 400);

    expect(successes.length).toBe(2);
    expect(failures.length).toBe(2);

    // Final balance must be exactly 70 - 50 = 20
    const inv = await prisma.warehouseInventory.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });
    expect(inv?.quantity).toBe(20);
  });

  // Test 15: Inventory ledger integrity
  it('15. should maintain an accurate, chronological, and auditable inventory ledger', async () => {
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        productId: product.id,
        warehouseId: warehouse.id,
      },
      orderBy: { timestamp: 'asc' },
    });

    expect(movements.length).toBeGreaterThanOrEqual(4);

    // Check ledger mathematical integrity: for every entry, previousBalance + quantity === newBalance
    let runningBalance = 0;
    for (const m of movements) {
      expect(m.previousBalance + m.quantity).toBe(m.newBalance);
      expect(m.previousBalance).toBe(runningBalance);
      runningBalance = m.newBalance;
    }

    expect(runningBalance).toBe(20);
  });
});
