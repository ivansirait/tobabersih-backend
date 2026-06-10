import express from "express";
import {
  getUsers,
  createUser,
  bulkCreateUsers,
  updateUser,
  deleteUser,
  exportUsers,
  exportUsersByDriver,
} from "../controllers/akunmasyarakatController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// ⚠️ PENTING: route statis harus di atas route dinamis /:id
// Kalau /export ditaruh setelah /:id, Express akan baca "export" sebagai id
router.get("/export", authenticateToken, exportUsers);
router.get("/export/driver/:driverId", authenticateToken, exportUsersByDriver);
router.post("/bulk", authenticateToken, bulkCreateUsers);

router.get("/", authenticateToken, getUsers);
router.post("/", authenticateToken, createUser);
router.put("/:id", authenticateToken, updateUser);
router.delete("/:id", authenticateToken, deleteUser);

export default router;