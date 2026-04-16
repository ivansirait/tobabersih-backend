import { Router } from 'express';
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
  getSemuaWilayah, // Import fungsi wilayah baru
  addWilayah,
  toggleWilayahStatus,
  deleteWilayah
} from '../controllers/adminController.js';

const router = Router();

// --- Rute Supir ---
router.post('/add-operator', addOperator);
router.get('/supir-list', getSemuaSupir);
router.put('/supir/:id', updateOperator);
router.delete('/supir/:id', deleteOperator);

// --- Rute Truk (Armada) ---
router.get('/truks', getSemuaTruk);
router.post('/truks', addTruk);
router.put('/truks/:id', updateTruk);
router.delete('/truks/:id', deleteTruk);

// --- Rute Wilayah (Location) ---
router.get('/wilayah', getSemuaWilayah);
router.post('/wilayah', addWilayah);
router.patch('/wilayah/:id/toggle', toggleWilayahStatus);
router.delete('/wilayah/:id', deleteWilayah);

// --- Rute Penugasan ---
router.patch('/laporan/:idLaporan/tugaskan', tugaskanLaporan);

export default router;