import { Router } from 'express';
import { addOperator } from '../controllers/adminController.js';

const router = Router();

// Endpoint internal khusus Admin untuk menambah supir baru
router.post('/add-operator', addOperator);

export default router;