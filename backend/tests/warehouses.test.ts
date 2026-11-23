import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminToken, operatorToken } from './setup.js';

describe('Warehouse Management Tests', () => {
  const uniqueCode = `WH-T${Date.now().toString().slice(-4)}`;
  let warehouseId: string;
  let testProductId: string;

  // Test 3: Warehouse creation
  it('3. should create a warehouse with addresses and contact details', async () => {
    const res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Southwest Logistics Center',
        code: uniqueCode,
        address: '500 Desert Industrial Blvd',
        city: 'Phoenix',
        state: 'AZ',
        country: 'USA',
        postalCode: '85001',
        contactName: 'Carlos Mendez',
        contactEmail: 'phoenix@stockpilot.io',
        contactPhone: '+1-602-555-0199',
      });

    expect(res.status).toBe(201);
    expect(res.body.warehouse).toBeDefined();
    expect(res.body.warehouse.code).toBe(uniqueCode);
    expect(res.body.warehouse.city).toBe('Phoenix');
    expect(res.body.warehouse.isActive).toBe(true);

    warehouseId = res.body.warehouse.id;
  });

  // Test 4: Inventory initialization
  it('4. should initialize stock in the warehouse and record inventory movement', async () => {
    // 1. Create a product first
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Warehouse Stock Intake Test Item',
        uom: 'units',
        minStockThreshold: 20,
      });
    testProductId = prodRes.body.product.id;

    // 2. Initialize inventory in the newly created warehouse
    const res = await request(app)
      .post(`/api/warehouses/${warehouseId}/inventory/initialize`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        productId: testProductId,
        quantity: 150,
        reason: 'Initial warehouse stocking test',
      });

    expect(res.status).toBe(201);
    expect(res.body.movement).toBeDefined();
    expect(res.body.movement.quantity).toBe(150);
    expect(res.body.movement.previousBalance).toBe(0);
    expect(res.body.movement.newBalance).toBe(150);

    // 3. Verify warehouse inventory endpoint returns updated stock
    const invRes = await request(app)
      .get(`/api/warehouses/${warehouseId}/inventory`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(invRes.status).toBe(200);
    const item = invRes.body.inventories.find((i: any) => i.productId === testProductId);
    expect(item).toBeDefined();
    expect(item.quantity).toBe(150);
  });

  it('should view warehouse-specific stock and calculate low-stock status', async () => {
    const res = await request(app)
      .get(`/api/warehouses/${warehouseId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.warehouse.totalUnits).toBeGreaterThanOrEqual(150);
  });
});
