import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, auditorToken, operatorToken, managerToken } from './setup.js';
import prisma from '../src/config/db.js';

describe('Role-Based Access Control (RBAC) Tests', () => {
  let warehouse: any;

  it('setup rbac test fixtures', async () => {
    warehouse = await prisma.warehouse.findFirst({ where: { isActive: true } });
  });

  // Test 14: Unauthorized inventory operations
  it('14. should deny read-only auditor from creating products with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        name: 'Unauthorized Auditor Product',
        uom: 'units',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden|access denied/i);
  });

  it('should deny read-only auditor from creating warehouses with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        name: 'Unauthorized Warehouse',
        code: 'WH-UNAUTH',
        address: '123 Fake St',
        city: 'Fake City',
      });

    expect(res.status).toBe(403);
  });

  it('should deny inventory operator from approving purchase orders with 403 Forbidden', async () => {
    // Inventory operator has role INVENTORY_OPERATOR
    const res = await request(app)
      .post(`/api/purchase-orders/any-id/approve`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden|access denied/i);
  });

  it('should deny inventory operator from approving stock audits with 403 Forbidden', async () => {
    const res = await request(app)
      .post(`/api/audits/any-id/approve`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden|access denied/i);
  });

  it('should allow read-only auditor to view reports and query data', async () => {
    const res = await request(app)
      .get('/api/reports/valuation')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
  });
});
