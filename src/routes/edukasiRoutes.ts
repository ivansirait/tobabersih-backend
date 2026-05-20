import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  getEdukasi,
  getEdukasiById,
  createEdukasi,
  updateEdukasi,
  deleteEdukasi,
} from '../controllers/edukasiController.js';

const router = Router();

// Konsisten mengikuti logika fitur admin lain: edukasi hanya bisa dimanajemen oleh ADMIN
router.use(authenticateToken);
router.use(authorizeRole(['ADMIN']));

router.get('/', getEdukasi);
router.get('/:id', getEdukasiById);
router.post('/', createEdukasi);
router.put('/:id', updateEdukasi);
router.delete('/:id', deleteEdukasi);

export default router;


