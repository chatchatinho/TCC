-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "humidity_max" DECIMAL(5,2),
ADD COLUMN     "humidity_min" DECIMAL(5,2),
ADD COLUMN     "temperature_max" DECIMAL(5,2),
ADD COLUMN     "temperature_min" DECIMAL(5,2);
