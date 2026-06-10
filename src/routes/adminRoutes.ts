import { Router } from 'express';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';
import {
  addOperator,
  getSemuaSupir,
  tugaskanLaporan,
  updateOperator,
  deleteOperator,
  getSemuaTruk,
  addTruk,
  updateTruk,
  deleteTruk,

  getAllKabid,
  updateKabid,
} from '../controllers/adminController.js';



const router = Router();

// --- Rute Supir ---
router.post('/add-operator', authenticateToken, addOperator);
router.get('/supir-list', authenticateToken, getSemuaSupir);
router.put('/supir/:id', authenticateToken, updateOperator);
router.delete('/supir/:id', authenticateToken, deleteOperator);

// --- Rute Truk (Armada) ---
router.get('/truks', authenticateToken, getSemuaTruk);
router.post('/truks', authenticateToken, addTruk);
router.put('/truks/:id', authenticateToken, updateTruk);
router.delete('/truks/:id', authenticateToken, deleteTruk);

// --- Rute Penugasan ---
router.patch('/laporan/:idLaporan/tugaskan', authenticateToken, tugaskanLaporan);

// --- Manajemen Kepala Bidang (KABID) – hanya ADMIN ---
router.get('/kabid', authenticateToken, authorizeAdmin, getAllKabid);
router.put('/kabid', authenticateToken, authorizeAdmin, updateKabid);

export default router;