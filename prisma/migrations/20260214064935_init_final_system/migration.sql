/*
  Warnings:

  - You are about to drop the `Laporan` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('WARGA', 'OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'DITINDAKLANJUTI', 'SELESAI');

-- DropTable
DROP TABLE "Laporan";

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT,
    "role" "Role" NOT NULL DEFAULT 'WARGA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "location_type" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "geom" geography(Point, 4326),
    "address" TEXT,
    "capacity_volume" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "jenis_sampah" TEXT,
    "location_id" BIGINT,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "geom" geography(Point, 4326),
    "photo_url" TEXT,
    "description" TEXT,
    "lat_completed" DECIMAL(10,8),
    "long_completed" DECIMAL(11,8),
    "photo_after_url" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trucks" (
    "id" BIGSERIAL NOT NULL,
    "plate_number" TEXT NOT NULL,
    "operator_id" BIGINT,
    "current_lat" DECIMAL(10,8),
    "current_long" DECIMAL(11,8),
    "last_ping" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trucks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_history" (
    "id" BIGSERIAL NOT NULL,
    "truck_id" BIGINT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" BIGSERIAL NOT NULL,
    "truck_id" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "start_location_id" BIGINT,
    "route_status" TEXT NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volumes" (
    "id" BIGSERIAL NOT NULL,
    "report_id" BIGINT,
    "volume_kg" DECIMAL(10,2) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" BIGINT,

    CONSTRAINT "volumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "trucks_plate_number_key" ON "trucks"("plate_number");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_start_location_id_fkey" FOREIGN KEY ("start_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
