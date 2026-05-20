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
    // debug supaya jelas kenapa request gagal
    // (tidak membuat file baru)
    console.log('[edukasi] create body:', req.body);

    const { judul, deskripsi, mediaUrl, mediaType } = req.body as {
      judul?: string;
      deskripsi?: string | null;
      mediaUrl?: string;
      mediaType?: 'IMAGE' | 'VIDEO' | string;
    };

    // toleransi: terkadang frontend bisa mengirim mediaType berisi lowercase/atau kosong-spaces
    const mediaUrlFinal = typeof mediaUrl === 'string' ? mediaUrl.trim() : mediaUrl;
    const mediaTypeRaw = mediaType != null ? String(mediaType).trim() : mediaType;

    if (!judul?.trim()) return res.status(400).json({ message: 'Judul wajib diisi' });
    if (!mediaUrl) return res.status(400).json({ message: 'mediaUrl wajib diisi' });
    if (!mediaType) return res.status(400).json({ message: 'mediaType wajib diisi' });

    const normalizedMediaType = String(mediaType).toUpperCase();
    if (normalizedMediaType !== 'IMAGE' && normalizedMediaType !== 'VIDEO') {
      return res.status(400).json({ message: 'mediaType harus IMAGE atau VIDEO' });
    }

    // (important) helper utk konsistensi di create/update
    const mediaTypeFinal = normalizedMediaType as 'IMAGE' | 'VIDEO';

    const created = await prisma.edukasi.create({
      data: {
        judul: judul.trim(),
        deskripsi: deskripsi ?? null,
        mediaUrl,
        mediaType: mediaTypeFinal,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error createEdukasi:', error);
    res.status(500).json({ message: 'Gagal membuat edukasi', error: (error as any)?.message || error, stack: (error as any)?.stack || null });
  }
};

export const updateEdukasi = async (req: Request<{ id: string }>, res: Response) => {
  try {
    console.log('[edukasi] update body:', req.body);

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

    const normalizedMediaType = String(mediaType).toUpperCase();
    if (normalizedMediaType !== 'IMAGE' && normalizedMediaType !== 'VIDEO') {
      return res.status(400).json({ message: 'mediaType harus IMAGE atau VIDEO' });
    }

    const updated = await prisma.edukasi.update({
      where: { id },
      data: {
        judul: judul.trim(),
        deskripsi: deskripsi ?? null,
        mediaUrl,
        mediaType: normalizedMediaType as 'IMAGE' | 'VIDEO',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updateEdukasi:', error);
    res.status(500).json({ message: 'Gagal memperbarui edukasi', error: (error as any)?.message || error });
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


