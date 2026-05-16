import { Router } from 'express';
import {
  getEdukasi,
  getEdukasiById,
  createEdukasi,
  updateEdukasi,
  deleteEdukasi,
} from '../controllers/edukasiController.js';

const router = Router();

router.get('/', getEdukasi);
router.get('/:id', getEdukasiById);
router.post('/', createEdukasi);
router.put('/:id', updateEdukasi);
router.delete('/:id', deleteEdukasi);

export default router;

