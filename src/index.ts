import express from 'express'; // Mengambil fungsi express (Data/Value)
import type { Request, Response } from 'express'; // Mengambil tipe data (Type Only)
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './config/db.js';
import laporanRoutes from './routes/laporanRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import postRoutes from './routes/postRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/galleries', galleryRoutes);
app.use('/api/upload', uploadRoutes);   

// Prototype BigInt agar tidak error saat JSON.stringify
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

// Seeding Otomatis User Default
const seedUser = async () => {
  try {
    const user = await prisma.user.findUnique({ where: { id: BigInt(1) } });
    if (!user) {
      await prisma.user.create({
        data: {
          id: BigInt(1),
          email: "admin@cleancity.com",
          fullName: "Sistem CleanCity",
          passwordHash: "hashed",
          role: "ADMIN"
        }
      });
      console.log("✅ User Default OK");
    }
  } catch (e) { console.log("Seeding skipped."); }
};
seedUser();

// Routes
app.get('/', (req, res) => res.send('🚀 Server CleanCity OK!'));
app.use('/api/laporan', laporanRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server nyala di http://localhost:${PORT}`);
});