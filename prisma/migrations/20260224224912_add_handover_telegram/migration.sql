-- AlterTable
ALTER TABLE "conversaciones" ADD COLUMN     "handover_at" TIMESTAMP(3),
ADD COLUMN     "handover_resolution" TEXT,
ADD COLUMN     "handover_resolved_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "telegram_bot_token" TEXT,
ADD COLUMN     "telegram_chat_id" TEXT;
