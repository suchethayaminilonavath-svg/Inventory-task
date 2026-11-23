import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService.js';
import { ReportingService } from '../services/reportingService.js';

export class ReportController {
  static async getDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = await DashboardService.getDashboardMetrics();
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  }

  static async getValuationReport(_req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportingService.getStockValuationReport();
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  static async exportValuationCSV(_req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await ReportingService.exportStockValuationCSV();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="stock-valuation-report.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }

  static async getLowStockReport(_req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportingService.getLowStockReport();
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  static async exportLowStockCSV(_req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await ReportingService.exportLowStockCSV();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="low-stock-report.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }

  static async getWarehouseStockReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportingService.getWarehouseStockReport(req.query.warehouseId as string);
      res.json({ warehouses: report });
    } catch (err) {
      next(err);
    }
  }

  static async exportMovementsCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await ReportingService.exportMovementsCSV({
        warehouseId: req.query.warehouseId,
        productId: req.query.productId,
        movementType: req.query.movementType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory-movements.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }

  static async getAuditDiscrepanciesReport(_req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportingService.getAuditDiscrepanciesReport();
      res.json({ discrepancies: report });
    } catch (err) {
      next(err);
    }
  }

  static async exportAuditDiscrepanciesCSV(_req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await ReportingService.exportAuditDiscrepanciesCSV();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-discrepancies.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}
