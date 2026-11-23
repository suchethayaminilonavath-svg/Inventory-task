import { Router } from 'express';
import { WarehouseController } from '../controllers/warehouseController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

const router = Router();

router.use(authenticate);

router.get('/', WarehouseController.list);
router.get('/:id', WarehouseController.getById);
router.get('/:id/inventory', WarehouseController.getWarehouseInventory);

router.post(
  '/',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  WarehouseController.create
);

router.put(
  '/:id',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  WarehouseController.update
);

router.post(
  '/:id/inventory/initialize',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.INVENTORY_OPERATOR]),
  WarehouseController.initializeStock
);

export default router;
