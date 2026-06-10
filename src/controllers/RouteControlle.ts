import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';

const HARI_VALID = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

function getNamaHari(date: Date): string {
  const map: Record<number, string> = {
    0: 'MINGGU', 1: 'SENIN', 2: 'SELASA', 3: 'RABU',
    4: 'KAMIS', 5: 'JUMAT', 6: 'SABTU',
  };
  return map[date.getDay()];
}

function hitungJarak(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getRuteDariDB(truckId: bigint, hari: string) {
  try {
    const rute = await prisma.routeTemplate.findFirst({
      where: { truckId, dayOfWeek: hari, isActive: true },
      include: { waypoints: { orderBy: { order: 'asc' } } },
    });
    if (!rute) return null;
    return {
      hari: rute.dayOfWeek,
      namaHari: rute.dayOfWeek,
      waypoints: rute.waypoints.map((wp) => ({
        urutan: wp.order,
        nama: wp.name,
        lat: Number(wp.latitude),
        lng: Number(wp.longitude),
      })),
    };
  } catch {
    return null;
  }
}

// ============================================================
// GET: Semua rute template
// ============================================================
export const getSemuaRute = async (req: Request, res: Response): Promise<any> => {
  try {
    const { truckId, hari } = req.query;
    const where: any = {};
    if (truckId) where.truckId = BigInt(truckId as string);
    if (hari)    where.dayOfWeek = (hari as string).toUpperCase();

    const rute = await prisma.routeTemplate.findMany({
      where,
      include: {
        truck: { select: { id: true, plateNumber: true } },
        waypoints: { orderBy: { order: 'asc' } },
        _count: { select: { waypoints: true } }
      },
      orderBy: [{ truck: { plateNumber: 'asc' } }, { dayOfWeek: 'asc' }]
    });

    const formatted = rute.map(r => ({
      ...r,
      id:      r.id.toString(),
      truckId: r.truckId.toString(),
      truck:   { ...r.truck, id: r.truck.id.toString() },
      waypoints: r.waypoints.map(wp => ({
        ...wp,
        id:      wp.id.toString(),
        routeId: wp.routeId.toString(),
      })),
      totalWaypoint: r._count.waypoints,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    console.error('getSemuaRute error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET: Detail satu rute + waypoints
// ============================================================
export const getDetailRute = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ruteId } = req.params;

    const rute = await prisma.routeTemplate.findUnique({
      where: { id: BigInt(ruteId as string) },  // ✅ Fix
      include: {
        truck: { select: { id: true, plateNumber: true } },
        waypoints: { orderBy: { order: 'asc' } }
      }
    });

    if (!rute) {
      return res.status(404).json({ success: false, message: 'Rute tidak ditemukan' });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...rute,
        id:      rute.id.toString(),
        truckId: rute.truckId.toString(),
        truck:   { ...rute.truck, id: rute.truck.id.toString() },
        waypoints: rute.waypoints.map(wp => ({
          ...wp,
          id:      wp.id.toString(),
          routeId: wp.routeId.toString(),
        }))
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// POST: Buat rute template baru
// ============================================================
export const buatRute = async (req: Request, res: Response): Promise<any> => {
  try {
    const { truckId, dayOfWeek, name, isActive } = req.body;

    if (!truckId || !dayOfWeek || !name) {
      return res.status(400).json({
        success: false,
        message: 'truckId, dayOfWeek, dan name wajib diisi'
      });
    }

    const hariUpper = dayOfWeek.toUpperCase();
    if (!HARI_VALID.includes(hariUpper)) {
      return res.status(400).json({
        success: false,
        message: `dayOfWeek tidak valid. Pilihan: ${HARI_VALID.join(', ')}`
      });
    }

    const truk = await prisma.truck.findUnique({ where: { id: BigInt(truckId as string) } });  // ✅ Fix
    if (!truk) {
      return res.status(404).json({ success: false, message: 'Truk tidak ditemukan' });
    }

    const existing = await prisma.routeTemplate.findFirst({
      where: { truckId: BigInt(truckId as string), dayOfWeek: hariUpper }  // ✅ Fix
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Rute untuk truk ${truk.plateNumber} hari ${hariUpper} sudah ada`
      });
    }

    const rute = await prisma.routeTemplate.create({
      data: {
        truckId:   BigInt(truckId as string),  // ✅ Fix
        dayOfWeek: hariUpper,
        name,
        isActive:  isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        truck: { select: { id: true, plateNumber: true } },
        waypoints: true
      }
    });

    return res.status(201).json({
      success: true,
      message: `Rute ${name} berhasil dibuat`,
      data: {
        ...rute,
        id:      rute.id.toString(),
        truckId: rute.truckId.toString(),
        truck:   { ...rute.truck, id: rute.truck.id.toString() },
      }
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Rute untuk kombinasi truk & hari ini sudah ada' });
    }
    console.error('buatRute error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// PUT: Update info rute
// ============================================================
export const updateRute = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ruteId } = req.params;
    const { name, isActive, truckId, dayOfWeek } = req.body;

    const existing = await prisma.routeTemplate.findUnique({
      where: { id: BigInt(ruteId as string) },  // ✅ Fix
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Rute tidak ditemukan' });
    }

    if (dayOfWeek) {
      const hariUpper = (dayOfWeek as string).toUpperCase();
      if (!HARI_VALID.includes(hariUpper)) {
        return res.status(400).json({
          success: false,
          message: `dayOfWeek tidak valid. Pilihan: ${HARI_VALID.join(', ')}`,
        });
      }
    }

    const newTruckId   = truckId   ? BigInt(truckId as string)                   : existing.truckId;  // ✅ Fix
    const newDayOfWeek = dayOfWeek ? (dayOfWeek as string).toUpperCase()          : existing.dayOfWeek;

    if (
      newTruckId.toString() !== existing.truckId.toString() ||
      newDayOfWeek !== existing.dayOfWeek
    ) {
      const duplikat = await prisma.routeTemplate.findFirst({
        where: {
          truckId:   newTruckId,
          dayOfWeek: newDayOfWeek,
          id:        { not: BigInt(ruteId as string) },  // ✅ Fix
        },
      });
      if (duplikat) {
        return res.status(400).json({
          success: false,
          message: `Rute untuk kombinasi truk & hari ${newDayOfWeek} ini sudah ada`,
        });
      }
    }

    const updated = await prisma.routeTemplate.update({
      where: { id: BigInt(ruteId as string) },  // ✅ Fix
      data: {
        name:      name     !== undefined ? name               : existing.name,
        isActive:  isActive !== undefined ? Boolean(isActive)  : existing.isActive,
        truckId:   newTruckId,
        dayOfWeek: newDayOfWeek,
      },
      include: {
        truck:     { select: { id: true, plateNumber: true } },
        waypoints: { orderBy: { order: 'asc' } },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        ...updated,
        id:      updated.id.toString(),
        truckId: updated.truckId.toString(),
        truck:   { ...updated.truck, id: updated.truck.id.toString() },
        waypoints: updated.waypoints.map(wp => ({
          ...wp,
          id:      wp.id.toString(),
          routeId: wp.routeId.toString(),
        }))
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// DELETE: Hapus rute + semua waypointnya
// ============================================================
export const hapusRute = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ruteId } = req.params;

    const existing = await prisma.routeTemplate.findUnique({
      where: { id: BigInt(ruteId as string) }  // ✅ Fix
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Rute tidak ditemukan' });
    }

    await prisma.routeTemplate.delete({ where: { id: BigInt(ruteId as string) } });  // ✅ Fix

    return res.status(200).json({ success: true, message: 'Rute berhasil dihapus' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// PATCH: Toggle aktif/nonaktif rute
// ============================================================
export const toggleStatusRute = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ruteId } = req.params;

    const existing = await prisma.routeTemplate.findUnique({
      where: { id: BigInt(ruteId as string) }  // ✅ Fix
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Rute tidak ditemukan' });
    }

    const updated = await prisma.routeTemplate.update({
      where: { id: BigInt(ruteId as string) },  // ✅ Fix
      data:  { isActive: !existing.isActive },
    });

    return res.status(200).json({
      success: true,
      message: `Rute ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
      data: { ...updated, id: updated.id.toString(), truckId: updated.truckId.toString() },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// POST: Tambah waypoint ke rute
// ============================================================
export const tambahWaypoint = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ruteId } = req.params;
    const { name, latitude, longitude, order, bulk } = req.body;

    const rute = await prisma.routeTemplate.findUnique({
      where: { id: BigInt(ruteId as string) }  // ✅ Fix
    });
    if (!rute) {
      return res.status(404).json({ success: false, message: 'Rute tidak ditemukan' });
    }

    if (bulk && Array.isArray(bulk)) {
      await prisma.routeWaypoint.deleteMany({ where: { routeId: BigInt(ruteId as string) } });  // ✅ Fix

      const created = await prisma.$transaction(
        bulk.map((wp: any, idx: number) =>
          prisma.routeWaypoint.create({
            data: {
              routeId:   BigInt(ruteId as string),  // ✅ Fix
              order:     wp.order ?? idx + 1,
              name:      wp.name,
              latitude:  Number(wp.latitude),
              longitude: Number(wp.longitude),
            }
          })
        )
      );

      return res.status(201).json({
        success: true,
        message: `${created.length} waypoint berhasil disimpan`,
        data: created.map(wp => ({
          ...wp, id: wp.id.toString(), routeId: wp.routeId.toString()
        }))
      });
    }

    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'name, latitude, longitude wajib diisi'
      });
    }

    let urutan = order;
    if (!urutan) {
      const maxOrder = await prisma.routeWaypoint.aggregate({
        where: { routeId: BigInt(ruteId as string) },  // ✅ Fix
        _max: { order: true }
      });
      urutan = (maxOrder._max.order ?? 0) + 1;
    }

    const wp = await prisma.routeWaypoint.create({
      data: {
        routeId:   BigInt(ruteId as string),  // ✅ Fix
        order:     urutan,
        name,
        latitude:  Number(latitude),
        longitude: Number(longitude),
      }
    });

    return res.status(201).json({
      success: true,
      data: { ...wp, id: wp.id.toString(), routeId: wp.routeId.toString() }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// PUT: Update satu waypoint
// ============================================================
export const updateWaypoint = async (req: Request, res: Response): Promise<any> => {
  try {
    const { waypointId } = req.params;
    const { name, latitude, longitude, order } = req.body;

    const existing = await prisma.routeWaypoint.findUnique({
      where: { id: BigInt(waypointId as string) }  // ✅ Fix
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Waypoint tidak ditemukan' });
    }

    const updated = await prisma.routeWaypoint.update({
      where: { id: BigInt(waypointId as string) },  // ✅ Fix
      data: {
        name:      name      !== undefined ? name               : existing.name,
        latitude:  latitude  !== undefined ? Number(latitude)   : existing.latitude,
        longitude: longitude !== undefined ? Number(longitude)  : existing.longitude,
        order:     order     !== undefined ? Number(order)      : existing.order,
      }
    });

    return res.status(200).json({
      success: true,
      data: { ...updated, id: updated.id.toString(), routeId: updated.routeId.toString() }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// DELETE: Hapus satu waypoint + re-order sisanya
// ============================================================
export const hapusWaypoint = async (req: Request, res: Response): Promise<any> => {
  try {
    const { waypointId } = req.params;

    const existing = await prisma.routeWaypoint.findUnique({
      where: { id: BigInt(waypointId as string) }  // ✅ Fix
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Waypoint tidak ditemukan' });
    }

    const routeId      = existing.routeId;
    const deletedOrder = existing.order;

    await prisma.$transaction([
      prisma.routeWaypoint.delete({ where: { id: BigInt(waypointId as string) } }),  // ✅ Fix
      prisma.routeWaypoint.updateMany({
        where: { routeId, order: { gt: deletedOrder } },
        data:  { order: { decrement: 1 } }
      })
    ]);

    return res.status(200).json({ success: true, message: 'Waypoint berhasil dihapus' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// PUT: Reorder semua waypoint
// ============================================================
export const reorderWaypoints = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ruteId } = req.params;
    const { urutan } = req.body;

    if (!Array.isArray(urutan)) {
      return res.status(400).json({ success: false, message: 'urutan harus berupa array' });
    }

    await prisma.$transaction(
      urutan.map((item: { id: string; order: number }) =>
        prisma.routeWaypoint.update({
          where: { id: BigInt(item.id) },
          data:  { order: item.order }
        })
      )
    );

    return res.status(200).json({ success: true, message: 'Urutan waypoint berhasil diperbarui' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET: Ringkasan hasil operasional truk
// ============================================================
export const getRingkasanHasil = async (req: Request, res: Response): Promise<any> => {
  const { truckId } = req.params;
  const { tanggal } = req.query;

  try {
    const tglStr    = (tanggal as string) || new Date().toISOString().split('T')[0];
    const startDate = new Date(`${tglStr}T00:00:00+07:00`);
    const endDate   = new Date(`${tglStr}T23:59:59+07:00`);

    const [history, truk] = await Promise.all([
      prisma.locationHistory.findMany({
        where: {
          truckId:   BigInt(truckId as string),  // ✅ Fix
          createdAt: { gte: startDate, lte: endDate }
        },
        orderBy: { createdAt: 'asc' },
        select: { latitude: true, longitude: true, createdAt: true }
      }),
      prisma.truck.findUnique({
        where: { id: BigInt(truckId as string) },  // ✅ Fix
        include: { operator: { select: { fullName: true, phoneNumber: true } } }
      })
    ]);

    if (!truk) {
      return res.status(404).json({ success: false, message: 'Truk tidak ditemukan' });
    }

    let taskSelesai: any[] = [];
    try {
      taskSelesai = await prisma.task.findMany({
        where: {
          truckId:     BigInt(truckId as string),  // ✅ Fix
          completedAt: { gte: startDate, lte: endDate },
          status:      'SELESAI'
        },
        orderBy: { completedAt: 'asc' }
      });
    } catch (taskErr) {
      console.warn('getRingkasanHasil: query task gagal:', taskErr);
      taskSelesai = [];
    }

    const jalur = history.map(h => ({
      lat:       Number(h.latitude),
      lng:       Number(h.longitude),
      timestamp: h.createdAt.toISOString()
    }));

    let jarakTotalKm = 0;
    for (let i = 1; i < jalur.length; i++) {
      jarakTotalKm += hitungJarak(
        jalur[i - 1].lat, jalur[i - 1].lng,
        jalur[i].lat,     jalur[i].lng
      );
    }

    let durasiMenit = 0;
    if (jalur.length >= 2) {
      durasiMenit = Math.round(
        (new Date(jalur[jalur.length - 1].timestamp).getTime() - new Date(jalur[0].timestamp).getTime()) / 60000
      );
    }

    const hariKerja  = getNamaHari(new Date(`${tglStr}T12:00:00+07:00`));
    const ruteJadwal = await getRuteDariDB(BigInt(truckId as string), hariKerja);  // ✅ Fix

    return res.status(200).json({
      success: true,
      data: {
        truckId:       truckId.toString(),
        plateNumber:   truk.plateNumber,
        operatorName:  truk.operator?.fullName,
        operatorPhone: truk.operator?.phoneNumber,
        tanggal:       tglStr,
        hariKerja,
        ringkasan: {
          totalTaskSelesai:    taskSelesai.length,
          totalVolumeSampahKg: 0,
          jarakTempuhKm:       Math.round(jarakTotalKm * 100) / 100,
          durasiKerjaMenit:    durasiMenit,
          durasiKerjaJam:      Math.round((durasiMenit / 60) * 10) / 10,
          waktuMulai:   jalur.length > 0 ? jalur[0].timestamp : null,
          waktuSelesai: jalur.length > 0 ? jalur[jalur.length - 1].timestamp : null,
        },
        detailTask: taskSelesai.map((t: any) => ({
          id:          t.id?.toString(),
          location:    t.location,
          district:    t.district,
          completedAt: t.completedAt,
          volumeKg:    t.volumeKg ? Number(t.volumeKg) : null,
          notes:       t.notes,
          jumlahFoto:  0
        })),
        jalurAktual: jalur,
        ruteJadwal
      }
    });
  } catch (error: any) {
    console.error('getRingkasanHasil error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};