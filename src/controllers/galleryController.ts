import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';

// GET semua album (beserta jumlah foto)
export const getAlbums = async (req: Request, res: Response) => {
  try {
    const albums = await prisma.galleryAlbum.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        photos: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    res.json(albums);
  } catch (error) {
    console.error('Error getAlbums:', error);
    res.status(500).json({ message: 'Gagal mengambil data album' });
  }
};

// GET satu album by id (beserta semua foto)
export const getAlbumById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const album = await prisma.galleryAlbum.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        photos: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!album) return res.status(404).json({ message: 'Album tidak ditemukan' });
    res.json(album);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data album' });
  }
};

// POST buat album baru
export const createAlbum = async (req: Request, res: Response) => {
  try {
    const { title, description, coverUrl } = req.body;
    if (!title) return res.status(400).json({ message: 'Judul album wajib diisi' });

    const album = await prisma.galleryAlbum.create({
      data: {
        title,
        description: description || null,
        coverUrl: coverUrl || null,
      },
      include: { photos: true },
    });
    res.status(201).json(album);
  } catch (error) {
    console.error('Error createAlbum:', error);
    res.status(500).json({ message: 'Gagal membuat album' });
  }
};

// PUT update album
export const updateAlbum = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { title, description, coverUrl } = req.body;
    const album = await prisma.galleryAlbum.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        description: description || null,
        coverUrl: coverUrl || null,
      },
      include: { photos: true },
    });
    res.json(album);
  } catch (error) {
    console.error('Error updateAlbum:', error);
    res.status(500).json({ message: 'Gagal memperbarui album' });
  }
};

// DELETE album (beserta semua fotonya)
export const deleteAlbum = async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.galleryPhoto.deleteMany({
      where: { albumId: parseInt(req.params.id) },
    });
    await prisma.galleryAlbum.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Album berhasil dihapus' });
  } catch (error) {
    console.error('Error deleteAlbum:', error);
    res.status(500).json({ message: 'Gagal menghapus album' });
  }
};

// ─── FOTO ────────────────────────────────────────────────────────

// POST tambah foto ke album
export const addPhoto = async (req: Request<{ albumId: string }>, res: Response) => {
  try {
    const albumId = parseInt(req.params.albumId);
    const { imageUrl, caption } = req.body;

    if (!imageUrl) return res.status(400).json({ message: 'imageUrl wajib diisi' });

    const album = await prisma.galleryAlbum.findUnique({ where: { id: albumId } });
    if (!album) return res.status(404).json({ message: 'Album tidak ditemukan' });

    const photo = await prisma.galleryPhoto.create({
      data: {
        albumId,
        imageUrl,
        caption: caption || null,
      },
    });
    res.status(201).json(photo);
  } catch (error) {
    console.error('Error addPhoto:', error);
    res.status(500).json({ message: 'Gagal menambahkan foto' });
  }
};

// DELETE foto
export const deletePhoto = async (req: Request<{ photoId: string }>, res: Response) => {
  try {
    await prisma.galleryPhoto.delete({
      where: { id: parseInt(req.params.photoId) },
    });
    res.json({ message: 'Foto berhasil dihapus' });
  } catch (error) {
    console.error('Error deletePhoto:', error);
    res.status(500).json({ message: 'Gagal menghapus foto' });
  }
};