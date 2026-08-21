-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "notify_humidity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_temperature" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login_at" TIMESTAMPTZ(3);
