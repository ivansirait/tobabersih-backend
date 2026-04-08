import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';

// GET semua posts (yang published)
export const getPosts = async (req: Request, res: Response) => {
    try {
        const posts = await prisma.post.findMany({
            where: { isPublished: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(posts);
    } catch (error) {
        console.error('Error getPosts:', error);
        res.status(500).json({ message: 'Gagal mengambil data posts' });
    }
};

// GET satu post by id
export const getPostById = async (req: Request, res: Response) => {
    try {
        const post = await prisma.post.findUnique({
            where: { id: BigInt(req.params.id) },
        });
        if (!post) return res.status(404).json({ message: 'Post tidak ditemukan' });
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data post' });
    }
};

// POST buat post baru
export const createPost = async (req: Request, res: Response) => {
    try {
        const { title, content, imageUrl, category, slug } = req.body;
        const post = await prisma.post.create({
            data: { title, content, imageUrl, category, slug },
        });
        res.status(201).json(post);
    } catch (error) {
        console.error('Error createPost:', error);
        res.status(500).json({ message: 'Gagal membuat post' });
    }
};

// DELETE post
export const deletePost = async (req: Request, res: Response) => {
    try {
        await prisma.post.delete({ where: { id: BigInt(req.params.id) } });
        res.json({ message: 'Post berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus post' });
    }
};
