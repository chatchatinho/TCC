-- Settings passam a pertencer a um Device (1:1), não mais a um User.
-- A tabela é recriada do zero: os dados existentes são apenas configuração de
-- exemplo/seed, sem valor de produção a preservar.
DROP TABLE "settings";

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "ideal_temperature" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "temperature_tolerance" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "temperature_min" DECIMAL(5,2),
    "temperature_max" DECIMAL(5,2),
    "ideal_humidity" DECIMAL(5,2) NOT NULL DEFAULT 60,
    "humidity_tolerance" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "humidity_min" DECIMAL(5,2),
    "humidity_max" DECIMAL(5,2),
    "notify_temperature" BOOLEAN NOT NULL DEFAULT true,
    "notify_humidity" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_device_id_key" ON "settings"("device_id");

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
