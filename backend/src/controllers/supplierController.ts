import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';

const supplierSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(10),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

const associateProductSchema = z.object({
  productId: z.string().uuid(),
  supplierSku: z.string().optional(),
  leadTimeDays: z.number().int().min(1).default(7),
  costPrice: z.number().min(0).default(0),
});

export class SupplierController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const search = (req.query.search as string)?.trim();
      const status = req.query.status as string;

      const where: any = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { code: { contains: search } },
          { contactName: { contains: search } },
          { email: { contains: search } },
        ];
      }

      const suppliers = await prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { supplierProducts: true, purchaseOrders: true } },
        },
      });

      res.json({ suppliers });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
          supplierProducts: { include: { product: true } },
          purchaseOrders: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { warehouse: true },
          },
        },
      });

      if (!supplier) throw new AppError('Supplier not found', 404);
      res.json({ supplier });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = supplierSchema.parse(req.body);
      const codeUpper = data.code.toUpperCase().trim();

      const existing = await prisma.supplier.findUnique({ where: { code: codeUpper } });
      if (existing) {
        throw new AppError(`Supplier with code '${codeUpper}' already exists`, 409);
      }

      const supplier = await prisma.supplier.create({
        data: { ...data, code: codeUpper },
      });
      res.status(201).json({ supplier });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = supplierSchema.partial().parse(req.body);

      if (data.code) {
        const codeUpper = data.code.toUpperCase().trim();
        const duplicate = await prisma.supplier.findUnique({ where: { code: codeUpper } });
        if (duplicate && duplicate.id !== id) {
          throw new AppError(`Supplier with code '${codeUpper}' already exists`, 409);
        }
        data.code = codeUpper;
      }

      const supplier = await prisma.supplier.update({
        where: { id },
        data,
      });
      res.json({ supplier });
    } catch (err) {
      next(err);
    }
  }

  static async associateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: supplierId } = req.params;
      const data = associateProductSchema.parse(req.body);

      const [supplier, product] = await Promise.all([
        prisma.supplier.findUnique({ where: { id: supplierId } }),
        prisma.product.findUnique({ where: { id: data.productId } }),
      ]);

      if (!supplier) throw new AppError('Supplier not found', 404);
      if (!product) throw new AppError('Product not found', 404);

      const association = await prisma.supplierProduct.upsert({
        where: {
          supplierId_productId: {
            supplierId,
            productId: data.productId,
          },
        },
        update: {
          supplierSku: data.supplierSku,
          leadTimeDays: data.leadTimeDays,
          costPrice: data.costPrice,
        },
        create: {
          supplierId,
          productId: data.productId,
          supplierSku: data.supplierSku,
          leadTimeDays: data.leadTimeDays,
          costPrice: data.costPrice,
        },
        include: { product: true },
      });

      res.status(201).json({ association });
    } catch (err) {
      next(err);
    }
  }

  static async getPurchaseHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: supplierId } = req.params;
      const orders = await prisma.purchaseOrder.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: true,
          items: { include: { product: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      const totalSpent = orders
        .filter((o) => o.status === 'RECEIVED' || o.status === 'PARTIALLY_RECEIVED')
        .reduce((sum, o) => sum + o.total, 0);

      res.json({
        orders,
        summary: {
          totalOrders: orders.length,
          totalSpent: Math.round(totalSpent * 100) / 100,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
