import { Router } from 'express';
import { login } from '../controllers/authController.js'; // Pastikan controller ini juga sudah dibuat

const router = Router();

// Endpoint untuk login supir/admin
router.post('/login', login);

export default router;