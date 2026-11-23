import { Router } from 'express';
import multer from 'multer';
import { ProductController } from '../controllers/productController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticate);

// List products (All roles)
router.get('/', ProductController.list);

// Export CSV (All roles)
router.get('/export/csv', ProductController.exportCSV);

// Get single product (All roles)
router.get('/:id', ProductController.getById);

// Create product (Admin, Warehouse Manager)
router.post(
  '/',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  ProductController.create
);

// Import products from CSV (Admin, Warehouse Manager)
router.post(
  '/import/csv',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  upload.single('file'),
  ProductController.importCSV
);

// Update product (Admin, Warehouse Manager)
router.put(
  '/:id',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  ProductController.update
);

// Archive product (Admin, Warehouse Manager)
router.delete(
  '/:id',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  ProductController.archive
);

export default router;
