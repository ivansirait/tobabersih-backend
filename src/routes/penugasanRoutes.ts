import { Router } from 'express';
import { createRutin, createAduan, getSemuaPenugasan } from '../controllers/penugasanController.js';

const router = Router();

router.post('/rutin', createRutin);
router.post('/aduan', createAduan);
router.get('/', getSemuaPenugasan);

export default router;