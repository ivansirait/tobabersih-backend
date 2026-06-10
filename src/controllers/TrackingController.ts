import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';

// ─── Helpers ────────────────────────────────────────────────
const getNamaHari = (date: Date): string => {
  const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  return days[date.getDay()];
};

// Untuk tracking real-time (hari ini dengan timezone WIB)
function getNamaHariIni(): string {
  const map: Record<number, string> = {
    0: 'MINGGU', 1: 'SENIN', 2: 'SELASA', 3: 'RABU',
    4: 'KAMIS', 5: 'JUMAT', 6: 'SABTU',
  };
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  return map[now.getDay()];
}

const capitalize = (str: string): string =>
  str.charAt(0) + str.slice(1).toLowerCase();

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
  // Query terpisah karena relasi tidak bisa di-include langsung
  const rute = await prisma.routeTemplate.findFirst({
    where: { truckId, dayOfWeek: hari, isActive: true },
    include: { waypoints: { orderBy: { order: 'asc' } } },
  });

  if (!rute) return null;

  return {
    hari:      rute.dayOfWeek,
    namaHari:  capitalize(rute.dayOfWeek),
    waypoints: rute.waypoints.map((wp) => ({
      urutan: wp.order,
      nama:   wp.name,
      lat:    wp.latitude,
      lng:    wp.longitude,
    })),
  };
}

// ============================================================
// GET: Truk aktif (status BUSY) - UNTUK TRACKING REAL-TIME
// ============================================================
export const getTrukAktif = async (req: Request, res: Response): Promise<any> => {
  try {
    const hariIni = getNamaHariIni();
    
    // console.log(`[DEBUG] Hari ini: ${hariIni}`);

    // ✅ PERUBAHAN: Hapus filter status 'BUSY' - tampilkan SEMUA truk yang punya jadwal hari ini
    const trukList = await prisma.truck.findMany({
      where: { 
        routesTemplate: {
          some: {
            dayOfWeek: hariIni,
            isActive: true,
          }
        }
      },
      include: {
        operator: {
          select: { id: true, fullName: true, phoneNumber: true },
        },
        tasks: {
          where: { status: { in: ['DITERIMA', 'DALAM_PERJALANAN', 'TIBA', 'BEKERJA'] } },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { status: true, location: true, district: true },
        },
        routesTemplate: {
          where: { dayOfWeek: hariIni, isActive: true },
          include: { waypoints: { orderBy: { order: 'asc' } } },
          take: 1,
        },
        locationHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { latitude: true, longitude: true, createdAt: true },
        },
      },
    });

    console.log(`[DEBUG] Jumlah truk dengan jadwal ${hariIni}: ${trukList.length}`);

    const formatted = trukList.map((truk) => {
      const lastLoc = truk.locationHistory[0] ?? null;
      const taskAktif = truk.tasks[0] ?? null;
      
      const ruteHariIni = truk.routesTemplate[0]
        ? {
            hari: truk.routesTemplate[0].dayOfWeek,
            namaHari: truk.routesTemplate[0].dayOfWeek,
            waypoints: truk.routesTemplate[0].waypoints.map((wp) => ({
              urutan: wp.order,
              nama: wp.name,
              lat: Number(wp.latitude),
              lng: Number(wp.longitude),
            })),
          }
        : null;

      return {
        id: truk.id.toString(),
        plateNumber: truk.plateNumber,
        status: truk.status,  // Bisa "AVAILABLE" atau "BUSY"
        currentLat: lastLoc ? Number(lastLoc.latitude) : (truk.currentLat ? Number(truk.currentLat) : null),
        currentLong: lastLoc ? Number(lastLoc.longitude) : (truk.currentLong ? Number(truk.currentLong) : null),
        lastPing: lastLoc?.createdAt?.toISOString() ?? truk.lastPing?.toISOString() ?? null,
        lastLocation: truk.lastLocation,
        operator: truk.operator
          ? { id: truk.operator.id.toString(), fullName: truk.operator.fullName, phoneNumber: truk.operator.phoneNumber }
          : null,
        taskAktif: taskAktif
          ? { status: taskAktif.status, location: taskAktif.location, district: taskAktif.district }
          : null,
        ruteHariIni,
      };
    });

    return res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    console.error('getTrukAktif error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
// ============================================================
// GET: Riwayat jalur truk berdasarkan tanggal
// ✅ Schema: relasi di Truck adalah "locationHistory" (bukan locationHistories)
// ============================================================
export const getRiwayatJalur = async (req: Request, res: Response): Promise<any> => {
  const { truckId } = req.params;
  const { tanggal } = req.query;

   const truckIdStr = Array.isArray(truckId) ? truckId[0] : truckId;

  try {
    const tglStr    = (tanggal as string) || new Date().toISOString().split('T')[0];
    const startDate = new Date(`${tglStr}T00:00:00+07:00`);
    const endDate   = new Date(`${tglStr}T23:59:59+07:00`);

    // ✅ Model: LocationHistory → table "location_history"
    const [history, truk] = await Promise.all([
      prisma.locationHistory.findMany({
        where: {
          truckId:   BigInt(truckIdStr),
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.truck.findUnique({
        where:   { id: BigInt(truckIdStr) },
        include: { operator: { select: { fullName: true, phoneNumber: true } } },
      }),
    ]);

    if (!truk) {
      return res.status(404).json({ success: false, message: 'Truk tidak ditemukan' });
    }

    const jalur = history.map((h) => ({
      lat:       Number(h.latitude),
      lng:       Number(h.longitude),
      timestamp: h.createdAt.toISOString(),
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
      const awal  = new Date(jalur[0].timestamp).getTime();
      const akhir = new Date(jalur[jalur.length - 1].timestamp).getTime();
      durasiMenit = Math.round((akhir - awal) / 60000);
    }

    const hariTanggal = getNamaHari(new Date(`${tglStr}T12:00:00+07:00`));
    const ruteJadwal  = await getRuteDariDB(BigInt(truckIdStr), hariTanggal);

    return res.status(200).json({
      success: true,
      data: {
        truckId:       truckId.toString(),
        plateNumber:   truk.plateNumber,
        operatorName:  truk.operator?.fullName  ?? null,
        operatorPhone: truk.operator?.phoneNumber ?? null,
        tanggal:       tglStr,
        hariKerja:     hariTanggal,
        totalTitik:    jalur.length,
        jarakTotalKm:  Math.round(jarakTotalKm * 100) / 100,
        durasiMenit,
        durasiJam:     Math.round((durasiMenit / 60) * 10) / 10,
        waktuMulai:    jalur.length > 0 ? jalur[0].timestamp : null,
        waktuSelesai:  jalur.length > 0 ? jalur[jalur.length - 1].timestamp : null,
        jalur,
        ruteJadwal,
      },
    });
  } catch (error: any) {
    console.error('getRiwayatJalur error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET: Ringkasan hasil kerja setelah rute selesai
// ✅ Task tidak punya volumeKg & notes → dihapus dari query
// ============================================================
export const getRingkasanHasil = async (req: Request, res: Response): Promise<any> => {
  const { truckId } = req.params;
  const { tanggal } = req.query;

    const truckIdStr = Array.isArray(truckId) ? truckId[0] : truckId;
  
  if (!truckIdStr || isNaN(Number(truckIdStr))) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID truk tidak valid' 
    });
  }

  try {
    const tglStr    = (tanggal as string) || new Date().toISOString().split('T')[0];
    const startDate = new Date(`${tglStr}T00:00:00+07:00`);
    const endDate   = new Date(`${tglStr}T23:59:59+07:00`);

    const [taskSelesai, history, truk] = await Promise.all([
      prisma.task.findMany({
        where: {
          truckId:     BigInt(truckIdStr),
          completedAt: { gte: startDate, lte: endDate },
          status:      'SELESAI',
        },
        include: {
          photos: true,
          // ✅ Report tidak punya jenisSampah di schema → hanya ambil description
          report: { select: { description: true } },
        },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.locationHistory.findMany({
        where: {
          truckId:   BigInt(truckIdStr),
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'asc' },
        select:  { latitude: true, longitude: true, createdAt: true },
      }),
      prisma.truck.findUnique({
        where:   { id: BigInt(truckIdStr) },
        include: { operator: { select: { fullName: true, phoneNumber: true } } },
      }),
    ]);

    if (!truk) {
      return res.status(404).json({ success: false, message: 'Truk tidak ditemukan' });
    }

    const jalur = history.map((h) => ({
      lat:       Number(h.latitude),
      lng:       Number(h.longitude),
      timestamp: h.createdAt.toISOString(),
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
      const awal  = new Date(jalur[0].timestamp).getTime();
      const akhir = new Date(jalur[jalur.length - 1].timestamp).getTime();
      durasiMenit = Math.round((akhir - awal) / 60000);
    }

    const hariKerja  = getNamaHari(new Date(`${tglStr}T12:00:00+07:00`));
    const ruteJadwal = await getRuteDariDB(BigInt(truckIdStr), hariKerja);

    return res.status(200).json({
      success: true,
      data: {
        truckId:       truckIdStr,
        plateNumber:   truk.plateNumber,
        operatorName:  truk.operator?.fullName  ?? null,
        operatorPhone: truk.operator?.phoneNumber ?? null,
        tanggal:       tglStr,
        hariKerja,
        ringkasan: {
          totalTaskSelesai: taskSelesai.length,
          jarakTempuhKm:    Math.round(jarakTotalKm * 100) / 100,
          durasiKerjaMenit: durasiMenit,
          durasiKerjaJam:   Math.round((durasiMenit / 60) * 10) / 10,
          waktuMulai:   jalur.length > 0 ? jalur[0].timestamp : null,
          waktuSelesai: jalur.length > 0 ? jalur[jalur.length - 1].timestamp : null,
        },
        // ✅ Task: field yang ada → id, location, district, completedAt, photos
        detailTask: taskSelesai.map((t) => ({
          id:          t.id.toString(),
          location:    t.location,
          district:    t.district,
          completedAt: t.completedAt,
          jumlahFoto:  t.photos.length,
          deskripsiLaporan: t.report?.description ?? null,
        })),
        jalurAktual: jalur,
        ruteJadwal,
      },
    });
  } catch (error: any) {
    console.error('getRingkasanHasil error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// ✅ GET: Riwayat SEMUA truk yang punya rekaman GPS di tanggal tsb
//    Route: GET /tracking/riwayat-selesai?tanggal=2026-06-04
//    ✅ Nama relasi di schema Truck: "locationHistory" (bukan locationHistories)
// ============================================================
export const getRiwayatSelesai = async (req: Request, res: Response): Promise<any> => {
  const { tanggal } = req.query;

  try {
    const tglStr    = (tanggal as string) || new Date().toISOString().split('T')[0];
    const startDate = new Date(`${tglStr}T00:00:00+07:00`);
    const endDate   = new Date(`${tglStr}T23:59:59+07:00`);

    // ✅ Nama relasi di schema Truck adalah "locationHistory" (field @relation)
    const trukDenganRiwayat = await prisma.truck.findMany({
      where: {
        locationHistory: {
          some: {
            createdAt: { gte: startDate, lte: endDate },
          },
        },
      },
      include: {
        operator: {
          select: { fullName: true, phoneNumber: true },
        },
        // ✅ Ambil hanya rekaman di tanggal itu, filter via where
        locationHistory: {
          where:   { createdAt: { gte: startDate, lte: endDate } },
          orderBy: { createdAt: 'asc' },
          select:  { latitude: true, longitude: true, createdAt: true },
        },
      },
    });

    const hasil = trukDenganRiwayat.map((truk) => {
      const history = truk.locationHistory;

      let jarakKm = 0;
      for (let i = 1; i < history.length; i++) {
        jarakKm += hitungJarak(
          Number(history[i - 1].latitude), Number(history[i - 1].longitude),
          Number(history[i].latitude),     Number(history[i].longitude)
        );
      }

      let durasiMenit = 0;
      if (history.length >= 2) {
        const awal  = history[0].createdAt.getTime();
        const akhir = history[history.length - 1].createdAt.getTime();
        durasiMenit = Math.round((akhir - awal) / 60000);
      }

      return {
        trukId:       truk.id.toString(),
        plateNumber:  truk.plateNumber,
        operatorName: truk.operator?.fullName ?? '-',
        status:       truk.status, // AVAILABLE = sudah selesai, BUSY = masih kerja
        tanggal:      tglStr,
        ringkasan: {
          totalTitikLokasi: history.length,
          jarakTempuhKm:    Math.round(jarakKm * 100) / 100,
          durasiKerjaMenit: durasiMenit,
          durasiKerjaJam:   Math.round((durasiMenit / 60) * 10) / 10,
          waktuMulai:   history.length > 0 ? history[0].createdAt.toISOString() : null,
          waktuSelesai: history.length > 0 ? history[history.length - 1].createdAt.toISOString() : null,
        },
      };
    });

    // Pisahkan: selesai (AVAILABLE) vs masih aktif (BUSY)
    // Frontend riwayat hanya perlu yang AVAILABLE, tapi kita kirim semua
    // biar frontend bisa filter sesuai kebutuhan
    return res.status(200).json({
      success: true,
      data:    hasil,
      meta: {
        tanggal: tglStr,
        total:   hasil.length,
        selesai: hasil.filter((h) => h.status === 'AVAILABLE').length,
        aktif:   hasil.filter((h) => h.status === 'BUSY').length,
      },
    });
  } catch (error: any) {
    console.error('getRiwayatSelesai error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET: Jadwal rute
// ============================================================
export const getJadwalRute = async (req: Request, res: Response): Promise<any> => {
  const { hari } = req.params;
  const { truckId } = req.query;

  try {
    // ✅ Fix: Pastikan hari adalah string tunggal
    const hariStr = Array.isArray(hari) ? hari[0] : hari;
    const hariUpper = (hariStr || '').toUpperCase();

    if (hariUpper === 'SEMUA') {
      const semua = await prisma.routeTemplate.findMany({
        where: {
          isActive: true,
          ...(truckId ? { truckId: BigInt(truckId as string) } : {}),
        },
        include: {
          truck:     { select: { plateNumber: true } },
          waypoints: { orderBy: { order: 'asc' } },
        },
        orderBy: [{ truck: { plateNumber: 'asc' } }, { dayOfWeek: 'asc' }],
      });
      return res.status(200).json({ success: true, data: semua });
    }

    const where: any = { dayOfWeek: hariUpper, isActive: true };
    if (truckId) where.truckId = BigInt(truckId as string);

    const rute = await prisma.routeTemplate.findFirst({
      where,
      include: { waypoints: { orderBy: { order: 'asc' } } },
    });

    if (!rute) {
      return res.status(404).json({
        success: false,
        message: `Tidak ada jadwal aktif untuk hari ${hariUpper}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        hari:      rute.dayOfWeek,
        namaHari:  capitalize(rute.dayOfWeek),
        waypoints: rute.waypoints.map((wp) => ({
          urutan: wp.order,
          nama:   wp.name,
          lat:    wp.latitude,
          lng:    wp.longitude,
        })),
      },
    });
  } catch (error: any) {
    console.error('getJadwalRute error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// POST: Supir kirim lokasi GPS dari HP
// ============================================================
export const updateLokasiTruk = async (req: Request, res: Response): Promise<any> => {
  const { truckId, latitude, longitude } = req.body;

  if (!truckId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      message: 'truckId, latitude, longitude wajib diisi',
    });
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ success: false, message: 'Koordinat tidak valid' });
  }

  try {
    await prisma.truck.update({
      where: { id: BigInt(truckId) },
      data: {
        currentLat:  lat.toString(),
        currentLong: lng.toString(),
        lastPing:    new Date(),
      },
    });

    // ✅ Model: LocationHistory (bukan locationHistories)
    await prisma.locationHistory.create({
      data: {
        truckId:   BigInt(truckId),
        latitude:  lat.toString(),
        longitude: lng.toString(),
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('truck_location_update', {
        truckId:   truckId.toString(),
        latitude:  lat,
        longitude: lng,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({ success: true, message: 'Lokasi berhasil diupdate' });
  } catch (error: any) {
    console.error('updateLokasiTruk error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// POST: Supir mulai kerja → status truk BUSY
// ============================================================
export const mulaiKerja = async (req: Request, res: Response): Promise<any> => {
  const { truckId } = req.body;

  if (!truckId) {
    return res.status(400).json({ success: false, message: 'truckId wajib diisi' });
  }

  try {
    const truk = await prisma.truck.findUnique({ where: { id: BigInt(truckId) } });

    if (!truk) {
      return res.status(404).json({ success: false, message: 'Truk tidak ditemukan' });
    }
    if (truk.status === 'BUSY') {
      return res.status(400).json({ success: false, message: 'Truk sudah dalam status bekerja' });
    }

    await prisma.truck.update({
      where: { id: BigInt(truckId) },
      data:  { status: 'BUSY', lastPing: new Date() },
    });

    const hariIni     = getNamaHari(new Date());
    const ruteHariIni = await getRuteDariDB(BigInt(truckId), hariIni);

    const io = req.app.get('io');
    if (io) {
      io.emit('truck_status_update', {
        truckId:     truckId.toString(),
        status:      'BUSY',
        plateNumber: truk.plateNumber,
        timestamp:   new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: `Truk ${truk.plateNumber} mulai beroperasi`,
      data: {
        truckId:     truckId.toString(),
        plateNumber: truk.plateNumber,
        hariKerja:   hariIni,
        ruteHariIni,
      },
    });
  } catch (error: any) {
    console.error('mulaiKerja error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// POST: Supir selesai kerja → status truk AVAILABLE
// ✅ Socket broadcast menyertakan ringkasan agar frontend langsung update riwayat
// ============================================================
export const selesaiKerja = async (req: Request, res: Response): Promise<any> => {
  const { truckId } = req.body;

  if (!truckId) {
    return res.status(400).json({ success: false, message: 'truckId wajib diisi' });
  }

  try {
    const truk = await prisma.truck.findUnique({
      where:   { id: BigInt(truckId) },
      include: { operator: { select: { fullName: true } } },
    });

    if (!truk) {
      return res.status(404).json({ success: false, message: 'Truk tidak ditemukan' });
    }
    if (truk.status !== 'BUSY') {
      return res.status(400).json({ success: false, message: 'Truk tidak dalam status bekerja' });
    }

    await prisma.truck.update({
      where: { id: BigInt(truckId) },
      data:  { status: 'AVAILABLE', lastPing: new Date() },
    });

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // ✅ Nama relasi Prisma: locationHistory
    const history = await prisma.locationHistory.findMany({
      where:   { truckId: BigInt(truckId), createdAt: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: 'asc' },
    });

    let jarakKm = 0;
    for (let i = 1; i < history.length; i++) {
      jarakKm += hitungJarak(
        Number(history[i - 1].latitude), Number(history[i - 1].longitude),
        Number(history[i].latitude),     Number(history[i].longitude)
      );
    }

    const durasiMenit =
      history.length >= 2
        ? Math.round(
            (history[history.length - 1].createdAt.getTime() -
              history[0].createdAt.getTime()) / 60000
          )
        : 0;

    const ringkasan = {
      totalTitikLokasi: history.length,
      jarakTempuhKm:    Math.round(jarakKm * 100) / 100,
      durasiKerjaMenit: durasiMenit,
      durasiKerjaJam:   Math.round((durasiMenit / 60) * 10) / 10,
      waktuMulai:   history.length > 0 ? history[0].createdAt.toISOString() : null,
      waktuSelesai: history.length > 0 ? history[history.length - 1].createdAt.toISOString() : null,
    };

    const io = req.app.get('io');
    if (io) {
      // ✅ Sertakan plateNumber, operatorName, tanggal agar frontend
      //    langsung tambah ke riwayat tanpa fetch ulang
      io.emit('truck_status_update', {
        truckId:      truckId.toString(),
        status:       'AVAILABLE',
        plateNumber:  truk.plateNumber,
        operatorName: truk.operator?.fullName ?? '-',
        tanggal:      new Date().toISOString(),
        timestamp:    new Date().toISOString(),
        data:         { ringkasan },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Truk ${truk.plateNumber} selesai beroperasi`,
      data:    { ringkasan },
    });
  } catch (error: any) {
    console.error('selesaiKerja error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET: Semua truk (untuk dropdown)
// ✅ Fix: typo "awaita" → "await"
// ============================================================
export const getSemuaTruk = async (req: Request, res: Response): Promise<any> => {
  try {
    const trukList = await prisma.truck.findMany({
      include: {
        operator: { select: { id: true, fullName: true, phoneNumber: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: trukList.map((truk) => ({
        id:           truk.id.toString(),
        plateNumber:  truk.plateNumber,
        status:       truk.status,
        brand:        truk.brand,
        truckType:    truk.truckType,
        unitCode:     truk.unitCode,
        operatorId:   truk.operatorId ? truk.operatorId.toString() : null,
        operator:     truk.operator
          ? { ...truk.operator, id: truk.operator.id.toString() }
          : null,
      })),
    });
  } catch (error: any) {
    console.error('getSemuaTruk error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET: Semua supir/operator (untuk dropdown)
// ============================================================
export const getSemuaSupir = async (req: Request, res: Response): Promise<any> => {
  try {
    const supirList = await prisma.user.findMany({
      where:  { role: 'OPERATOR' },
      select: { id: true, fullName: true, email: true, phoneNumber: true, isActive: true },
    });

    return res.status(200).json({
      success: true,
      data: supirList.map((s) => ({ ...s, id: s.id.toString() })),
    });
  } catch (error: any) {
    console.error('getSemuaSupir error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};