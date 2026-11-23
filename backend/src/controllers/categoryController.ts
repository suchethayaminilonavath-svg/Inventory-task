import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

export class CategoryController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { products: true } },
        },
      });
      res.json({ categories });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = categorySchema.parse(req.body);
      const existing = await prisma.category.findUnique({ where: { name: data.name } });
      if (existing) {
        throw new AppError(`Category '${data.name}' already exists`, 409);
      }

      const category = await prisma.category.create({ data });
      res.status(201).json({ category });
    } catch (err) {
      next(err);
    }
  }
}
