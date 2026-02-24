-- AlterTable
ALTER TABLE "mensajes" ADD COLUMN     "intent_detected" TEXT;

-- CreateIndex
CREATE INDEX "mensajes_conversacion_id_created_at_idx" ON "mensajes"("conversacion_id", "created_at");

-- CreateIndex
CREATE INDEX "mensajes_tenant_id_created_at_idx" ON "mensajes"("tenant_id", "created_at");
