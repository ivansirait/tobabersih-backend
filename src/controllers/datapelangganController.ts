import { prisma } from "../config/db.js";
import * as XLSX from "xlsx";

// ─── Helper ────────────────────────────────────────────────────────────────

const sanitize = (p: any) => ({
  ...p,
  id: p.id.toString(),
  driverId: p.driverId?.toString() ?? null,
  driverName: p.driver?.fullName ?? null,
});

// ─── GET PELANGGAN (with pagination + search + filter by driver) ───────────

export const getPelanggan = async (req: any, res: any) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string)  || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 12);
    const skip  = (page - 1) * limit;
    const search   = (req.query.search   as string) ?? "";
    const driverId = req.query.driverId  as string;

    const where: any = {
      ...(driverId ? { driverId: BigInt(driverId) } : {}),
      ...(search
        ? {
            OR: [
              { nama:       { contains: search, mode: "insensitive" } },
              { alamat:     { contains: search, mode: "insensitive" } },
              { jenisUsaha: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.pelanggan.findMany({
        where,
        include: { driver: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.pelanggan.count({ where }),
    ]);

    res.json({
      success: true,
      data: data.map(sanitize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    console.error("GET PELANGGAN ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal ambil data pelanggan" });
  }
};

// ─── GET SINGLE ────────────────────────────────────────────────────────────

export const getPelangganById = async (req: any, res: any) => {
  try {
    const item = await prisma.pelanggan.findUnique({
      where: { id: BigInt(req.params.id) },
      include: { driver: { select: { id: true, fullName: true } } },
    });
    if (!item) return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    res.json({ success: true, data: sanitize(item) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal ambil data" });
  }
};

// ─── CREATE ────────────────────────────────────────────────────────────────

export const createPelanggan = async (req: any, res: any) => {
  try {
    const { nama, alamat, jenisUsaha, driverId } = req.body;

    if (!nama?.trim()) {
      return res.status(400).json({ success: false, message: "Nama pelanggan wajib diisi" });
    }

    const item = await prisma.pelanggan.create({
      data: {
        nama:       nama.trim(),
        alamat:     alamat?.trim()     ?? "",
        jenisUsaha: jenisUsaha?.trim() ?? "Rumah Tangga",
        driverId:   driverId ? BigInt(driverId) : undefined,
      },
      include: { driver: { select: { id: true, fullName: true } } },
    });

    res.json({ success: true, data: sanitize(item) });
  } catch (err: any) {
    console.error("CREATE PELANGGAN ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal tambah pelanggan", error: err.message });
  }
};

// ─── BULK CREATE (import Excel) ────────────────────────────────────────────

export const bulkCreatePelanggan = async (req: any, res: any) => {
  try {
    const { pelanggan, driverId } = req.body;

    if (!Array.isArray(pelanggan) || pelanggan.length === 0) {
      return res.status(400).json({ success: false, message: "Data tidak valid atau kosong" });
    }
    if (pelanggan.length > 500) {
      return res.status(400).json({ success: false, message: "Maksimal 500 baris per import" });
    }

    const results: { nama: string; status: string; message: string }[] = [];
    let successCount = 0;
    let errorCount   = 0;

    for (const row of pelanggan) {
      const { nama, alamat, jenisUsaha } = row;

      if (!nama?.trim()) {
        results.push({ nama: nama || "kosong", status: "error", message: "Nama wajib diisi" });
        errorCount++;
        continue;
      }

      try {
      await prisma.pelanggan.create({
        data: {
          nama:       nama.trim(),
          alamat:     alamat?.trim()     ?? "",
          jenisUsaha: jenisUsaha?.trim() ?? "Rumah Tangga",
          driverId:   driverId ? BigInt(driverId) : undefined,
        },
      });
        results.push({ nama: nama.trim(), status: "success", message: "Berhasil didaftarkan" });
        successCount++;
      } catch (err: any) {
        results.push({ nama: nama.trim(), status: "error", message: err.message || "Gagal" });
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Import selesai: ${successCount} berhasil, ${errorCount} gagal`,
      summary: { total: pelanggan.length, success: successCount, error: errorCount },
      results,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal import data", error: err.message });
  }
};

// ─── UPDATE ────────────────────────────────────────────────────────────────

export const updatePelanggan = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { nama, alamat, jenisUsaha, driverId } = req.body;

    const existing = await prisma.pelanggan.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan" });

    const item = await prisma.pelanggan.update({
      where: { id: BigInt(id) },
      data: {
        nama:       nama?.trim()       ?? existing.nama,
        alamat:     alamat?.trim()     ?? existing.alamat,
        jenisUsaha: jenisUsaha?.trim() ?? existing.jenisUsaha,
        driverId: driverId !== undefined
          ? (driverId ? BigInt(driverId) : null)
          : existing.driverId,
      },
      include: { driver: { select: { id: true, fullName: true } } },
    });

    res.json({ success: true, data: sanitize(item) });
  } catch (err: any) {
    console.error("UPDATE PELANGGAN ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal update pelanggan", error: err.message });
  }
};

// ─── DELETE ────────────────────────────────────────────────────────────────

export const deletePelanggan = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const existing = await prisma.pelanggan.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan" });

    await prisma.pelanggan.delete({ where: { id: BigInt(id) } });
    res.json({ success: true, message: "Pelanggan berhasil dihapus" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal hapus pelanggan", error: err.message });
  }
};

// ─── Helper: build worksheet ───────────────────────────────────────────────

const buildWorksheet = (rows: any[]) => {
  const data = rows.map((p, i) => ({
    No:               i + 1,
    "Nama Pelanggan": p.nama,
    Alamat:           p.alamat      || "",
    "Jenis Usaha":    p.jenisUsaha  || "Rumah Tangga",
    Supir:            p.driver?.fullName || "Tanpa Supir",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 32 }, { wch: 20 }, { wch: 22 }];
  return ws;
};

// ─── EXPORT ALL (semua pelanggan, 1 sheet per supir) ──────────────────────

export const exportPelanggan = async (_req: any, res: any) => {
  try {
    const all = await prisma.pelanggan.findMany({
      include: { driver: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildWorksheet(all), "Semua Pelanggan");

    // Sheet per supir
    const byDriver = all.reduce<Record<string, any[]>>((acc, p) => {
      const key = p.driver?.fullName ?? "Tanpa Supir";
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});

    for (const [driverName, list] of Object.entries(byDriver)) {
      XLSX.utils.book_append_sheet(wb, buildWorksheet(list), `Supir ${driverName}`.slice(0, 31));
    }

    const buffer   = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const filename = `pelanggan_retribusi_${new Date().toISOString().split("T")[0]}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal export data", error: err.message });
  }
};

// ─── EXPORT BY DRIVER ─────────────────────────────────────────────────────

export const exportPelangganByDriver = async (req: any, res: any) => {
  try {
    const { driverId } = req.params;

    const driver = await prisma.user.findUnique({
      where: { id: BigInt(driverId) },
      select: { fullName: true },
    });
    if (!driver) return res.status(404).json({ success: false, message: "Supir tidak ditemukan" });

    const list = await prisma.pelanggan.findMany({
      where:   { driverId: BigInt(driverId) },
      include: { driver: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildWorksheet(list), `Supir ${driver.fullName}`.slice(0, 31));

    const buffer     = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const driverSlug = driver.fullName.toLowerCase().replace(/\s+/g, "_");
    const filename   = `pelanggan_${driverSlug}_${new Date().toISOString().split("T")[0]}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal export data supir", error: err.message });
  }
};