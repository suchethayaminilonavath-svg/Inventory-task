import { Router } from 'express';
import { SupplierController } from '../controllers/supplierController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

const router = Router();

router.use(authenticate);

router.get('/', SupplierController.list);
router.get('/:id', SupplierController.getById);
router.get('/:id/purchase-history', SupplierController.getPurchaseHistory);

router.post(
  '/',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  SupplierController.create
);

router.put(
  '/:id',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  SupplierController.update
);

router.post(
  '/:id/products',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  SupplierController.associateProduct
);

export default router;
