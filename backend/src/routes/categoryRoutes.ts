import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

const router = Router();

router.use(authenticate);

router.get('/', CategoryController.list);
router.post(
  '/',
  authorize([UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]),
  CategoryController.create
);

export default router;
