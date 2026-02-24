-- CreateEnum
CREATE TYPE "RolAgente" AS ENUM ('ADMIN', 'AGENTE');

-- CreateEnum
CREATE TYPE "EstadoConv" AS ENUM ('BOT', 'HUMANO', 'CERRADA');

-- CreateEnum
CREATE TYPE "DireccionMsg" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateEnum
CREATE TYPE "TipoMsg" AS ENUM ('TEXTO', 'AUDIO', 'IMAGEN', 'SISTEMA');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "whatsapp_number" TEXT NOT NULL,
    "whatsapp_phone_id" TEXT NOT NULL,
    "modo_bot" BOOLEAN NOT NULL DEFAULT true,
    "prompt_personalizado" TEXT,
    "horario_inicio" TEXT NOT NULL DEFAULT '00:00',
    "horario_fin" TEXT NOT NULL DEFAULT '23:59',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "RolAgente" NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_ping" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversaciones" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "whatsapp_contact" TEXT NOT NULL,
    "contact_name" TEXT,
    "estado" "EstadoConv" NOT NULL,
    "agente_id" UUID,
    "ultimo_mensaje_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id" UUID NOT NULL,
    "conversacion_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "whatsapp_message_id" TEXT NOT NULL,
    "direccion" "DireccionMsg" NOT NULL,
    "tipo" "TipoMsg" NOT NULL,
    "contenido" TEXT NOT NULL,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cola_espera" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversacion_id" UUID NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cola_espera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_whatsapp_number_key" ON "tenants"("whatsapp_number");

-- CreateIndex
CREATE UNIQUE INDEX "agentes_email_key" ON "agentes"("email");

-- CreateIndex
CREATE INDEX "conversaciones_tenant_id_estado_idx" ON "conversaciones"("tenant_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "mensajes_whatsapp_message_id_key" ON "mensajes"("whatsapp_message_id");

-- AddForeignKey
ALTER TABLE "agentes" ADD CONSTRAINT "agentes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "agentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cola_espera" ADD CONSTRAINT "cola_espera_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
