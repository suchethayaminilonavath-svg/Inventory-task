import prisma from '../config/db.js';

export async function generateUniqueSKU(categoryPrefix?: string): Promise<string> {
  const prefix = (categoryPrefix ? categoryPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) : 'PROD') || 'PROD';
  
  let attempts = 0;
  while (attempts < 20) {
    attempts++;
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const sku = `${prefix}-${randomNum}`;
    
    const existing = await prisma.product.findUnique({
      where: { sku }
    });

    if (!existing) {
      return sku;
    }
  }

  // Fallback with timestamp
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

export function validateSKUFormat(sku: string): boolean {
  if (!sku || typeof sku !== 'string') return false;
  // SKU must be 3-30 characters, alphanumeric with dashes/underscores
  const skuRegex = /^[A-Za-z0-9\-_]{3,30}$/;
  return skuRegex.test(sku.trim());
}
