import { Router } from 'express';
import { PurchaseOrderController } from '../controllers/purchaseOrderController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

const router = Router();

router.use(authenticate);

router.get('/', PurchaseOrderController.list);
router.get('/:id', PurchaseOrderController.getById);

router.post(
  '/',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  PurchaseOrderController.create
);

router.post(
  '/:id/submit',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  PurchaseOrderController.submit
);

router.post(
  '/:id/approve',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  PurchaseOrderController.approve
);

router.post(
  '/:id/reject',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  PurchaseOrderController.reject
);

router.post(
  '/:id/cancel',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  PurchaseOrderController.cancel
);

router.post(
  '/:id/receive',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  PurchaseOrderController.receive
);

export default router;
