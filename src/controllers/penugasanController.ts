import type { Request, Response } from 'express';
import { prisma, supabase } from '../config/db.js';

// ─── Helper Firebase Cloud Messaging (FCM) ──────────────────────
const sendPushNotification = async (fcmToken: string, title: string, body: string) => {
  try {
    console.log(`[Firebase Service] Berhasil mengirim push notification ke token: ${fcmToken.substring(0, 15)}...`);
  } catch (error) {
    console.error("[Firebase Service Error] Gagal mengirim push notification:", error);
  }
};

// ─── Helper: Nama hari Indonesia dari Date Real-time (WIB) ──────
function getNamaHariIni(): string {
  const map: Record<number, string> = {
    0: 'MINGGU', 1: 'SENIN', 2: 'SELASA', 3: 'RABU',
    4: 'KAMIS', 5: 'JUMAT', 6: 'SABTU',
  };
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  return map[now.getDay()];
}

// ─── Helper: Nama hari Indonesia untuk Logika Histori/Riwayat ────
function getNamaHari(date: Date): string {
  const map: Record<number, string> = {
    0: 'MINGGU', 1: 'SENIN', 2: 'SELASA', 3: 'RABU',
    4: 'KAMIS', 5: 'JUMAT', 6: 'SABTU',
  };
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  return map[localDate.getDay()];
}

// ─── Buat Tugas Rutin ───────────────────────────────────────────
export const createRutin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { driverId, truckId, scheduledAt, location, notes } = req.body;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const taskNumber = `RUTIN-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTask = await prisma.task.create({
      data: {
        taskNumber,
        type: 'RUTIN',
        location,
        scheduledAt: new Date(scheduledAt),
        notes: notes || null,
        driverId: BigInt(driverId),
        truckId: truckId ? BigInt(truckId) : null,
      }
    });

    return res.status(201).json({ success: true, data: { ...newTask, id: newTask.id.toString() } });
  } catch (error: any) {
    console.error("ERROR CREATE RUTIN:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Buat Tugas Aduan ───────────────────────────────────────────
export const createAduan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { reportId, driverId, truckId, scheduledAt, location, district, description, notes } = req.body;

    if (!location) {
      return res.status(400).json({ success: false, message: "Field location wajib diisi." });
    }
    if (!driverId) {
      return res.status(400).json({ success: false, message: "Field driverId wajib diisi saat menugaskan aduan." });
    }
    if (!truckId) {
      return res.status(400).json({ success: false, message: "Field truckId wajib diisi saat menugaskan aduan." });
    }

    let taskLat: any = null;
    let taskLng: any = null;
    let pelaporFromReport: string | null = null;

    if (reportId) {
      const existingReport = await prisma.report.findUnique({
        where: { id: BigInt(reportId) },
        select: { latitude: true, longitude: true, pelapor: true }
      });

      if (existingReport) {
        taskLat = existingReport.latitude;
        taskLng = existingReport.longitude;
        pelaporFromReport = existingReport.pelapor ?? null;
      }

      const existingTask = await prisma.task.findFirst({
        where: { reportId: BigInt(reportId) }
      });

      if (existingTask) {
        return res.status(400).json({
          success: false,
          message: "Aduan ini sudah pernah dibuatkan penugasan sebelumnya."
        });
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const taskNumber = `ADUAN-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      const truck = await tx.truck.findUnique({ where: { id: BigInt(truckId) } });

      if (!truck) throw new Error("Truk tidak ditemukan.");
      if (truck.status === 'BUSY') throw new Error("Armada ini sedang bertugas. Pilih armada lain atau tunggu sampai selesai.");

      const driverBusy = await tx.task.findFirst({
        where: { driverId: BigInt(driverId), status: { not: 'SELESAI' } }
      });

      if (driverBusy) throw new Error("Supir ini sedang memiliki tugas aktif. Pilih supir lain atau tunggu sampai selesai.");

      const newTask = await tx.task.create({
        data: {
          taskNumber,
          type: 'ADUAN',
          location,
          district: district || null,
          description: description || null,
          notes: notes || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
          driverId: BigInt(driverId),
          truckId: BigInt(truckId),
          reportId: reportId ? BigInt(reportId) : null,
          latitude: taskLat,
          longitude: taskLng,
          pelapor: pelaporFromReport,
        }
      });

      await tx.truck.update({ where: { id: BigInt(truckId) }, data: { status: 'BUSY' } });

      if (reportId) {
        await tx.report.update({ where: { id: BigInt(reportId) }, data: { status: 'DITINDAKLANJUTI' } });
      }

      return newTask;
    });

    return res.status(201).json({
      success: true,
      data: {
        ...result,
        id: result.id.toString(),
        driverId: result.driverId?.toString() || null,
        truckId: result.truckId?.toString() || null,
        reportId: result.reportId?.toString() || null,
      }
    });

  } catch (error: any) {
    console.error("ERROR CREATE ADUAN:", error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: "Gagal: Nomor tugas atau ID laporan duplikat." });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Ambil Semua Data Penugasan ─────────────────────────────────
export const getSemuaPenugasan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { type, status, driverId } = req.query;
    let whereClause: any = {};

    if (type) whereClause.type = type;
    if (status) whereClause.status = status;
    if (driverId) whereClause.driverId = BigInt(driverId as string);

    const driverIdBigInt = driverId ? BigInt(driverId as string) : null;

    if (driverIdBigInt) {
      const hariIni = getNamaHariIni();

      const truck = await prisma.truck.findFirst({ where: { operatorId: driverIdBigInt } });

      if (truck) {
        const routeTemplate = await prisma.routeTemplate.findFirst({
          where: { truckId: truck.id, dayOfWeek: hariIni, isActive: true },
          include: { waypoints: { orderBy: { order: 'asc' } } }
        });

        if (routeTemplate && routeTemplate.waypoints.length > 0) {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const taskNumber = `RUTE-${truck.id}-${dateStr}`;

          const existingTask = await prisma.task.findUnique({ where: { taskNumber } });

          if (!existingTask) {
            const firstWp = routeTemplate.waypoints[0];
            await prisma.task.create({
              data: {
                taskNumber,
                type: 'RUTE',
                status: 'DITUGASKAN',
                location: routeTemplate.name,
                latitude: firstWp.latitude,
                longitude: firstWp.longitude,
                scheduledAt: new Date(),
                notes: `Rute Kerja Operasional Dump Truck - Hari ${hariIni}. Supir diwajibkan menyelesaikan seluruh rangkaian titik rute harian yang tersedia.`,
                driverId: driverIdBigInt,
                truckId: truck.id,
              }
            });
          }
        }
      }
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        driver: { select: { id: true, fullName: true } },
        truck:  { select: { id: true, plateNumber: true } },
        report: { select: { id: true, description: true, pelapor: true } }
      },
      orderBy: driverIdBigInt ? { scheduledAt: 'desc' } : { createdAt: 'desc' }
    });

    const formattedTasks = await Promise.all(tasks.map(async (task: any) => {
      let waypoints: any[] = [];

      if (task.type === 'RUTE' && task.truckId) {
        const hariTugas = getNamaHari(task.scheduledAt);

        const template = await prisma.routeTemplate.findFirst({
          where: { truckId: task.truckId, dayOfWeek: hariTugas, isActive: true },
          include: { waypoints: { orderBy: { order: 'asc' } } }
        });

        if (template) {
          waypoints = template.waypoints.map(wp => ({
            id:        wp.id.toString(),
            order:     wp.order,
            name:      wp.name,
            latitude:  Number(wp.latitude),
            longitude: Number(wp.longitude),
          }));
        }
      }

      return {
        ...task,
        id:         task.id.toString(),
        driverId:   task.driverId?.toString()   || null,
        truckId:    task.truckId?.toString()    || null,
        reportId:   task.reportId?.toString()   || null,
        assignerId: task.assignerId?.toString() || null,
        latitude:   task.latitude  ? Number(task.latitude)  : 0.0,
        longitude:  task.longitude ? Number(task.longitude) : 0.0,
        pelapor:    task.pelapor || task.report?.pelapor || null,
        waypoints,
        driver: task.driver ? { ...task.driver, id: task.driver.id.toString() } : null,
        truck:  task.truck  ? { ...task.truck,  id: task.truck.id.toString()  } : null,
        report: task.report ? { ...task.report, id: task.report.id.toString() } : null,
      };
    }));

    return res.status(200).json({ success: true, data: formattedTasks });
  } catch (error: any) {
    console.error("GET PENUGASAN ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Update Status Tugas (HP Supir) ─────────────────────────────
export const updateTaskStatus = async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const status  = req.body?.status;
  const files   = req.files as Express.Multer.File[];

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ success: false, message: "ID Tugas tidak valid" });
  }
  if (!status) {
    return res.status(400).json({ success: false, message: "Status wajib dikirim" });
  }

  try {
    const statusUpperCase = status.toUpperCase();
    const taskIdBigInt    = BigInt(id);

    const updatedTask = await prisma.task.update({
      where: { id: taskIdBigInt },
      data:  { status: statusUpperCase }
    });

    if (files && files.length > 0) {
      for (const file of files) {
        const fileName = `tugas_${id}_${Date.now()}-${file.originalname.replace(/\s/g, '_')}`;

        const { error } = await supabase.storage
          .from('Foto-sampah')
          .upload(fileName, file.buffer, { contentType: file.mimetype });

        if (!error) {
          const { data: publicUrlData } = supabase.storage
            .from('Foto-sampah')
            .getPublicUrl(fileName);

          await prisma.taskPhoto.create({
            data: {
              taskId:   taskIdBigInt,
              photoUrl: publicUrlData.publicUrl,
              type:     'SELESAI',
            }
          });
        } else {
          console.error("❌ Gagal upload ke Supabase Storage:", error.message);
        }
      }
    }

    if (updatedTask.reportId && statusUpperCase === 'SELESAI') {
      const updatedReport = await prisma.report.update({
        where:   { id: updatedTask.reportId },
        data:    { status: 'SELESAI' },
        include: { user: true }
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('status_laporan_berubah', {
          reportId:  updatedTask.reportId.toString(),
          newStatus: 'SELESAI'
        });
      }

      if (updatedReport.user && updatedReport.user.fcm_token) {
        await sendPushNotification(
          updatedReport.user.fcm_token,
          "Laporan Selesai! 🎉",
          "Tumpukan sampah yang kamu laporkan sudah berhasil diangkut oleh petugas. Terima kasih atas partisipasimu!"
        );
      }

      if (updatedReport.userId) {
        await prisma.notification.create({
          data: {
            userId:  updatedReport.userId,
            title:   "Laporan Selesai! 🎉",
            message: "Tumpukan sampah yang kamu laporkan sudah berhasil diangkut oleh petugas. Terima kasih!"
          }
        });
      }
    }

    return res.json({ success: true, message: "Status tugas dan bukti foto berhasil diperbarui" });

  } catch (error: any) {
    console.error("❌ ERROR DETAIL UPDATE TASK STATUS:", error);
    return res.status(500).json({
      success: false,
      message: `Gagal memperbarui status tugas. Error: ${error.message}`
    });
  }
};

// ─── Mengambil Riwayat Notifikasi Milik Seorang User ────────────
export const getNotifikasiUser = async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.params;

  if (!userId || isNaN(Number(userId))) {
    return res.status(400).json({ success: false, message: "ID User tidak valid" });
  }

  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: BigInt(userId) },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = notifications.map(n => ({
      ...n,
      id:     n.id.toString(),
      userId: n.userId.toString()
    }));

    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("ERROR GET NOTIFIKASI:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil notifikasi" });
  }
}; // ✅ Kurung tutup getNotifikasiUser — sekarang benar

// ─── Hapus Penugasan ────────────────────────────────────────────
export const deletePenugasan = async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ success: false, message: "ID tidak valid" });
  }

  try {
    const taskId = BigInt(id);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { truck: true }
    });

    if (!task) {
      return res.status(404).json({ success: false, message: "Penugasan tidak ditemukan" });
    }

    await prisma.$transaction(async (tx) => {
      // Hapus TaskPhoto dulu agar tidak ada constraint violation
      await tx.taskPhoto.deleteMany({ where: { taskId } });

      // Hapus task utama
      await tx.task.delete({ where: { id: taskId } });

      // Reset status truk kembali ke AVAILABLE
      if (task.truckId && task.truck?.status === 'BUSY') {
        await tx.truck.update({
          where: { id: task.truckId },
          data:  { status: 'AVAILABLE' }
        });
      }

      // Reset status laporan asal ke PENDING
      if (task.reportId) {
        await tx.report.update({
          where: { id: task.reportId },
          data:  { status: 'PENDING' }
        });
      }
    });

    return res.json({ success: true, message: "Penugasan berhasil dihapus" });

  } catch (error: any) {
    console.error("ERROR DELETE PENUGASAN:", error);
    return res.status(500).json({ success: false, message: "Gagal menghapus penugasan: " + error.message });
  }
};