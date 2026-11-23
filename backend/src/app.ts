import express, { Express } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import movementRoutes from './routes/movementRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

export function createApp(): Express {
  const app = express();

  app.use(cors({
    origin: '*',
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'StockPilot API',
      timestamp: new Date().toISOString(),
    });
  });

  // REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/warehouses', warehouseRoutes);
  app.use('/api/suppliers', supplierRoutes);
  app.use('/api/purchase-orders', purchaseOrderRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use('/api/movements', movementRoutes);
  app.use('/api/audits', auditRoutes);
  app.use('/api/reports', reportRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export default createApp;
