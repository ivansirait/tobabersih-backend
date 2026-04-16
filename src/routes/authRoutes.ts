import { Router } from 'express';
import { login, register } from '../controllers/authController.js'; // Pastikan controller ini juga sudah dibuat

const router = Router();

// Endpoint untuk login supir/admin
router.post('/login', login);
router.post('/register', register);

export default router;