import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import bcrypt from 'bcrypt';

export const addOperator = async (req: Request, res: Response) => {
  const { email, password, fullName, phoneNumber } = req.body;

  try {
    // 1. Validasi apakah email sudah terdaftar
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email sudah terdaftar di sistem" });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Simpan sebagai OPERATOR
    const supirBaru = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phoneNumber,
        role: 'OPERATOR', // Dikunci agar Admin tidak salah pilih role
        isActive: true 
      }
    });

    // Jangan kirim passwordHash kembali ke client untuk keamanan
    const { passwordHash: _, ...result } = supirBaru;

    res.status(201).json({ 
      message: "Akun Supir (Operator) berhasil dibuat oleh Admin", 
      data: result 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};