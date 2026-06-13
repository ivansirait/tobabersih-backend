import express from "express";
import {
  getPelanggan,
  getPelangganById,
  createPelanggan,
  bulkCreatePelanggan,
  updatePelanggan,
  deletePelanggan,
  exportPelanggan,
  exportPelangganByDriver,
} from "../controllers/datapelangganController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// ⚠️ URUTAN PENTING: route statis HARUS di atas route dinamis /:id
// Kalau /:id duluan, Express akan menangkap "export" sebagai param id
router.get("/export",                    authenticateToken, exportPelanggan);
router.get("/export/driver/:driverId",   authenticateToken, exportPelangganByDriver);
router.post("/bulk",                     authenticateToken, bulkCreatePelanggan);

router.get("/",       authenticateToken, getPelanggan);
router.get("/:id",    authenticateToken, getPelangganById);
router.post("/",      authenticateToken, createPelanggan);
router.put("/:id",    authenticateToken, updatePelanggan);
router.delete("/:id", authenticateToken, deletePelanggan);

export default router;

