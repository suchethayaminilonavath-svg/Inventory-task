import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateUniqueSKU, validateSKUFormat } from '../utils/skuGenerator.js';
import { generateCSV, parseCSV } from '../utils/csv.js';

const productSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  uom: z.string().default('units'),
  minStockThreshold: z.number().int().min(0).default(10),
});

export class ProductController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const search = (req.query.search as string)?.trim();
      const categoryId = req.query.categoryId as string;
      const includeArchived = req.query.includeArchived === 'true';

      const where: any = {};
      if (!includeArchived) where.isArchived = false;
      if (categoryId) where.categoryId = categoryId;
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { sku: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            category: true,
            warehouseInventories: {
              include: { warehouse: true },
            },
          },
        }),
      ]);

      const formatted = products.map((p) => {
        const totalStock = p.warehouseInventories.reduce((sum, inv) => sum + inv.quantity, 0);
        return {
          ...p,
          totalStock,
          isLowStock: totalStock <= p.minStockThreshold,
          isOutOfStock: totalStock === 0,
        };
      });

      res.json({
        products: formatted,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          warehouseInventories: { include: { warehouse: true } },
          supplierProducts: { include: { supplier: true } },
        },
      });

      if (!product) throw new AppError('Product not found', 404);

      const totalStock = product.warehouseInventories.reduce((sum, inv) => sum + inv.quantity, 0);
      res.json({
        product: {
          ...product,
          totalStock,
          isLowStock: totalStock <= product.minStockThreshold,
          isOutOfStock: totalStock === 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = productSchema.parse(req.body);

      let sku = data.sku?.trim().toUpperCase();
      if (sku) {
        if (!validateSKUFormat(sku)) {
          throw new AppError('Invalid SKU format. Must be 3-30 alphanumeric characters with hyphens/underscores.', 400);
        }
        // Check duplicate SKU
        const existing = await prisma.product.findUnique({ where: { sku } });
        if (existing) {
          throw new AppError(`Product with SKU '${sku}' already exists. Duplicate SKUs are not permitted.`, 409);
        }
      } else {
        // Auto-generate unique SKU
        let categoryPrefix = 'PROD';
        if (data.categoryId) {
          const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
          if (cat) categoryPrefix = cat.name.slice(0, 4);
        }
        sku = await generateUniqueSKU(categoryPrefix);
      }

      const product = await prisma.product.create({
        data: {
          sku,
          name: data.name,
          description: data.description,
          categoryId: data.categoryId || null,
          uom: data.uom || 'units',
          minStockThreshold: data.minStockThreshold ?? 10,
        },
        include: { category: true },
      });

      res.status(201).json({ product });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = productSchema.partial().parse(req.body);

      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) throw new AppError('Product not found', 404);

      if (data.sku && data.sku.toUpperCase() !== existing.sku) {
        const skuUpper = data.sku.trim().toUpperCase();
        if (!validateSKUFormat(skuUpper)) {
          throw new AppError('Invalid SKU format', 400);
        }
        const duplicate = await prisma.product.findUnique({ where: { sku: skuUpper } });
        if (duplicate && duplicate.id !== id) {
          throw new AppError(`Product with SKU '${skuUpper}' already exists`, 409);
        }
        data.sku = skuUpper;
      }

      const product = await prisma.product.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.sku && { sku: data.sku }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.uom && { uom: data.uom }),
          ...(data.minStockThreshold !== undefined && { minStockThreshold: data.minStockThreshold }),
        },
        include: { category: true },
      });

      res.json({ product });
    } catch (err) {
      next(err);
    }
  }

  static async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await prisma.product.update({
        where: { id },
        data: { isArchived: true },
      });
      res.json({ message: 'Product archived successfully', product });
    } catch (err) {
      next(err);
    }
  }

  static async exportCSV(_req: Request, res: Response, next: NextFunction) {
    try {
      const products = await prisma.product.findMany({
        where: { isArchived: false },
        include: {
          category: true,
          warehouseInventories: true,
        },
        orderBy: { name: 'asc' },
      });

      const formatted = products.map((p) => {
        const stock = p.warehouseInventories.reduce((sum, inv) => sum + inv.quantity, 0);
        return {
          sku: p.sku,
          name: p.name,
          category: p.category?.name || '',
          uom: p.uom,
          minStockThreshold: p.minStockThreshold,
          totalStock: stock,
          description: p.description || '',
        };
      });

      const csv = generateCSV(formatted, [
        { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Product Name' },
        { key: 'category', label: 'Category' },
        { key: 'uom', label: 'UOM' },
        { key: 'minStockThreshold', label: 'Min Stock Threshold' },
        { key: 'totalStock', label: 'Total Stock' },
        { key: 'description', label: 'Description' },
      ]);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }

  static async importCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const csvContent = req.body?.csv || req.file?.buffer?.toString('utf-8');
      if (!csvContent) {
        throw new AppError('CSV content is required in request body or file upload', 400);
      }

      const rows = parseCSV(csvContent);
      if (rows.length === 0) {
        throw new AppError('No valid rows found in CSV', 400);
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const row of rows) {
        const sku = (row['SKU'] || row['sku'])?.trim().toUpperCase();
        const name = (row['Product Name'] || row['name'] || row['Name'])?.trim();
        const categoryName = (row['Category'] || row['category'])?.trim();
        const uom = (row['UOM'] || row['uom'])?.trim() || 'units';
        const minThreshold = parseInt(row['Min Stock Threshold'] || row['minStockThreshold'] || '10') || 10;
        const description = (row['Description'] || row['description'])?.trim() || '';

        if (!name) {
          skipped++;
          errors.push(`Row missing product name`);
          continue;
        }

        let finalSku = sku;
        if (finalSku) {
          const existing = await prisma.product.findUnique({ where: { sku: finalSku } });
          if (existing) {
            skipped++;
            errors.push(`Duplicate SKU '${finalSku}' skipped`);
            continue;
          }
        } else {
          finalSku = await generateUniqueSKU(categoryName ? categoryName.slice(0, 4) : 'PROD');
        }

        let categoryId: string | null = null;
        if (categoryName) {
          const category = await prisma.category.upsert({
            where: { name: categoryName },
            update: {},
            create: { name: categoryName },
          });
          categoryId = category.id;
        }

        await prisma.product.create({
          data: {
            sku: finalSku,
            name,
            description,
            categoryId,
            uom,
            minStockThreshold: minThreshold,
          },
        });
        imported++;
      }

      res.json({
        message: `Import complete. Imported: ${imported}, Skipped: ${skipped}`,
        imported,
        skipped,
        errors,
      });
    } catch (err) {
      next(err);
    }
  }
}
