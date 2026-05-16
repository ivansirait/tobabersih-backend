import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';

export const getEdukasi = async (_req: Request, res: Response) => {
  try {
    const edukasi = await prisma.edukasi.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(edukasi);
  } catch (error) {
    console.error('Error getEdukasi:', error);
    res.status(500).json({ message: 'Gagal mengambil data edukasi' });
  }
};

export const getEdukasiById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID tidak valid' });

    const edukasi = await prisma.edukasi.findUnique({ where: { id } });
    if (!edukasi) return res.status(404).json({ message: 'Edukasi tidak ditemukan' });

    res.json(edukasi);
  } catch (error) {
    console.error('Error getEdukasiById:', error);
    res.status(500).json({ message: 'Gagal mengambil data edukasi' });
  }
};

export const createEdukasi = async (req: Request, res: Response) => {
  try {
    const { judul, deskripsi, mediaUrl, mediaType } = req.body as {
      judul?: string;
      deskripsi?: string | null;
      mediaUrl?: string;
      mediaType?: 'IMAGE' | 'VIDEO';
    };

    if (!judul?.trim()) return res.status(400).json({ message: 'Judul wajib diisi' });
    if (!mediaUrl) return res.status(400).json({ message: 'mediaUrl wajib diisi' });
    if (!mediaType) return res.status(400).json({ message: 'mediaType wajib diisi' });

    const created = await prisma.edukasi.create({
      data: {
        judul: judul.trim(),
        deskripsi: deskripsi ?? null,
        mediaUrl,
        mediaType,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error createEdukasi:', error);
    res.status(500).json({ message: 'Gagal membuat edukasi' });
  }
};

export const updateEdukasi = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID tidak valid' });

    const { judul, deskripsi, mediaUrl, mediaType } = req.body as {
      judul?: string;
      deskripsi?: string | null;
      mediaUrl?: string;
      mediaType?: 'IMAGE' | 'VIDEO';
    };

    if (!judul?.trim()) return res.status(400).json({ message: 'Judul wajib diisi' });
    if (!mediaUrl) return res.status(400).json({ message: 'mediaUrl wajib diisi' });
    if (!mediaType) return res.status(400).json({ message: 'mediaType wajib diisi' });

    const updated = await prisma.edukasi.update({
      where: { id },
      data: {
        judul: judul.trim(),
        deskripsi: deskripsi ?? null,
        mediaUrl,
        mediaType,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updateEdukasi:', error);
    res.status(500).json({ message: 'Gagal memperbarui edukasi' });
  }
};

export const deleteEdukasi = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID tidak valid' });

    await prisma.edukasi.delete({ where: { id } });
    res.json({ message: 'Edukasi berhasil dihapus' });
  } catch (error) {
    console.error('Error deleteEdukasi:', error);
    res.status(500).json({ message: 'Gagal menghapus edukasi' });
  }
};

