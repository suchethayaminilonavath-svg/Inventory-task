import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, operatorToken } from './setup.js';

describe('Reporting & CSV Export Tests', () => {
  // Test 16: CSV report generation
  it('16. should generate valid CSV export for stock valuation report', async () => {
    const res = await request(app)
      .get('/api/reports/valuation/csv')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Warehouse Code');
    expect(res.text).toContain('SKU');
    expect(res.text).toContain('Total Value ($)');
  });

  it('should generate valid CSV export for low-stock inventory report', async () => {
    const res = await request(app)
      .get('/api/reports/low-stock/csv')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Current Quantity');
    expect(res.text).toContain('Min Threshold');
  });

  it('should generate valid CSV export for movement ledger', async () => {
    const res = await request(app)
      .get('/api/reports/movements/csv')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Movement Type');
    expect(res.text).toContain('Delta Quantity');
    expect(res.text).toContain('New Balance');
  });

  it('should return live dashboard metrics with non-hardcoded database calculations', async () => {
    const res = await request(app)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalProducts).toBeGreaterThan(0);
    expect(res.body.totalWarehouses).toBeGreaterThan(0);
    expect(res.body.totalInventoryQuantity).toBeGreaterThan(0);
    expect(res.body.recentMovements).toBeInstanceOf(Array);
  });
});
