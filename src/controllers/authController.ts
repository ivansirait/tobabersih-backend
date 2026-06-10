import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * ============================================================================
 * Authentication Controller
 * ============================================================================
 * Handles: login, register, token verification, logout, updateProfile
 * Security: Password hashing, JWT validation, role-based access
 * ============================================================================
 */

// ============================================================================
// JWT Configuration
// ============================================================================
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Validate JWT_SECRET on module load — JANGAN pakai fallback default, ini celah keamanan
if (!JWT_SECRET) {
  console.error('🔴 CRITICAL: JWT_SECRET not configured in .env');
  process.exit(1);
}

/**
 * ============================================================================
 * LOGIN Endpoint
 * ============================================================================
 * POST /auth/login
 * Body: { email: string, password: string, fcmToken?: string }
 * Response: { success: true, token: string, user: {...} }
 *
 * fcmToken bersifat opsional — dipakai oleh Flutter untuk push notification.
 * Jika dikirimkan, akan disimpan ke kolom fcm_token di tabel user.
 */
export const login = async (req: Request, res: Response): Promise<any> => {
  const { email, password, fcmToken } = req.body;

  try {
    // STEP 1: Validate Input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password harus diisi',
        code: 'INVALID_INPUT'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid',
        code: 'INVALID_EMAIL_FORMAT'
      });
    }

    console.log(`\n➡️ Login attempt: ${email}`);

    // STEP 2: Find User
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
      console.log(`❌ Login failed: User not found (${email})`);
      return res.status(401).json({
        success: false,
        message: 'Email atau password tidak valid',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.isActive) {
      console.log(`❌ Login failed: User inactive (${email})`);
      return res.status(403).json({
        success: false,
        message: 'Akun Anda telah dinonaktifkan. Hubungi admin.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // STEP 3: Validate Password
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      console.error('❌ Password comparison error:', error);
      return res.status(401).json({
        success: false,
        message: 'Email atau password tidak valid',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!isPasswordValid) {
      console.log(`❌ Login failed: Invalid password (${email})`);
      return res.status(401).json({
        success: false,
        message: 'Email atau password tidak valid',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // STEP 4: Simpan FCM Token jika dikirim oleh Flutter (opsional)
    // ⚠️ CATATAN: Pastikan kolom `fcm_token` sudah ada di schema Prisma kamu.
    // Jika belum, tambahkan: fcm_token String? di model User, lalu jalankan prisma migrate.
    if (fcmToken) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { fcm_token: fcmToken }
        });
        console.log(`📡 FCM Token diperbarui untuk user ${user.email}`);
      } catch (tokenError) {
        // Tidak fatal — login tetap lanjut meski FCM gagal disimpan
        console.error('⚠️ Gagal memperbarui FCM Token:', tokenError);
      }
    }

    // STEP 5: Generate JWT Token
    const tokenPayload = {
      id: user.id.toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName
    };

    let token: string;
    try {
      token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        algorithm: 'HS256'
      });
    } catch (error) {
      console.error('❌ Token generation failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal generate token. Coba lagi nanti.',
        code: 'TOKEN_GENERATION_ERROR'
      });
    }

    // STEP 6: Set httpOnly Cookie
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

    console.log(`✅ Login successful: ${user.fullName} (${user.role})`);

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
    console.error('🔥 Critical error during login:', {
      message: error.message,
      email: req.body.email
    });

    return res.status(500).json({
      success: false,
      message: 'Kesalahan server. Coba lagi nanti.',
      code: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * ============================================================================
 * REGISTER Endpoint (Public - untuk WARGA)
 * ============================================================================
 * POST /auth/register
 * Body: {
 *   fullName: string,
 *   email: string,
 *   password: string,
 *   passwordConfirm: string,
 *   phoneNumber?: string,   // opsional, dari Flutter
 *   address?: string,       // opsional, dari Flutter
 *   wilayahId?: string      // opsional, dari Flutter — dipetakan ke locationId
 * }
 * Response: { success: true, message: string, data: {...} }
 *
 * Field phoneNumber, address, wilayahId bersifat opsional.
 * Flutter mengirim wilayahId, namun di database disimpan sebagai locationId.
 */
export const register = async (req: Request, res: Response): Promise<any> => {
  const { fullName, email, password, passwordConfirm, phoneNumber, address, wilayahId } = req.body;

  try {
    // STEP 1: Validate Input
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap, email, dan password harus diisi',
        code: 'INVALID_INPUT'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid',
        code: 'INVALID_EMAIL_FORMAT'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 8 karakter',
        code: 'WEAK_PASSWORD'
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: 'Password dan konfirmasi password tidak cocok',
        code: 'PASSWORD_MISMATCH'
      });
    }

    if (fullName.trim().length < 3 || fullName.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap harus 3-100 karakter',
        code: 'INVALID_NAME'
      });
    }

    // STEP 2: Check if Email Exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar. Silakan gunakan email lain atau login.',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    // STEP 3: Hash Password
    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (error) {
      console.error('❌ Password hashing failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal memproses password. Coba lagi nanti.',
        code: 'HASH_ERROR'
      });
    }

    // STEP 4: Create User
    // ⚠️ CATATAN: Pastikan field phoneNumber, address, locationId sudah ada
    // di schema Prisma. Jika belum, tambahkan dan jalankan prisma migrate.
    let newUser;
    try {
      newUser = await prisma.user.create({
        data: {
          fullName: fullName.trim(),
          email: email.toLowerCase(),
          passwordHash: hashedPassword,
          phoneNumber: phoneNumber || null,
          address: address || null,
          // wilayahId dari Flutter dipetakan ke locationId di database
          locationId: wilayahId ? BigInt(wilayahId) : null,
          role: 'WARGA',
          isActive: true
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          locationId: true,
          createdAt: true
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        return res.status(409).json({
          success: false,
          message: `${field} sudah terdaftar`,
          code: 'DUPLICATE_FIELD'
        });
      }
      throw error;
    }

    console.log(`✅ Registration successful: ${newUser.fullName} (${newUser.email})`);

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil! Silakan login dengan email dan password Anda.',
      data: {
        id: newUser.id.toString(),
        name: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        // Kembalikan sebagai wilayahId agar Flutter tidak perlu mapping ulang
        wilayahId: newUser.locationId?.toString() || null
      }
    });

  } catch (error: any) {
    console.error('🔥 Critical error during registration:', {
      message: error.message,
      email: req.body.email
    });

    return res.status(500).json({
      success: false,
      message: 'Kesalahan server. Coba lagi nanti.',
      code: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * ============================================================================
 * VERIFY TOKEN Endpoint
 * ============================================================================
 * POST /auth/verify
 * Headers: Authorization: Bearer <TOKEN>
 * Response: { success: true, message: string, user: {...} }
 *
 * Dipakai frontend untuk mengecek apakah token masih valid.
 */
export const verifyToken = async (req: Request, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const cookieToken = (req as any).cookies?.token;

    const finalToken = token || cookieToken;

    if (!finalToken) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan',
        code: 'NO_TOKEN'
      });
    }

    try {
      const decoded = jwt.verify(finalToken, JWT_SECRET);

      console.log(`✅ Token verified untuk: ${(decoded as any).email}`);

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
      if (error.name === 'TokenExpiredError') {
        errorCode = 'TOKEN_EXPIRED';
      }

      console.error(`❌ Token verification failed: ${error.message}`);

      return res.status(401).json({
        success: false,
        message: 'Token tidak valid atau kadaluarsa',
        code: errorCode
      });
    }

  } catch (error: any) {
    console.error('❌ Verify token error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Kesalahan server',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * ============================================================================
 * LOGOUT Endpoint
 * ============================================================================
 * POST /auth/logout
 * Headers: Authorization: Bearer <TOKEN>
 * Response: { success: true, message: string }
 *
 * Mencatat event logout dan menghapus cookie session.
 */
export const logout = async (req: Request, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log(`\n🚪 ${(decoded as any).fullName} (${(decoded as any).email}) logout sebagai ${(decoded as any).role}`);
      } catch (e) {
        // Token mungkin sudah expired, tetap lanjut logout
      }
    }

    res.clearCookie('token', { path: '/' });

    return res.json({
      success: true,
      message: 'Logout berhasil. Session dihapus.',
      code: 'LOGOUT_SUCCESS'
    });

  } catch (error: any) {
    console.error('❌ Logout error:', error);

    return res.status(500).json({
      success: false,
      message: 'Kesalahan server',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * ============================================================================
 * UPDATE PROFILE Endpoint
 * ============================================================================
 * PUT /auth/profile
 * Body: { userId: string, fullName?: string, phoneNumber?: string, address?: string, locationId?: string }
 * Response: { success: true, message: string, data: {...} }
 *
 * ⚠️ PERINGATAN KEAMANAN: Endpoint ini harus dilindungi dengan auth middleware
 * di router, dan userId sebaiknya diambil dari token JWT (req.user.id),
 * BUKAN dari req.body — agar user tidak bisa mengubah profil orang lain.
 *
 * Contoh perbaikan yang direkomendasikan di router:
 *   router.put('/profile', authMiddleware, updateProfile);
 *
 * Dan di fungsi ini, ganti:
 *   const { userId } = req.body
 * menjadi:
 *   const userId = (req as any).user.id  // dari token yang sudah diverifikasi middleware
 */
export const updateProfile = async (req: Request, res: Response): Promise<any> => {
  // ⚠️ TODO: Ganti userId dari req.body menjadi dari token JWT untuk keamanan
  // Lihat catatan di atas.
  const { userId, fullName, phoneNumber, address, locationId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId harus diisi',
      code: 'INVALID_INPUT'
    });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        ...(fullName && { fullName }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(address !== undefined && { address }),
        locationId: locationId ? BigInt(locationId) : null,
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui',
      data: {
        fullName: updatedUser.fullName,
        phoneNumber: updatedUser.phoneNumber,
        address: updatedUser.address,
        locationId: updatedUser.locationId?.toString() || null
      }
    });
  } catch (error: any) {
    console.error('❌ Error updating profile:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan',
        code: 'USER_NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui profil',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};