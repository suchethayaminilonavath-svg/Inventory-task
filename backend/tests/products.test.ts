import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminToken, operatorToken } from './setup.js';

describe('Product Management Tests', () => {
  const uniqueSuffix = Date.now().toString().slice(-5);
  const testSku = `TEST-SKU-${uniqueSuffix}`;

  // Test 1: Product creation
  it('1. should create a product successfully with unique SKU and attributes', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: testSku,
        name: 'Industrial Sensor Module',
        description: 'High precision pressure sensor',
        uom: 'pcs',
        minStockThreshold: 25,
      });

    expect(res.status).toBe(201);
    expect(res.body.product).toBeDefined();
    expect(res.body.product.sku).toBe(testSku);
    expect(res.body.product.name).toBe('Industrial Sensor Module');
    expect(res.body.product.uom).toBe('pcs');
    expect(res.body.product.minStockThreshold).toBe(25);
    expect(res.body.product.isArchived).toBe(false);
  });

  // Test 2: Duplicate SKU rejection
  it('2. should reject duplicate SKU creation with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: testSku, // same SKU as above
        name: 'Another Duplicate Item',
        uom: 'pcs',
        minStockThreshold: 10,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/duplicate|already exists/i);
  });

  it('should auto-generate a valid unique SKU when none is supplied', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Auto-SKU Component',
        uom: 'units',
        minStockThreshold: 15,
      });

    expect(res.status).toBe(201);
    expect(res.body.product.sku).toBeDefined();
    expect(res.body.product.sku.length).toBeGreaterThan(5);
  });

  it('should list and paginate products with search and filtering', async () => {
    const res = await request(app)
      .get('/api/products?page=1&limit=5&search=Industrial')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
  });

  it('should archive a product successfully', async () => {
    // Create product to archive
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Item to Archive',
        uom: 'pcs',
      });

    const prodId = prodRes.body.product.id;

    const archiveRes = await request(app)
      .delete(`/api/products/${prodId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.product.isArchived).toBe(true);

    // Verify it is excluded from default product list
    const listRes = await request(app)
      .get(`/api/products?search=Item to Archive`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(listRes.body.products.length).toBe(0);
  });
});
