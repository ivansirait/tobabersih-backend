import { Router } from 'express';
import { getLaporan, createLaporan, updateStatus, deleteLaporan } from '../controllers/laporanController.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', getLaporan);
router.post('/', upload.single('photo'), createLaporan);
router.patch('/:id', updateStatus);
router.delete('/:id', deleteLaporan);

export default router;