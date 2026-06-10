import type { Request, Response } from 'express';
import { prisma } from '../config/db.js'; 

// 1. Mengambil Daftar Laporan Baru yang belum ditugaskan (Bisa dipakai jika Supir boleh "Ambil Tugas" sendiri)
export const getAvailableTasks = async (req: Request, res: Response): Promise<any> => {
  try {
    const reports = await prisma.report.findMany({
      where: {
        status: 'PENDING',
        task: null, // Memastikan belum ada task (penugasan) yang dibuat untuk laporan ini
      },
      orderBy: {
        createdAt: 'desc', 
      },
    });

    // Format BigInt menjadi String agar tidak error saat dikirim sebagai JSON
    const formattedReports = reports.map(report => ({
      ...report,
      id: report.id.toString(),
      userId: report.userId.toString(),
      locationId: report.locationId ? report.locationId.toString() : null,
    }));

    return res.status(200).json({ success: true, data: formattedReports });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Mengubah Status Ketersediaan Supir (Aktif / Nonaktif)
export const toggleDriverStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { driverId, isAvailable } = req.body;

    // Di schema baru, Supir ada di tabel User dengan role OPERATOR
    // dan status aktifnya menggunakan kolom 'isActive'
    const updatedDriver = await prisma.user.update({
      where: { id: BigInt(driverId) },
      data: { isActive: isAvailable },
    });

    // Buang passwordHash agar tidak ikut terkirim ke frontend demi keamanan
    const { passwordHash: _, ...safeDriverData } = updatedDriver;

    return res.status(200).json({ 
      success: true, 
      message: 'Status berhasil diperbarui', 
      data: {
        ...safeDriverData,
        id: safeDriverData.id.toString()
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. TAMBAHAN BARU: Mengambil tugas khusus untuk supir yang sedang login (Dashboard Supir)
export const getDriverTasks = async (req: Request, res: Response): Promise<any> => {
  try {
    const { driverId } = req.params;
    const tasks = await prisma.task.findMany({
      where: { 
        driverId: BigInt(driverId),
      },
      include: {
        truck: { select: { plateNumber: true } },
        report: { select: { id: true, description: true } }
      },
      orderBy: { scheduledAt: 'asc' } // Urutkan jadwal terdekat di paling atas
    });

    // Format BigInt menjadi String
    const formattedTasks = tasks.map(task => ({
      ...task,
      id: task.id.toString(),
      driverId: task.driverId.toString(),
      assignerId: task.assignerId ? task.assignerId.toString() : null,
      truckId: task.truckId ? task.truckId.toString() : null,
      reportId: task.reportId ? task.reportId.toString() : null,
    }));

    return res.status(200).json({ success: true, data: formattedTasks });
  } catch (error: any) {
    console.error("ERROR FETCH DRIVER TASKS:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};