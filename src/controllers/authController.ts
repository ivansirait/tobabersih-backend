import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';


export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    console.log('Mencoba login untuk email:', email);

    // Validasi input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email dan password harus diisi' 
      });
    }

    // Cari user di database
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('User tidak ditemukan:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Email atau password salah' 
      });
    }

    // Verifikasi password
    // Jika password disimpan dalam bentuk hash
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    // Jika password masih plain text (untuk sementara)
    // const isValidPassword = password === user.passwordHash;

    if (!isValidPassword) {
      console.log('Password salah untuk:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Email atau password salah' 
      });
    }

    // Buat token JWT
    const token = jwt.sign(
      { 
        id: user.id.toString(),
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET || 'rahasia-default',
      { expiresIn: '1d' }
    );

    console.log('Login berhasil untuk:', email);
    console.log('Token dibuat:', token.substring(0, 20) + '...');

    // Kirim response dengan token
    res.json({
      success: true,
      message: 'Login berhasil',
      token, // PASTIKAN INI ADA!
      user: {
        id: user.id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error saat login:', error);
    res.status(500).json({ 
      success: false,
      message: 'Terjadi kesalahan server' 
    });
  }
};

// Tambahkan fungsi ini di authController.ts

export const register = async (req: Request, res: Response) => {
  try {
    const { email, fullName, password, phoneNumber } = req.body;
    
    console.log('Mencoba register untuk email:', email);

    // Validasi input
    if (!email || !fullName || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email, nama lengkap, dan password harus diisi' 
      });
    }

    // Cek apakah email sudah terdaftar
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'Email sudah terdaftar' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat user baru dengan role WARGA
    const newUser = await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash: hashedPassword,
        phoneNumber: phoneNumber || null,
        role: 'WARGA',
        isActive: true
      }
    });

    // Buat token JWT
    const token = jwt.sign(
      { 
        id: newUser.id.toString(),
        email: newUser.email,
        role: newUser.role,
        fullName: newUser.fullName
      },
      process.env.JWT_SECRET || 'rahasia-default',
      { expiresIn: '1d' }
    );

    console.log('Register berhasil untuk:', email);

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      token,
      user: {
        id: newUser.id.toString(),
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Error saat register:', error);
    res.status(500).json({ 
      success: false,
      message: 'Terjadi kesalahan server' 
    });
  }
};