import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';

// Buat Tugas Rutin
export const createRutin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { driverId, truckId, scheduledAt, location, notes } = req.body;

    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
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

// Buat Tugas Aduan
export const createAduan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { reportId, driverId, truckId, scheduledAt, location, district, description, notes } = req.body;

    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const taskNumber = `ADUAN-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTask = await prisma.task.create({
      data: {
        taskNumber,
        type: 'ADUAN',
        location,
        district: district || null,
        description: description || null,
        notes: notes || null,
        scheduledAt: new Date(scheduledAt),
        driverId: BigInt(driverId),
        truckId: truckId ? BigInt(truckId) : null,
        reportId: reportId ? BigInt(reportId) : null,
      }
    });

    // Otomatis ubah status laporan warga menjadi DITINDAKLANJUTI (sesuai enum kamu)
    if (reportId) {
      await prisma.report.update({
        where: { id: BigInt(reportId) },
        data: { status: 'DITINDAKLANJUTI' }
      });
    }

    return res.status(201).json({ success: true, data: { ...newTask, id: newTask.id.toString() } });
  } catch (error: any) {
    console.error("ERROR CREATE ADUAN:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Ambil Semua Data Penugasan
export const getSemuaPenugasan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { type, status } = req.query;
    let whereClause: any = {};

    if (type) whereClause.type = type;
    if (status) whereClause.status = status;

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        driver: { select: { id: true, fullName: true } },
        truck: { select: { id: true, plateNumber: true } },
        report: { select: { id: true, description: true } }
      },
      orderBy: { scheduledAt: 'desc' }
    });

    const formattedTasks = tasks.map(task => ({
      ...task,
      id: task.id.toString(),
      driverId: task.driverId.toString(),
      truckId: task.truckId ? task.truckId.toString() : null,
      reportId: task.reportId ? task.reportId.toString() : null,
      driver: { ...task.driver, id: task.driver.id.toString() },
      truck: task.truck ? { ...task.truck, id: task.truck.id.toString() } : null,
      report: task.report ? { ...task.report, id: task.report.id.toString() } : null,
    }));

    return res.status(200).json({ success: true, data: formattedTasks });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};