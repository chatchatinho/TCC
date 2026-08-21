-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_data" TEXT,
ADD COLUMN     "password_reset_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "password_reset_token_hash" TEXT;
