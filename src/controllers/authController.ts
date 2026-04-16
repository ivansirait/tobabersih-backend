import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt'; // Pastikan bcrypt di-import

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  try {
    // 🔍 PELACAK: Cetak ke terminal siapa yang mencoba login
    console.log(`\n➡️ Seseorang mencoba login dengan email: ${email}`);

    // Cari user di database
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log("❌ GAGAL: Email tidak ditemukan di database.");
      return res.status(401).json({ success: false, message: 'Email tidak terdaftar' });
    }

    // Cek password (Bisa teks biasa dari seeding, atau bcrypt dari register asli)
    let isPasswordValid = false;

    // Jika password di database adalah hasil enkripsi bcrypt (biasanya diawali $2b$ atau $2a$)
    if (user.passwordHash.startsWith('$2b$') || user.passwordHash.startsWith('$2a$')) {
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    } else {
      // Jika password di database adalah teks biasa (contoh: "budi123")
      isPasswordValid = (user.passwordHash === password);
    }

    if (!isPasswordValid) {
      console.log("❌ GAGAL: Password yang dimasukkan salah.");
      return res.status(401).json({ success: false, message: 'Password salah' });
    }

    console.log(`✅ BERHASIL: ${user.fullName} login sebagai ${user.role}`);

    // Tentukan role untuk dikirim ke Flutter / Next.js
    let flutterRole = 'masyarakat'; // Default untuk WARGA
    if (user.role === 'OPERATOR') flutterRole = 'supir';
    if (user.role === 'ADMIN') flutterRole = 'admin';

    return res.json({ 
      success: true, 
      role: flutterRole, 
      data: { 
        id: user.id.toString(), // Wajib toString agar tidak error BigInt
        name: user.fullName,
        email: user.email
      } 
    });

  } catch (error: any) {
    console.error("🔥 ERROR SISTEM SAAT LOGIN:", error);
    return res.status(500).json({ success: false, message: `Kesalahan server: ${error.message}` });
  }
};

// Fungsi Register Khusus Warga (Masyarakat)
export const register = async (req: Request, res: Response): Promise<any> => {
  const { fullName, email, password } = req.body;

  try {
    // 1. Cek apakah email sudah terpakai
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar, silakan gunakan email lain.' });
    }

    // 2. Enkripsi Password demi keamanan
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Simpan ke database dengan role WARGA
    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash: hashedPassword,
        role: 'WARGA',
        isActive: true
      }
    });

    return res.status(201).json({ 
      success: true, 
      message: 'Registrasi berhasil! Silakan login.',
      data: { id: newUser.id.toString(), name: newUser.fullName, email: newUser.email }
    });

  } catch (error: any) {
    console.error("🔥 ERROR SAAT REGISTER:", error);
    return res.status(500).json({ success: false, message: `Kesalahan server: ${error.message}` });
  }
};