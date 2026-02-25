# Plan de Trabajo — Antigravity
## Moteland WhatsApp → OmniOS `mod-agent-sales`

> **Regla principal:** NO reescribir nada. Cada ticket es una extensión quirúrgica del código existente. Si un archivo no está en el ticket, no se toca.

**12 tickets · 4 sprints · ~44h · Primer ingreso real en Sprint 2**

| Sprint | Tickets | Horas | Resultado |
|--------|---------|-------|-----------|
| Sprint 1 — Base sólida | T1, T2, T3 | 11h | Sistema igual + Gemini Flash. Costo IA baja 99.7% |
| Sprint 2 — Primer ingreso | T4, T5, T6 | 12h | Primera comisión real registrada en DB |
| Sprint 3 — Pitch viral | T7, T8, T9 | 8h | Bot adquiere nuevos tenants de forma autónoma |
| Sprint 4 — Multi-canal | T10, T11, T12 | 13h | `mod-agent-sales` completo |

---

## Antes de empezar cada ticket

```bash
git checkout feat/omnios-migration   # nunca trabajar en main
npm run test                         # verificar que está verde
npm run build                        # verificar que compila
# → hacer los cambios del ticket
npm run test                         # debe seguir verde
npm run build                        # debe seguir compilando
```

**Convención de archivos nuevos:**

| Tipo | Carpeta | Ejemplo |
|------|---------|---------|
| Nuevo servicio | `src/services/` | `payment.service.ts` |
| Nuevo webhook | `src/webhooks/` | `payment.webhook.ts` |
| Nueva interfaz | `src/types/` | `channel.types.ts` |
| Channel adapter | `src/channels/` | `telegram.adapter.ts` |
| Tests nuevos | `src/__tests__/` | `payment.split.test.ts` |

---

# SPRINT 1 — Base Sólida

> Al terminar: Moteland funciona exactamente igual. Costo de IA baja 99.7%.

---

## T1 · Migración Prisma — Generalizar schema `4h`

**Objetivo:** Agregar campos multi-industria y la tabla de pagos. Backward-compatible: los datos existentes no se pierden.

**Archivos a modificar:**
- `prisma/schema.prisma`
- `prisma/migrations/` (auto-generado)

**Cambios en `schema.prisma`:**

```prisma
// === MODELO: Tenant ===
// AGREGAR estos dos campos:
industry        String   @default("generic")
                // retail | rental | food | services | b2b | generic
commission_rate Decimal  @default(0.08) @db.Decimal(4,3)

// === MODELO: Agente ===
// CAMBIAR el campo rol:
rol             String   @default("operator")
                // owner | admin | operator | ai_agent
                // (operator reemplaza a camarera)
preferred_channel String @default("whatsapp")

// === MODELO: Conversacion ===
// AGREGAR:
channel         String   @default("whatsapp")
                // whatsapp | telegram | web | instagram | email
pitch_shown     Boolean  @default(false)
pitch_result    String?  // interested | rejected | null

// === MODELO NUEVO: Order ===
model Order {
  id              String    @id @default(uuid())
  tenant_id       String
  conversacion_id String?
  status          String    @default("draft")
                  // draft | confirmed | processing | delivered | cancelled
  items           Json
  total           Int       // en CLP
  created_at      DateTime  @default(now())
  tenant          Tenant    @relation(fields: [tenant_id], references: [id])
  payment         Payment?
}

// === MODELO NUEVO: Payment ===
model Payment {
  id                      String    @id @default(uuid())
  tenant_id               String
  conversacion_id         String?
  order_id                String    @unique
  amount_total            Int
  amount_tenant           Int
  amount_saas             Int
  commission_rate         Decimal   @db.Decimal(4,3)
  provider                String    // flow | webpay | khipu
  status                  String    @default("pending")
  provider_transaction_id String?
  paid_at                 DateTime?
  created_at              DateTime  @default(now())
  tenant                  Tenant    @relation(fields: [tenant_id], references: [id])
}
```

**Comandos (en orden):**

```bash
# 1. Editar schema.prisma con los cambios de arriba

# 2. Generar y aplicar migración
npx prisma migrate dev --name omnios_generalization

# 3. Migrar dato existente: 'camarera' → 'operator'
npx prisma db execute --stdin <<EOF
UPDATE agentes SET rol = 'operator' WHERE rol = 'camarera';
EOF

# 4. Regenerar cliente Prisma
npx prisma generate

# 5. Verificar
npm run build
npm run test
```

**✅ Criterio de aceptación:**
- `npm run test` verde
- `npm run build` sin errores
- Filas `camarera` migradas a `operator`
- Tablas `Payment` y `Order` creadas en DB

---

## T2 · Reemplazar OpenAI → Gemini Flash/Pro `6h`

**Objetivo:** Cambiar el cliente de IA. Solo se modifican los métodos que llaman a la API. El árbol de intents, handover y colas no se tocan.

**Archivos a modificar:**
- `package.json`
- `.env`
- `src/agents/whatsapp-agent.ts` — solo `detectIntent()` y `generateResponse()`
- `src/lib/ai-client.ts` — **ARCHIVO NUEVO**

**Paso 1 — Cambiar dependencia:**

```bash
npm uninstall openai
npm install @google/generative-ai
```

**Paso 2 — `.env`:**

```bash
# ELIMINAR:
# OPENAI_API_KEY=sk-...

# AGREGAR:
GEMINI_API_KEY=AIza...           # console.cloud.google.com → APIs → Gemini
GEMINI_MODEL_FAST=gemini-1.5-flash
GEMINI_MODEL_PRO=gemini-1.5-pro
```

**Paso 3 — CREAR `src/lib/ai-client.ts`:**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiFlash = () =>
  genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_FAST! });

export const geminiPro = () =>
  genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_PRO! });
```

**Paso 4 — MODIFICAR `src/agents/whatsapp-agent.ts`:**

```typescript
// ELIMINAR al inicio:
// import OpenAI from 'openai';
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AGREGAR al inicio:
import { geminiFlash, geminiPro } from '../lib/ai-client';

// REEMPLAZAR detectIntent() completo:
async detectIntent(message: string) {
  const model = geminiFlash();
  const result = await model.generateContent([
    { text: intentPrompt },
    { text: message }
  ]);
  const raw = result.response.text().trim();
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// REEMPLAZAR el método que llama a openai para generar respuestas:
async generateResponse(prompt: string, useProModel = false) {
  const model = useProModel ? geminiPro() : geminiFlash();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// NOTA: Pasar useProModel=true en handleClosing() y handoverToHuman()
```

**✅ Criterio de aceptación:**
- Bot responde igual que antes
- Sin errores de import
- `npm run test` verde
- En logs se ve `gemini-1.5-flash` como modelo usado

---

## T3 · Actualizar `.env` y `docker-compose.yml` `1h`

**Archivos a modificar:**
- `.env.example`
- `docker-compose.yml` — solo la imagen de postgres

**`.env.example` — versión completa:**

```bash
# ── Base de datos ──────────────────────────────────────────────
DATABASE_URL=postgresql://omnios:password@localhost:5432/omnios_db
REDIS_URL=redis://localhost:6379

# ── WhatsApp Cloud API (sin cambios) ───────────────────────────
WHATSAPP_TOKEN=EAABwz...
WHATSAPP_PHONE_ID=123456789
WHATSAPP_VERIFY_TOKEN=mi_token_secreto

# ── Auth (sin cambios) ─────────────────────────────────────────
JWT_SECRET=random_256_bit_string

# ── Puente agentes Twilio (sin cambios) ────────────────────────
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx

# ── IA: REEMPLAZA OPENAI ───────────────────────────────────────
GEMINI_API_KEY=AIza...
GEMINI_MODEL_FAST=gemini-1.5-flash
GEMINI_MODEL_PRO=gemini-1.5-pro

# ── Pagos (Sprint 2) ───────────────────────────────────────────
FLOW_API_KEY=xxx
FLOW_SECRET_KEY=xxx
SAAS_COMMISSION_DEFAULT=0.08

# ── URLs ───────────────────────────────────────────────────────
API_URL=https://api.omnios.cl
APP_URL=https://app.omnios.cl

# ── Canales adicionales (Sprint 4) ─────────────────────────────
TELEGRAM_BOT_TOKEN=xxx
WEB_CHAT_SECRET=xxx
```

**`docker-compose.yml` — solo cambiar la imagen de postgres:**

```yaml
# ANTES:
# db:
#   image: postgres:16-alpine

# DESPUÉS:
db:
  image: pgvector/pgvector:pg16    # incluye extensión vector para Sprint 4
  volumes:
    - pgdata:/var/lib/postgresql/data
  environment:
    - POSTGRES_DB=omnios_db        # renombrar de moteland_wa
    - POSTGRES_USER=omnios
    - POSTGRES_PASSWORD=${DB_PASSWORD}

# El resto del docker-compose.yml no cambia.
```

**✅ Criterio de aceptación:**
- `docker compose up` sin errores
- Imagen `pgvector/pgvector:pg16` corriendo
- `.env.example` tiene todas las variables documentadas

---

# SPRINT 2 — Primer Ingreso Real

> Al terminar: primera comisión real registrada en la tabla `payments`.

---

## T4 · PaymentService — Crear links de pago con Flow `4h`

**Objetivo:** Servicio que genera links de pago. El bot lo llama cuando el cliente confirma una compra.

**Archivos a crear:**
- `src/services/payment.service.ts` — **ARCHIVO NUEVO**

```typescript
// src/services/payment.service.ts

import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

const FLOW_API = 'https://www.flow.cl/api';

export class PaymentService {

  async createPaymentLink(params: {
    orderId: string;
    tenantId: string;
    conversacionId: string;
    amount: number;        // CLP entero, sin decimales
    description: string;
    customerEmail?: string;
  }) {
    // Crear la orden en DB
    await prisma.order.create({
      data: {
        id: params.orderId,
        tenant_id: params.tenantId,
        conversacion_id: params.conversacionId,
        status: 'draft',
        items: [],
        total: params.amount,
      }
    });

    // Armar payload para Flow
    const payload: Record<string, any> = {
      apiKey:          process.env.FLOW_API_KEY!,
      commerceOrder:   params.orderId,
      subject:         params.description,
      amount:          params.amount,
      email:           params.customerEmail || '',
      urlConfirmation: `${process.env.API_URL}/webhook/payment`,
      urlReturn:       `${process.env.APP_URL}/pago-completado`,
    };

    // Flow requiere firma HMAC-SHA256 de los params ordenados
    const keys = Object.keys(payload).sort();
    const toSign = keys.map(k => `${k}${payload[k]}`).join('');
    const signature = crypto
      .createHmac('sha256', process.env.FLOW_SECRET_KEY!)
      .update(toSign)
      .digest('hex');

    const response = await axios.post(
      `${FLOW_API}/payment/create`,
      { ...payload, s: signature }
    );

    return {
      paymentUrl: `${response.data.url}?token=${response.data.token}`,
      flowToken:  response.data.token,
    };
  }
}

export const paymentService = new PaymentService();
```

**✅ Criterio de aceptación:**
- Llamar al método con monto de prueba en sandbox de Flow → recibir URL válida
- `Order` creada en DB con `status: 'draft'`

---

## T5 · Webhook de pago + split automático `4h`

**Objetivo:** Endpoint que recibe la confirmación de Flow, valida autenticidad, calcula el split y registra la comisión.

**Archivos a crear/modificar:**
- `src/webhooks/payment.webhook.ts` — **ARCHIVO NUEVO**
- `src/routes/index.ts` — agregar una línea

```typescript
// src/webhooks/payment.webhook.ts

import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { io } from '../lib/socket';  // el socket.io existente del proyecto

export async function handlePaymentWebhook(req: Request, res: Response) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).send('Missing token');

    // Consultar estado del pago a Flow con el token
    const paymentData = await getFlowPaymentStatus(token);
    if (paymentData.status !== 2) return res.send('OK'); // 2 = PAGADO en Flow

    const { commerceOrder, amount } = paymentData;

    // Buscar la orden y el tenant
    const order = await prisma.order.findUnique({
      where: { id: commerceOrder },
      include: { tenant: true }
    });
    if (!order) return res.status(404).send('Order not found');
    if (order.status === 'confirmed') return res.send('OK'); // idempotente

    // Calcular split
    const rate          = Number(order.tenant.commission_rate);
    const amountSaas    = Math.round(amount * rate);
    const amountTenant  = amount - amountSaas;

    // Registrar en tabla payments
    await prisma.payment.create({
      data: {
        tenant_id:               order.tenant_id,
        conversacion_id:         order.conversacion_id,
        order_id:                commerceOrder,
        amount_total:            amount,
        amount_tenant:           amountTenant,
        amount_saas:             amountSaas,
        commission_rate:         rate,
        provider:                'flow',
        status:                  'confirmed',
        provider_transaction_id: token,
        paid_at:                 new Date(),
      }
    });

    // Actualizar orden
    await prisma.order.update({
      where: { id: commerceOrder },
      data: { status: 'confirmed' }
    });

    // Notificar al bot para que confirme al cliente
    io.to(`tenant:${order.tenant_id}`)
      .emit('payment_confirmed', {
        orderId:         commerceOrder,
        conversacionId:  order.conversacion_id,
        amount,
        amountSaas,
      });

    res.send('OK');
  } catch (err) {
    console.error('Payment webhook error:', err);
    res.status(500).send('Error');
  }
}

async function getFlowPaymentStatus(token: string) {
  const params = { apiKey: process.env.FLOW_API_KEY!, token };
  // (agregar firma HMAC igual que en PaymentService)
  const response = await axios.get(
    'https://www.flow.cl/api/payment/getStatus',
    { params }
  );
  return response.data;
}
```

```typescript
// src/routes/index.ts — AGREGAR esta línea:
app.post('/webhook/payment', handlePaymentWebhook);
```

**✅ Criterio de aceptación:**
- Simular webhook de Flow con token válido
- `Payment` registrado en DB con split correcto
- `amount_saas === Math.round(amount_total * commission_rate)`
- Evento Socket.io `payment_confirmed` emitido

---

## T6 · Bot genera y envía link de pago al cliente `4h`

**Archivos a modificar:**
- `src/agents/whatsapp-agent.ts` — agregar `handleOrderConfirmation()` y listener

```typescript
// MODIFICAR: src/agents/whatsapp-agent.ts
// AGREGAR imports al inicio:
import { paymentService } from '../services/payment.service';
import { v4 as uuidv4 } from 'uuid';

// AGREGAR al switch — ANTES del default:
case 'cierre_venta':
  return await this.handleOrderConfirmation(intent.params);

// AGREGAR método a la clase:
async handleOrderConfirmation(orderDetails: {
  items:       any[];
  total:       number;
  description: string;
}) {
  const orderId = uuidv4();

  const { paymentUrl } = await paymentService.createPaymentLink({
    orderId,
    tenantId:       this.tenantId,
    conversacionId: this.conversationId,
    amount:         orderDetails.total,
    description:    orderDetails.description,
  });

  const formatted = new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP'
  }).format(orderDetails.total);

  return `✅ Perfecto! Tu pedido está listo.\n\n`
       + `💰 Total: ${formatted}\n`
       + `🔗 Paga aquí: ${paymentUrl}\n\n`
       + `_El link expira en 30 minutos._`;
}

// AGREGAR en el constructor, después de this.context = []:
socket.on('payment_confirmed', async (data) => {
  if (data.conversacionId !== this.conversationId) return;
  await sendWhatsAppMessage(
    this.clientPhone,
    '🎉 ¡Pago recibido! Tu pedido está confirmado. Nos contactamos pronto.'
  );
});
```

**✅ Criterio de aceptación:**
- Cliente confirma compra → bot envía link de pago
- Simular pago → bot envía confirmación
- Todo registrado en DB

---

# SPRINT 3 — Pitch Viral

> Al terminar: el bot presenta OmniOS a dueños de negocio de forma autónoma.

---

## T7 · Nuevos intents en el prompt de detección `2h`

**Archivos a modificar:**
- `src/agents/prompts.ts` — reemplazar `intentPrompt`
- `src/agents/whatsapp-agent.ts` — agregar 4 cases al switch

```typescript
// src/agents/prompts.ts — REEMPLAZAR intentPrompt:

export const intentPrompt = `
Eres un clasificador de intenciones para un agente de ventas chileno.
Analiza el mensaje y responde SOLO con JSON, sin texto adicional, sin backticks.

Intenciones posibles:
- consulta_disponibilidad
- consulta_precio
- reserva_simple
- cierre_venta: el cliente confirma que quiere comprar o pide el link de pago
- queja
- b2b_buyer: compra en volumen, menciona empresa, pide factura, es revendedor
- business_owner: menciona tener su propio negocio, local, taller o clientes
- asks_how_bot_works: pregunta cómo funciona el bot o el sistema
- looking_for_worker: busca contratar a alguien (gasfiter, técnico, empleado)
- is_supplier: es proveedor, distribuidor o fabricante
- otro

Formato de respuesta:
{
  "type": "<intención>",
  "params": {},
  "detectedIndustry": "retail|services|food|rental|construction|null",
  "isBusinessOwner": true|false,
  "buyingVolume": "individual|wholesale"
}
`;
```

```typescript
// src/agents/whatsapp-agent.ts — AGREGAR al switch ANTES del default:

case 'b2b_buyer':
case 'business_owner':
case 'asks_how_bot_works':
  return await this.pitch.handleOmniOSPitch(intent);

case 'looking_for_worker':
  return await this.pitch.handleWorkerMatchPitch();

case 'is_supplier':
  return await this.pitch.handleSupplierPoolPitch();
```

**✅ Criterio de aceptación — enviar estas 5 frases y verificar el intent:**

| Frase | Intent esperado |
|-------|----------------|
| `necesito 20 filtros para mi taller` | `b2b_buyer` |
| `¿cómo funciona este sistema?` | `asks_how_bot_works` |
| `yo también tengo una ferretería` | `business_owner` |
| `busco un gasfiter para una obra` | `looking_for_worker` |
| `soy distribuidor de aceites` | `is_supplier` |
| `quiero comprar un filtro` | `consulta_precio` ← NO debe hacer pitch |

---

## T8 · `handleOmniOSPitch()` — pitch viral `4h`

**Archivos a crear/modificar:**
- `src/agents/omnios-pitch.ts` — **ARCHIVO NUEVO**
- `src/agents/whatsapp-agent.ts` — instanciar `OmniOSPitch` en el constructor

```typescript
// src/agents/omnios-pitch.ts

import { geminiPro } from '../lib/ai-client';
import { prisma } from '../lib/prisma';

export class OmniOSPitch {

  constructor(
    private tenantId:       string,
    private conversationId: string
  ) {}

  async handleOmniOSPitch(intent: any): Promise<string | null> {
    // No repetir si ya se mostró en esta conversación
    const conv = await prisma.conversacion.findUnique({
      where: { id: this.conversationId }
    });
    if (conv?.pitch_shown) return null;

    const model = geminiPro();
    const result = await model.generateContent(`
      Eres el agente de ventas de OmniOS, un SaaS chileno para negocios.
      El cliente parece ser dueño de negocio (industria: ${intent.detectedIndustry || 'desconocida'}).

      Genera un pitch corto en español chileno. Máximo 4 mensajes cortos.
      Estructura OBLIGATORIA:
      1. Confirmar que resolviste su consulta original.
      2. Gancho natural: "¿Y tú también tienes tu propio negocio?"
      3. Propuesta: "Podría tener un agente como este para tu negocio.
         Sin costo fijo, solo pagas cuando vende. 5-8% por venta."
      4. Cierre con link: https://omnios.cl/start

      Adapta el mensaje a la industria detectada.
      Tono: directo, chileno, no vendedor. Sin emojis excesivos.
    `);

    // Marcar pitch como mostrado
    await prisma.conversacion.update({
      where: { id: this.conversationId },
      data: { pitch_shown: true }
    });

    return result.response.text();
  }

  async handleWorkerMatchPitch(): Promise<string> {
    return `¡Puedo ayudarte! En OmniOS hay una red de trabajadores`
         + ` verificados por rubro (gasfiters, electricistas, técnicos).\n\n`
         + `Si tú también tienes un negocio de servicios, podría`
         + ` conectarte con más clientes automáticamente.\n`
         + `Sin costo fijo: https://omnios.cl/start`;
  }

  async handleSupplierPoolPitch(): Promise<string> {
    return `¡Interesante! OmniOS tiene un pool de compras cooperativas`
         + ` con más de 15 negocios del rubro.\n\n`
         + `Podrías acceder a pedidos consolidados en una sola orden,`
         + ` sin gestionar cada cliente por separado.\n`
         + `¿Te interesa? https://omnios.cl/proveedores`;
  }
}
```

```typescript
// src/agents/whatsapp-agent.ts — AGREGAR en el constructor:
import { OmniOSPitch } from './omnios-pitch';

// En el constructor:
this.pitch = new OmniOSPitch(tenantId, conversationId);
```

**✅ Criterio de aceptación:**
- Intent `business_owner` → bot presenta pitch con link `omnios.cl/start`
- Segunda llamada con el mismo `conversacionId` → retorna `null`, pitch NO se repite
- `pitch_shown = true` en DB después del primer pitch

---

## T9 · Tests del Sprint 3 `2h`

**Archivos a crear:**
- `src/__tests__/pitch.intent.test.ts`
- `src/__tests__/pitch.shown.test.ts`

```typescript
// src/__tests__/pitch.intent.test.ts
const cases = [
  { msg: 'necesito 20 filtros para mi taller', expected: 'b2b_buyer' },
  { msg: '¿cómo funciona este sistema?',       expected: 'asks_how_bot_works' },
  { msg: 'yo también tengo una ferretería',    expected: 'business_owner' },
  { msg: 'busco un gasfiter para una obra',    expected: 'looking_for_worker' },
  { msg: 'soy distribuidor de aceites',        expected: 'is_supplier' },
  { msg: 'quiero comprar un filtro',           expected: 'consulta_precio' },
];
// Para cada caso: llamar detectIntent() → verificar type === expected

// src/__tests__/pitch.shown.test.ts
test('pitch no se repite en misma conversación', async () => {
  // Primera llamada: pitch_shown = false → retorna el pitch
  const result1 = await pitch.handleOmniOSPitch(mockIntent);
  expect(result1).toContain('omnios.cl/start');

  // Segunda llamada: pitch_shown = true → retorna null
  const result2 = await pitch.handleOmniOSPitch(mockIntent);
  expect(result2).toBeNull();
});
```

**✅ Criterio de aceptación:**
- `npm run test` verde
- 6/6 casos de intent clasifican correctamente
- Test de `pitch_shown` pasa

---

# SPRINT 4 — Multi-Canal + Búsqueda Semántica

> Al terminar: `mod-agent-sales` completo y listo para producción.

---

## T10 · ChannelAdapter — interfaz multi-canal `4h`

**Objetivo:** Refactorizar el código de WhatsApp para que use una interfaz `ChannelAdapter`. El comportamiento no cambia — es solo un refactor que habilita agregar canales sin duplicar código.

**Archivos a crear/modificar:**
- `src/channels/channel.interface.ts` — **ARCHIVO NUEVO**
- `src/channels/whatsapp.adapter.ts` — **ARCHIVO NUEVO** (mover código existente)
- `src/channels/telegram.adapter.ts` — **ARCHIVO NUEVO**
- `src/routes/index.ts` — agregar ruta de Telegram

```typescript
// src/channels/channel.interface.ts

export interface NormalizedMessage {
  from:        string;   // número o chat ID del remitente
  text:        string;
  channel:     'whatsapp' | 'telegram' | 'web' | 'instagram';
  tenantId:    string;
  rawPayload:  any;
}

export interface ChannelAdapter {
  channel: 'whatsapp' | 'telegram' | 'web' | 'instagram';
  parseIncoming(rawPayload: any, tenantId: string): NormalizedMessage | null;
  send(to: string, message: string, tenantId: string): Promise<void>;
  sendPaymentLink(to: string, url: string, amount: number, tenantId: string): Promise<void>;
}
```

```bash
# Instalar cliente de Telegram:
npm install node-telegram-bot-api
npm install -D @types/node-telegram-bot-api
```

```typescript
// src/channels/telegram.adapter.ts

import TelegramBot from 'node-telegram-bot-api';
import { ChannelAdapter, NormalizedMessage } from './channel.interface';

export class TelegramAdapter implements ChannelAdapter {
  channel = 'telegram' as const;
  private bot: TelegramBot;

  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, {
      polling: false  // usamos webhook, no polling
    });
  }

  parseIncoming(payload: any, tenantId: string): NormalizedMessage | null {
    const msg = payload?.message;
    if (!msg?.text) return null;
    return {
      from:       String(msg.chat.id),
      text:       msg.text,
      channel:    'telegram',
      tenantId,
      rawPayload: payload,
    };
  }

  async send(chatId: string, message: string) {
    await this.bot.sendMessage(chatId, message);
  }

  async sendPaymentLink(chatId: string, url: string, amount: number) {
    const formatted = new Intl.NumberFormat('es-CL', {
      style: 'currency', currency: 'CLP'
    }).format(amount);
    await this.bot.sendMessage(
      chatId,
      `💳 Paga ${formatted} aquí:\n${url}`
    );
  }
}
```

```typescript
// src/routes/index.ts — AGREGAR:
app.post('/webhook/telegram', (req, res) =>
  handleIncoming(telegramAdapter, req, res)
);
```

**✅ Criterio de aceptación:**
- WhatsApp sigue funcionando exactamente igual
- Mensaje de prueba en Telegram → bot responde
- `NormalizedMessage` tiene la misma estructura para ambos canales

---

## T11 · pgvector + búsqueda semántica de catálogo `6h`

**Prerequisito:** `docker-compose.yml` ya usa `pgvector/pgvector:pg16` (hecho en T3).

**Archivos a crear:**
- `prisma/migrations/enable_vector.sql`
- `src/services/catalog-search.service.ts` — **ARCHIVO NUEVO**

```sql
-- prisma/migrations/enable_vector.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

```bash
# Ejecutar:
npx prisma db execute --file prisma/migrations/enable_vector.sql
```

**Agregar campo `embedding` al modelo `Product` en `schema.prisma`:**

```prisma
model Product {
  id               String    @id @default(uuid())
  tenant_id        String
  sku              String
  nombre           String
  descripcion      String?
  precio           Int
  stock            Int       @default(0)
  categoria        String?
  compatibilidades String?
  embedding        Unsupported("vector(768)")?   // dimensión de text-embedding-004
  created_at       DateTime  @default(now())
  tenant           Tenant    @relation(fields: [tenant_id], references: [id])
  @@unique([tenant_id, sku])
}
```

```bash
npx prisma migrate dev --name add_product_embeddings
```

```typescript
// src/services/catalog-search.service.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../lib/prisma';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class CatalogSearchService {

  // Llamar cuando se crea o actualiza un producto
  async indexProduct(productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return;

    const text = [
      product.nombre,
      product.descripcion,
      product.categoria,
      product.compatibilidades
    ].filter(Boolean).join(' ');

    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;

    await prisma.$executeRaw`
      UPDATE products
      SET embedding = ${JSON.stringify(embedding)}::vector
      WHERE id = ${productId}
    `;
  }

  // El bot llama esto en handleAvailability() y handlePrice()
  async search(tenantId: string, query: string, limit = 5) {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(query);
    const queryEmbedding = result.embedding.values;

    return await prisma.$queryRaw<any[]>`
      SELECT id, sku, nombre, precio, stock,
        ROUND(
          (1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector))::numeric,
          3
        ) AS similarity
      FROM products
      WHERE tenant_id  = ${tenantId}
        AND stock       > 0
        AND embedding   IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `;
  }
}

export const catalogSearch = new CatalogSearchService();
```

```typescript
// src/agents/whatsapp-agent.ts — MODIFICAR handleAvailability() y handlePrice():
// Reemplazar búsqueda por SKU exacto por búsqueda semántica:
const products = await catalogSearch.search(this.tenantId, message);
```

**✅ Criterio de aceptación:**
- Indexar 3 productos de prueba con `indexProduct()`
- Buscar `"filtro aceite Corolla 2018"` → resultado con `similarity > 0.75`
- Bot usa búsqueda semántica en consultas de disponibilidad y precio

---

## T12 · Tests finales + smoke test end-to-end `3h`

**Archivos a crear:**
- `src/__tests__/payment.split.test.ts`
- `src/__tests__/payment.webhook.test.ts`
- `src/__tests__/catalog.search.test.ts`
- `src/__tests__/channel.adapter.test.ts`
- `src/__tests__/e2e.smoke.test.ts`

```typescript
// payment.split.test.ts
test('split 8% calcula sin pérdida de centavos', () => {
  const total  = 100000;
  const rate   = 0.08;
  const saas   = Math.round(total * rate);
  const tenant = total - saas;
  expect(saas).toBe(8000);
  expect(tenant).toBe(92000);
  expect(saas + tenant).toBe(total);
});

// channel.adapter.test.ts
test('NormalizedMessage idéntico para WA y Telegram', () => {
  const waMsg  = whatsappAdapter.parseIncoming(mockWAPayload, 'tenant-1');
  const tgMsg  = telegramAdapter.parseIncoming(mockTGPayload, 'tenant-1');
  expect(Object.keys(waMsg!)).toEqual(Object.keys(tgMsg!));
});

// e2e.smoke.test.ts — flujo completo (con mocks de APIs externas)
test('flujo completo de venta', async () => {
  // 1. Cliente envía mensaje de consulta de precio
  // 2. Bot detecta intent 'consulta_precio' → responde con precio
  // 3. Cliente confirma (intent 'cierre_venta')
  // 4. Bot genera link de pago (mock Flow API)
  // 5. Webhook de pago recibido y procesado
  // 6. Split calculado y registrado en DB
  // 7. Socket.io emite 'payment_confirmed'
  // 8. Bot envía confirmación al cliente

  expect(order.status).toBe('confirmed');
  expect(payment.amount_saas).toBe(Math.round(payment.amount_total * 0.08));
});
```

**✅ Criterio de aceptación:**
- `npm run test` verde con todos los tests nuevos
- Smoke test e2e pasa
- `npm run build` sin errores
- PR listo para mergear a `main`

---

## Resumen final

| Ticket | Descripción | Sprint | Horas |
|--------|-------------|--------|-------|
| T1 | Migración Prisma — generalizar schema | 1 | 4h |
| T2 | Reemplazar OpenAI → Gemini Flash/Pro | 1 | 6h |
| T3 | Actualizar `.env` y `docker-compose.yml` | 1 | 1h |
| T4 | PaymentService — links de pago con Flow | 2 | 4h |
| T5 | Webhook de pago + split automático | 2 | 4h |
| T6 | Bot genera y envía link al cliente | 2 | 4h |
| T7 | Nuevos intents en prompt de detección | 3 | 2h |
| T8 | `handleOmniOSPitch()` — pitch viral | 3 | 4h |
| T9 | Tests del Sprint 3 | 3 | 2h |
| T10 | ChannelAdapter + Telegram | 4 | 4h |
| T11 | pgvector + búsqueda semántica | 4 | 6h |
| T12 | Tests finales + smoke test e2e | 4 | 3h |
| | **TOTAL** | | **~44h** |

---

> **El 80% ya está construido. Estos 12 tickets construyen el 20% que genera el ingreso.**
