import express from 'express'; // Mengambil fungsi express (Data/Value)
import type { Request, Response } from 'express'; // Mengambil tipe data (Type Only)
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http'; // 🔥 IMPORT BARU: Modul HTTP bawaan Node.js
import { Server } from 'socket.io'; // 🔥 IMPORT BARU: Server dari Socket.io

import { prisma } from './config/db.js';
import laporanRoutes from './routes/laporanRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import postRoutes from './routes/postRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import driverRoutes from './routes/driverRoutes.js';
import penugasanRoutes from './routes/penugasanRoutes.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ==============================================================
// 🔥 SETUP SOCKET.IO (WEBSOCKET) UNTUK FITUR REAL-TIME
// ==============================================================

// 1. Bungkus aplikasi Express dengan HTTP Server
const server = http.createServer(app);

// 2. Inisialisasi Socket.io
const io = new Server(server, {
  cors: { 
    origin: '*', // Izinkan semua koneksi (dari aplikasi Flutter & Web Admin)
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

// 3. Simpan variabel 'io' ke dalam Express agar bisa diakses dari controller laporan
app.set('io', io);

// 4. Deteksi jika ada HP (Flutter) atau Web yang terhubung
io.on('connection', (socket) => {
  console.log('📱 Klien terhubung ke WebSocket:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Klien terputus dari WebSocket:', socket.id);
  });
});
// ==============================================================

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
// app.use('/api/posts', postRoutes);
// app.use('/api/galleries', galleryRoutes);
app.use('/api/upload', uploadRoutes); 
app.use('/api/driver', driverRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/penugasan', penugasanRoutes);

// Prototype BigInt agar tidak error saat JSON.stringify
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

// Seeding Otomatis User Default
const seedUser = async () => {
  try {
    // Cari berdasarkan email agar tidak bentrok dengan auto-increment BigInt
    const admin = await prisma.user.findUnique({ where: { email: "admin@dlh.com" } });
    
    if (!admin) {
      await prisma.user.create({
        data: {
          fullName: "Administrator DLH",
          email: "admin@dlh.com",
          passwordHash: "admin123", // Catatan: Sebaiknya di-hash jika untuk production
          role: "ADMIN",
          isActive: true
        }
      });
      console.log("✅ User Admin Default OK (admin@dlh.com)");
    } else {
      console.log("✅ User Admin sudah ada di database");
    }
  } catch (e) { 
    console.error("🔥 Seeding gagal karena error ini:", e); 
  }
};
seedUser();

// Routes Dasar
app.get('/', (req, res) => res.send('🚀 Server TobaBersih OK!'));

// 🔥 PERUBAHAN PENTING: Gunakan server.listen, bukan app.listen
server.listen(PORT, () => {
  console.log(`🚀 Server nyala di http://localhost:${PORT}`);
  console.log(`🔌 WebSocket (Socket.io) aktif dan siap menerima koneksi!`);
});