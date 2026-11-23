import { Router } from 'express';
import { ReportController } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/dashboard', ReportController.getDashboard);
router.get('/valuation', ReportController.getValuationReport);
router.get('/valuation/csv', ReportController.exportValuationCSV);
router.get('/low-stock', ReportController.getLowStockReport);
router.get('/low-stock/csv', ReportController.exportLowStockCSV);
router.get('/warehouse-stock', ReportController.getWarehouseStockReport);
router.get('/movements/csv', ReportController.exportMovementsCSV);
router.get('/audit-discrepancies', ReportController.getAuditDiscrepanciesReport);
router.get('/audit-discrepancies/csv', ReportController.exportAuditDiscrepanciesCSV);

export default router;
