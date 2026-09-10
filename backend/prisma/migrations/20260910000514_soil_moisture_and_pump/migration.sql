-- Umidade do solo (nova variável monitorada, separada da umidade do ar) e a bomba
-- d'água interligada a ela (irrigação automática/manual/só-notifica por dispositivo).

-- AlterTable: leitura de solo é opcional (nem todo dispositivo tem o sensor).
ALTER TABLE "measurements" ADD COLUMN "soil_moisture" DECIMAL(5,2);

-- AlterTable: limites de solo por dispositivo, mesmo padrão de temperatura/umidade do ar.
ALTER TABLE "settings"
  ADD COLUMN "ideal_soil_moisture" DECIMAL(5,2) NOT NULL DEFAULT 40,
  ADD COLUMN "soil_moisture_tolerance" DECIMAL(5,2) NOT NULL DEFAULT 15,
  ADD COLUMN "soil_moisture_min" DECIMAL(5,2),
  ADD COLUMN "soil_moisture_max" DECIMAL(5,2),
  ADD COLUMN "notify_soil_moisture" BOOLEAN NOT NULL DEFAULT true;

-- AlterEnum
ALTER TYPE "AlertVariable" ADD VALUE 'soil_moisture';

-- CreateEnum
CREATE TYPE "PumpMode" AS ENUM ('automatic', 'notify_only', 'manual');

-- CreateTable
CREATE TABLE "pumps" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "mode" "PumpMode" NOT NULL DEFAULT 'notify_only',
    "moisture_threshold" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "below_threshold_minutes" INTEGER NOT NULL DEFAULT 30,
    "is_on" BOOLEAN NOT NULL DEFAULT false,
    "turned_on_at" TIMESTAMPTZ(3),
    "below_threshold_since" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pumps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pumps_device_id_key" ON "pumps"("device_id");

-- AddForeignKey
ALTER TABLE "pumps" ADD CONSTRAINT "pumps_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
