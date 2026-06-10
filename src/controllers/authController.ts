import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!JWT_SECRET) {
  console.error('🔴 CRITICAL: JWT_SECRET not configured in .env');
  process.exit(1);
}

export const login = async (req: Request, res: Response): Promise<any> => {
  const { email, password, fcmToken } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password harus diisi', code: 'INVALID_INPUT' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid', code: 'INVALID_EMAIL_FORMAT' });
    }

    console.log(`\n➡️ Login attempt: ${email}`);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        passwordHash: true,
        isActive: true,
      }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email atau password tidak valid', code: 'INVALID_CREDENTIALS' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Akun Anda telah dinonaktifkan. Hubungi admin.', code: 'ACCOUNT_INACTIVE' });
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Email atau password tidak valid', code: 'INVALID_CREDENTIALS' });
    }

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Email atau password tidak valid', code: 'INVALID_CREDENTIALS' });
    }

    if (fcmToken) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { fcm_token: fcmToken }
        });
      } catch (tokenError) {
        console.error('⚠️ Gagal memperbarui FCM Token:', tokenError);
      }
    }

    const tokenPayload = {
      id: user.id.toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName
    };

    let token: string;
    try {
      // ✅ Fix: cast JWT_EXPIRES_IN as any untuk menghindari error tipe StringValue
      token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN as any,
        algorithm: 'HS256'
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Gagal generate token.', code: 'TOKEN_GENERATION_ERROR' });
    }

    try {
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });
    } catch (err) {
      console.warn('Warning: unable to set httpOnly cookie.', err);
    }

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      token,
      user: {
        id: user.id.toString(),
        name: user.fullName,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Kesalahan server.',
      code: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

export const register = async (req: Request, res: Response): Promise<any> => {
  const { fullName, email, password, passwordConfirm, phoneNumber } = req.body;
  // ✅ Fix: hapus address dan wilayahId dari destructuring — tidak ada di schema

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nama lengkap, email, dan password harus diisi', code: 'INVALID_INPUT' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid', code: 'INVALID_EMAIL_FORMAT' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password minimal 8 karakter', code: 'WEAK_PASSWORD' });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ success: false, message: 'Password dan konfirmasi password tidak cocok', code: 'PASSWORD_MISMATCH' });
    }

    if (fullName.trim().length < 3 || fullName.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Nama lengkap harus 3-100 karakter', code: 'INVALID_NAME' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar.', code: 'EMAIL_ALREADY_EXISTS' });
    }

    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Gagal memproses password.', code: 'HASH_ERROR' });
    }

    let newUser;
    try {
      newUser = await prisma.user.create({
        data: {
          fullName: fullName.trim(),
          email: email.toLowerCase(),
          passwordHash: hashedPassword,
          phoneNumber: phoneNumber || null,
          // ✅ Fix: hapus address dan locationId — tidak ada di schema Prisma
          role: 'WARGA',
          isActive: true
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          // ✅ Fix: hapus locationId dari select — tidak ada di schema
          createdAt: true
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        return res.status(409).json({ success: false, message: `${field} sudah terdaftar`, code: 'DUPLICATE_FIELD' });
      }
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil! Silakan login.',
      data: {
        id: newUser.id.toString(),
        name: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        wilayahId: null  // ✅ Fix: kembalikan null karena locationId tidak ada di schema
      }
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Kesalahan server.',
      code: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

export const verifyToken = async (req: Request, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const cookieToken = (req as any).cookies?.token;
    const finalToken = token || cookieToken;

    if (!finalToken) {
      return res.status(401).json({ success: false, message: 'Token tidak ditemukan', code: 'NO_TOKEN' });
    }

    try {
      const decoded = jwt.verify(finalToken, JWT_SECRET);
      return res.json({
        success: true,
        message: 'Token valid',
        user: {
          id: (decoded as any).id,
          email: (decoded as any).email,
          name: (decoded as any).fullName,
          role: (decoded as any).role,
        }
      });
    } catch (error: any) {
      let errorCode = 'INVALID_TOKEN';
      if (error.name === 'TokenExpiredError') errorCode = 'TOKEN_EXPIRED';
      return res.status(401).json({ success: false, message: 'Token tidak valid atau kadaluarsa', code: errorCode });
    }

  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Kesalahan server', code: 'INTERNAL_SERVER_ERROR' });
  }
};

export const logout = async (req: Request, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log(`\n🚪 ${(decoded as any).fullName} logout`);
      } catch (e) {}
    }

    res.clearCookie('token', { path: '/' });
    return res.json({ success: true, message: 'Logout berhasil.', code: 'LOGOUT_SUCCESS' });

  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Kesalahan server', code: 'INTERNAL_SERVER_ERROR' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<any> => {
  const { userId, fullName, phoneNumber } = req.body;
  // ✅ Fix: hapus address dan locationId dari destructuring — tidak ada di schema

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId harus diisi', code: 'INVALID_INPUT' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: BigInt(userId as string) },
      data: {
        ...(fullName && { fullName }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        // ✅ Fix: hapus address dan locationId — tidak ada di schema
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui',
      data: {
        fullName: updatedUser.fullName,
        phoneNumber: updatedUser.phoneNumber,
        address: null,      // ✅ Fix: kembalikan null karena tidak ada di schema
        locationId: null    // ✅ Fix: kembalikan null karena tidak ada di schema
      }
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan', code: 'USER_NOT_FOUND' });
    }
    return res.status(500).json({ success: false, message: 'Gagal memperbarui profil', code: 'INTERNAL_SERVER_ERROR' });
  }
};