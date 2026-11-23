import { Router } from 'express';
import { TransferController } from '../controllers/transferController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

const router = Router();

router.use(authenticate);

router.get('/', TransferController.list);
router.get('/:id', TransferController.getById);

router.post(
  '/',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  TransferController.create
);

router.post(
  '/:id/request',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  TransferController.request
);

router.post(
  '/:id/approve',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  TransferController.approve
);

router.post(
  '/:id/dispatch',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  TransferController.dispatch
);

router.post(
  '/:id/receive',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  TransferController.receive
);

router.post(
  '/:id/reject',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  TransferController.reject
);

router.post(
  '/:id/cancel',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  TransferController.cancel
);

export default router;
