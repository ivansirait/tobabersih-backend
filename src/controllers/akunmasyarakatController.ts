import { prisma } from "../config/db.js";
import * as XLSX from "xlsx";

// ─── Helper ────────────────────────────────────────────────────────────────

const sanitizeUser = (user: any) => {
  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    id: user.id.toString(),
    region: user.jenisUsaha ?? "",  // ✅ Fix: region tidak ada di schema, pakai jenisUsaha sebagai fallback atau string kosong
    driverName: user.driver?.fullName ?? null,
  };
};

// ─── GET USERS ──────────────────────────────────────────────────────────────

export const getUsers = async (req: any, res: any) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) ?? "";
    const driverId = req.query.driverId as string;

    const where: any = {
      role: "WARGA",
      ...(driverId ? { driverId: BigInt(driverId) } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              // ✅ Fix: hapus region dari OR filter — tidak ada di schema
              { jenisUsaha: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { driver: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users.map(sanitizeUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET USERS ERROR:", error);
    res.status(500).json({ success: false, message: "Gagal ambil data" });
  }
};

// ─── GET DRIVERS ────────────────────────────────────────────────────────────

export const getDrivers = async (_req: any, res: any) => {
  try {
    const drivers = await prisma.user.findMany({
      where: { role: "OPERATOR" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    res.json({
      success: true,
      data: drivers.map((d) => ({ id: d.id.toString(), fullName: d.fullName })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Gagal ambil data supir" });
  }
};

// ─── CREATE USER ────────────────────────────────────────────────────────────

export const createUser = async (req: any, res: any) => {
  try {
    const { fullName, phoneNumber, region, jenisUsaha, driverId } = req.body;
    // region diterima dari body tapi tidak disimpan ke DB karena tidak ada di schema

    if (!fullName?.trim()) {
      return res.status(400).json({ success: false, message: "Nama lengkap wajib diisi" });
    }

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: `warga_${Date.now()}@internal.local`,
        passwordHash: "internal",
        phoneNumber: phoneNumber?.trim() || null,
        // ✅ Fix: hapus region — tidak ada di schema. Simpan ke jenisUsaha jika perlu
        jenisUsaha: jenisUsaha?.trim() || region?.trim() || "Rumah Tangga",
        role: "WARGA",
        isActive: true,
        ...(driverId ? { driverId: BigInt(driverId) } : {}),
      },
      include: { driver: { select: { id: true, fullName: true } } },
    });

    res.json({ success: true, data: sanitizeUser(user) });
  } catch (error: any) {
    console.error("CREATE USER ERROR:", error);
    res.status(500).json({ success: false, message: "Gagal tambah pelanggan", error: error.message });
  }
};

// ─── BULK CREATE ────────────────────────────────────────────────────────────

export const bulkCreateUsers = async (req: any, res: any) => {
  try {
    const { users, driverId } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, message: "Data tidak valid atau kosong" });
    }
    if (users.length > 500) {
      return res.status(400).json({ success: false, message: "Maksimal 500 baris per import" });
    }

    const results: { nama: string; status: string; message: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of users) {
      const { fullName, phoneNumber, region, jenisUsaha } = row;

      if (!fullName?.trim()) {
        results.push({ nama: fullName || "kosong", status: "error", message: "Nama wajib diisi" });
        errorCount++;
        continue;
      }

      try {
        await prisma.user.create({
          data: {
            fullName: fullName.trim(),
            email: `warga_${Date.now()}_${Math.random().toString(36).slice(2)}@internal.local`,
            passwordHash: "internal",
            phoneNumber: phoneNumber?.trim() || null,
            // ✅ Fix: hapus region — simpan ke jenisUsaha sebagai fallback
            jenisUsaha: jenisUsaha?.trim() || region?.trim() || "Rumah Tangga",
            role: "WARGA",
            isActive: true,
            ...(driverId ? { driverId: BigInt(driverId) } : {}),
          },
        });
        results.push({ nama: fullName.trim(), status: "success", message: "Berhasil didaftarkan" });
        successCount++;
      } catch (err: any) {
        results.push({ nama: fullName.trim(), status: "error", message: err.message || "Gagal" });
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Import selesai: ${successCount} berhasil, ${errorCount} gagal`,
      summary: { total: users.length, success: successCount, error: errorCount },
      results,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Gagal import data", error: error.message });
  }
};

// ─── UPDATE USER ────────────────────────────────────────────────────────────

export const updateUser = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber, region, jenisUsaha, driverId } = req.body;

    const existing = await prisma.user.findUnique({ where: { id: BigInt(id as string) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan" });
    }

    const user = await prisma.user.update({
      where: { id: BigInt(id as string) },
      data: {
        fullName: fullName?.trim() || existing.fullName,
        phoneNumber: phoneNumber !== undefined ? phoneNumber?.trim() || null : existing.phoneNumber,
        // ✅ Fix: hapus region — tidak ada di schema. Pakai jenisUsaha sebagai fallback
        jenisUsaha: jenisUsaha !== undefined
          ? jenisUsaha?.trim()
          : (region !== undefined ? region?.trim() || "" : existing.jenisUsaha),
        driverId: driverId !== undefined ? (driverId ? BigInt(driverId) : null) : existing.driverId,
      },
      include: { driver: { select: { id: true, fullName: true } } },
    });

    res.json({ success: true, data: sanitizeUser(user) });
  } catch (error: any) {
    console.error("UPDATE ERROR:", error);
    res.status(500).json({ success: false, message: "Gagal update pelanggan", error: error.message });
  }
};

// ─── DELETE USER ────────────────────────────────────────────────────────────

export const deleteUser = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const existing = await prisma.user.findUnique({ where: { id: BigInt(id as string) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Pelanggan tidak ditemukan" });
    }
    await prisma.user.delete({ where: { id: BigInt(id as string) } });
    res.json({ success: true, message: "Pelanggan berhasil dihapus" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Gagal hapus pelanggan", error: error.message });
  }
};

// ─── Helper worksheet ───────────────────────────────────────────────────────

const buildWorksheet = (users: any[]) => {
  const rows = users.map((u, i) => ({
    No: i + 1,
    "Nama Pelanggan": u.fullName,
    Alamat: u.jenisUsaha || "",  // ✅ Fix: pakai jenisUsaha karena region tidak ada
    "Jenis Usaha": u.jenisUsaha || "Rumah Tangga",
    "No. Telepon": u.phoneNumber || "",
    Supir: u.driver?.fullName || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 30 },
    { wch: 20 }, { wch: 16 }, { wch: 20 },
  ];
  return ws;
};

// ─── EXPORT ALL ─────────────────────────────────────────────────────────────

export const exportUsers = async (_req: any, res: any) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "WARGA" },
      include: { driver: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildWorksheet(users), "Semua Pelanggan");

    const byDriver = users.reduce<Record<string, any[]>>((acc, u) => {
      const key = u.driver?.fullName ?? "Tanpa Supir";
      if (!acc[key]) acc[key] = [];
      acc[key].push(u);
      return acc;
    }, {});

    for (const [driverName, driverUsers] of Object.entries(byDriver)) {
      const sheetName = `Supir ${driverName}`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, buildWorksheet(driverUsers), sheetName);
    }

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const filename = `pelanggan_retribusi_${new Date().toISOString().split("T")[0]}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Gagal export data", error: error.message });
  }
};

// ─── EXPORT BY DRIVER ───────────────────────────────────────────────────────

export const exportUsersByDriver = async (req: any, res: any) => {
  try {
    const { driverId } = req.params;

    const driver = await prisma.user.findUnique({
      where: { id: BigInt(driverId as string) },
      select: { fullName: true },
    });

    if (!driver) {
      return res.status(404).json({ success: false, message: "Supir tidak ditemukan" });
    }

    const users = await prisma.user.findMany({
      where: { role: "WARGA", driverId: BigInt(driverId as string) },
      include: { driver: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildWorksheet(users), `Supir ${driver.fullName}`.slice(0, 31));

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const driverSlug = driver.fullName.toLowerCase().replace(/\s+/g, "_");
    const filename = `pelanggan_${driverSlug}_${new Date().toISOString().split("T")[0]}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Gagal export data supir", error: error.message });
  }
};