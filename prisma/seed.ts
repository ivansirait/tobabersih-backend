import { PrismaClient, Category } from '@prisma/client'; // Tambahkan Category di sini
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Memulai proses Seeding...');

  const hashedPassword = await bcrypt.hash('sampah123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dlh.com' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'admin@dlh.com',
      fullName: 'Administrator DLH',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  // TENTUKAN TIPENYA DI SINI AGAR TIDAK ERROR (as { ... }[])
  const posts = [
    {
      title: 'Pengumuman Jadwal Baru Pengangkutan',
      slug: 'jadwal-baru-2026',
      content: 'Mulai Maret 2026, armada akan beroperasi mulai pukul 05.00 WIB...',
      category: Category.PENGUMUMAN, // Gunakan Enum Category
      isPublished: true,
      isFeatured: true,
      authorId: admin.id,
    },
    {
      title: 'Tips Memilah Sampah Organik di Rumah',
      slug: 'tips-pilah-sampah',
      content: 'Memilah sampah dari rumah membantu mempercepat proses pengolahan di TPA...',
      category: Category.BERITA, // Gunakan Enum Category
      isPublished: true,
      isFeatured: false,
      authorId: admin.id,
    }
  ];

  console.log('⏳ Menyinkronkan data berita...');

  for (const post of posts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        content: post.content,
        category: post.category, // Sekarang TypeScript sudah tahu ini Enum
        isPublished: post.isPublished,
        isFeatured: post.isFeatured,
        authorId: post.authorId,
      },
      create: post,
    });
  }

  console.log('✅ Seeding Selesai!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });