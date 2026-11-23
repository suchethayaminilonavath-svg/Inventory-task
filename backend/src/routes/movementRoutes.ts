import { Router } from 'express';
import { MovementController } from '../controllers/movementController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

const router = Router();

router.use(authenticate);

router.get('/', MovementController.list);
router.post(
  '/manual',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  MovementController.recordManual
);

export default router;
