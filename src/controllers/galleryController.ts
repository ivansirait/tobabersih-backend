// galleryController.ts
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';

// NOTE: Prisma client yang ter-generate di project ini hanya mengekspose enum ScalarField,
// jadi untuk relasi/baca/tulis data gallery sebaiknya gunakan model yang sudah tersedia.
// Berdasarkan schema.prisma, modelnya adalah GalleryAlbum dan GalleryPhoto.

export const getAlbums = async (_req: Request, res: Response) => {
  try {
    // fallback: gunakan model dari Prisma jika tersedia
    const modelAlbum: any = (prisma as any).galleryAlbum ?? (prisma as any).gallery_albums;
    const modelPhoto: any = (prisma as any).galleryPhoto ?? (prisma as any).gallery_photos;

    if (!modelAlbum || !modelPhoto) {
      return res.status(500).json({ message: 'Prisma model gallery tidak tersedia' });
    }

    const albums = await modelAlbum.findMany({
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

export const getAlbumById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const albumId = parseInt(req.params.id, 10);
    if (Number.isNaN(albumId)) return res.status(400).json({ message: 'ID tidak valid' });

    const modelAlbum: any = (prisma as any).galleryAlbum ?? (prisma as any).gallery_albums;
    if (!modelAlbum) return res.status(500).json({ message: 'Prisma model galleryAlbum tidak tersedia' });

    const album = await modelAlbum.findUnique({
      where: { id: albumId },
      include: {
        photos: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!album) return res.status(404).json({ message: 'Album tidak ditemukan' });
    res.json(album);
  } catch (error) {
    console.error('Error getAlbumById:', error);
    res.status(500).json({ message: 'Gagal mengambil data album' });
  }
};

export const createAlbum = async (req: Request, res: Response) => {
  try {
    const { title, description, coverUrl } = req.body as {
      title?: string;
      description?: string;
      coverUrl?: string;
    };

    if (!title) return res.status(400).json({ message: 'Judul album wajib diisi' });

    const modelAlbum: any = (prisma as any).galleryAlbum ?? (prisma as any).gallery_albums;
    if (!modelAlbum) return res.status(500).json({ message: 'Prisma model galleryAlbum tidak tersedia' });

    const album = await modelAlbum.create({
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

export const updateAlbum = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const albumId = parseInt(req.params.id, 10);
    if (Number.isNaN(albumId)) return res.status(400).json({ message: 'ID tidak valid' });

    const { title, description, coverUrl } = req.body as {
      title?: string;
      description?: string;
      coverUrl?: string;
    };

    const modelAlbum: any = (prisma as any).galleryAlbum ?? (prisma as any).gallery_albums;
    if (!modelAlbum) return res.status(500).json({ message: 'Prisma model galleryAlbum tidak tersedia' });

    const album = await modelAlbum.update({
      where: { id: albumId },
      data: {
        title: title ?? undefined,
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

export const deleteAlbum = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const albumId = parseInt(req.params.id, 10);
    if (Number.isNaN(albumId)) return res.status(400).json({ message: 'ID tidak valid' });

    const modelAlbum: any = (prisma as any).galleryAlbum ?? (prisma as any).gallery_albums;
    const modelPhoto: any = (prisma as any).galleryPhoto ?? (prisma as any).gallery_photos;

    if (!modelAlbum || !modelPhoto) {
      return res.status(500).json({ message: 'Prisma model gallery tidak tersedia' });
    }

    await modelPhoto.deleteMany({ where: { albumId } });
    await modelAlbum.delete({ where: { id: albumId } });

    res.json({ message: 'Album berhasil dihapus' });
  } catch (error) {
    console.error('Error deleteAlbum:', error);
    res.status(500).json({ message: 'Gagal menghapus album' });
  }
};

export const addPhoto = async (req: Request<{ albumId: string }>, res: Response) => {
  try {
    const albumId = parseInt(req.params.albumId, 10);
    if (Number.isNaN(albumId)) return res.status(400).json({ message: 'ID Album tidak valid' });

    const { imageUrl, caption } = req.body as {
      imageUrl?: string;
      caption?: string;
    };

    if (!imageUrl) return res.status(400).json({ message: 'imageUrl wajib diisi' });

    const modelAlbum: any = (prisma as any).galleryAlbum ?? (prisma as any).gallery_albums;
    const modelPhoto: any = (prisma as any).galleryPhoto ?? (prisma as any).gallery_photos;

    if (!modelAlbum || !modelPhoto) {
      return res.status(500).json({ message: 'Prisma model gallery tidak tersedia' });
    }

    const album = await modelAlbum.findUnique({ where: { id: albumId } });
    if (!album) return res.status(404).json({ message: 'Album tidak ditemukan' });

    const photo = await modelPhoto.create({
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

export const deletePhoto = async (req: Request<{ photoId: string }>, res: Response) => {
  try {
    const photoId = parseInt(req.params.photoId, 10);
    if (Number.isNaN(photoId)) return res.status(400).json({ message: 'ID Foto tidak valid' });

    const modelPhoto: any = (prisma as any).galleryPhoto ?? (prisma as any).gallery_photos;
    if (!modelPhoto) return res.status(500).json({ message: 'Prisma model galleryPhoto tidak tersedia' });

    await modelPhoto.delete({ where: { id: photoId } });
    res.json({ message: 'Foto berhasil dihapus' });
  } catch (error) {
    console.error('Error deletePhoto:', error);
    res.status(500).json({ message: 'Gagal menghapus foto' });
  }
};

