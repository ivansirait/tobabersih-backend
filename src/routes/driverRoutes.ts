import { Router } from 'express';
// 🔥 Pastikan getDriverTasks ikut di-import dari controller
import { getAvailableTasks, toggleDriverStatus, getDriverTasks } from '../controllers/driverController.js';

const router = Router();

// Endpoint untuk mengambil tugas baru (Bawaan aslimu)
router.get('/tasks/available', getAvailableTasks);

// Endpoint untuk mengubah status aktif supir (Bawaan aslimu)
router.put('/status', toggleDriverStatus);

// 🔥 TAMBAHAN BARU: Endpoint untuk mengambil daftar tugas harian & aduan khusus untuk supir tertentu
router.get('/:driverId/tasks', getDriverTasks);

export default router;