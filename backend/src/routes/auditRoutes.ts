import { Router } from 'express';
import { StockAuditController } from '../controllers/auditController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

const router = Router();

router.use(authenticate);

router.get('/', StockAuditController.list);
router.get('/:id', StockAuditController.getById);

router.post(
  '/',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  StockAuditController.create
);

router.post(
  '/:id/counts',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  StockAuditController.recordCounts
);

router.post(
  '/:id/submit',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  StockAuditController.submit
);

router.post(
  '/:id/approve',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  StockAuditController.approve
);

router.post(
  '/:id/reject',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  StockAuditController.reject
);

export default router;
