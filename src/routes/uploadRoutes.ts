import { Router } from 'express';
import multer from 'multer';
import { uploadImage } from '../controllers/uploadcontroller.js';

const router = Router();

// Simpan file di memory (buffer), bukan di disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // maks 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan'));
    }
  },
});

router.post('/', upload.single('image'), uploadImage);

export default router;