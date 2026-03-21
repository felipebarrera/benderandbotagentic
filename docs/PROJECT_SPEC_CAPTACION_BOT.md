# BENDERAND — BOT DE CAPTACIÓN Y ONBOARDING AUTOMÁTICO
**Sistema Unificado de Adquisición, Conversión y Activación de Tenants**
*v1.0 · Marzo 2026 · Paralelo a Hito 9 · Confidencial*

---

## PRINCIPIO CENTRAL

> El bot no vende una app. **Muestra el número concreto que el prospecto puede ganar esta semana.**
> Todo lo demás es consecuencia de eso.
> Cero intervención humana de BenderAnd en ningún paso.
> Cada negocio pequeño es tratado como la sucursal 1 de una cadena futura.

---

## ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│              BOT DE CAPTACIÓN BENDERAND                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CANAL ENTRADA          MOTOR                  CANAL SALIDA      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐ │
│  │ WhatsApp    │───►│              │───►│ Onboarding tenant   │ │
│  │ Cloud API   │    │  Bot Engine  │    │ (BenderAnd ERP)     │ │
│  └─────────────┘    │  (Node.js)   │    └─────────────────────┘ │
│                     │              │                             │
│  ┌─────────────┐    │  GPT-4o-mini │    ┌─────────────────────┐ │
│  │ Telegram    │───►│  + Prompts   │───►│ Billing automático  │ │
│  │ Bot API     │    │  por perfil  │    │ (schema público)    │ │
│  └─────────────┘    │              │    └─────────────────────┘ │
│  (paralelo día 1)   └──────────────┘                            │
│                            │                                     │
│                     ┌──────▼──────┐                             │
│                     │  PostgreSQL │                             │
│                     │  prospectos │                             │
│                     │  pipeline   │                             │
│                     └─────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### Stack (sobre Moteland existente)
- **Backend**: Node.js ESM + Express (existente)
- **Canal 1**: WhatsApp Cloud API (existente — reutilizar infraestructura)
- **Canal 2**: Telegram Bot API (nuevo — mismo worker, distinto adapter)
- **LLM**: GPT-4o-mini (existente)
- **Queue**: BullMQ (existente)
- **DB**: PostgreSQL — nueva tabla `prospectos` en schema público
- **ERP Integration**: JWT compartido → API Laravel (Hito 9)

---

## PERFILES DE PROSPECTO

El bot detecta automáticamente en qué perfil está la persona
y adapta el flujo completo.

```
PERFIL A — PROFESIONAL INDEPENDIENTE
  Quién: psicóloga, médico, dentista, abogado, gasfíter, profe
  Situación: trabaja para otro, quiere ingresos extra o independencia
  Hook: "¿cuánto puedes ganar esta semana con las horas que tienes libre?"
  Conversión: calculadora de ingresos → prueba gratis 30 días

PERFIL B — DUEÑO DE NEGOCIO PEQUEÑO
  Quién: almacén, ferretería, motel, cancha, taller
  Situación: ya tiene negocio, lo gestiona a mano o con cuaderno
  Hook: "¿cuánto pierdes al mes en ventas que no registras?"
  Conversión: demo del módulo exacto para su rubro → prueba gratis

PERFIL C — EMPRENDEDOR SIN NEGOCIO AÚN
  Quién: quiere poner algo pero no sabe cómo
  Situación: tiene habilidad o capital, no tiene estructura
  Hook: "¿qué sabes hacer? Te mostramos cómo convertirlo en negocio"
  Conversión: orientación de rubro + calculadora + prueba gratis

PERFIL D — REFERIDO (viene de otro tenant)
  Quién: alguien que recibió un link de referido
  Situación: ya sabe algo de BenderAnd por quien lo refirió
  Hook: directo al beneficio concreto que mencionó quien refirió
  Conversión: más rápida — saltea 2 pasos del flujo estándar
```

---

## FLUJOS POR PERFIL

### FLUJO A — PROFESIONAL INDEPENDIENTE

```
FASE 1: ENGANCHE (mensajes 1-3)
────────────────────────────────────────────────────────────────

[Bot saluda con nombre si viene referido, genérico si no]

Bot: "Hola 👋 Soy el asistente de BenderAnd.
     Una pregunta rápida —
     ¿A qué te dedicas?"

[Responde: "soy psicóloga" / "gasfíter" / "doy clases" / etc.]

Bot: "Perfecto. ¿Trabajas de forma independiente
     o para alguien más ahora mismo?"

[Responde]

→ Si trabaja para otro:
Bot: "Entiendo. ¿Cuántas horas libres tienes
     fuera de ese trabajo esta semana?
     (Aunque sean pocas, dime)"

→ Si ya es independiente:
Bot: "Bien. ¿Tienes una forma de gestionar
     tus cobros, agenda y boletas hoy,
     o lo haces a mano?"
     [Saltar a FASE 3]

FASE 2: CALCULADORA (mensajes 4-6)
────────────────────────────────────────────────────────────────

[Bot calcula en base a horas disponibles y profesión]

Ejemplo psicóloga con 3 horas libres/semana:

Bot: "Con 3 horas disponibles,
     cobrando $35.000 por sesión 🧮

     Esta semana:  $105.000
     Este mes:     $420.000
     Este año:     $5.040.000

     Todo sin dejar lo que haces hoy.
     ¿Eso cambiaría algo en tu situación?"

[Responde sí / depende / cómo / etc.]

Bot: "La única diferencia entre lo que
     ganas hoy extra y $0 extra
     es tener los pacientes y la estructura
     para recibirlos.

     Nosotros ponemos la estructura.
     Tú pones las horas.

     ¿Quieres ver cómo funciona?"

FASE 3: DEMO PERSONALIZADO (mensajes 7-10)
────────────────────────────────────────────────────────────────

Bot: "Para mostrarte algo concreto,
     ¿cuál es tu mayor problema hoy
     como [psicóloga/gasfíter/profesional]?

     1️⃣ Conseguir clientes nuevos
     2️⃣ Cobrar y emitir boletas sin lío
     3️⃣ Organizar mi agenda
     4️⃣ Todo lo anterior"

[Responde]

[Bot muestra flujo específico del módulo relevante
 en texto + imagen si es posible]

Ejemplo si elige 1 (conseguir clientes):

Bot: "Así funciona la captación 👇

     1. Creas tu perfil en BenderAnd
     2. El sistema publica tu disponibilidad
     3. Los pacientes reservan por WhatsApp
        o Telegram directamente contigo
     4. Tú confirmas y cobras
     5. La boleta de honorarios se emite sola

     El primer mes es gratis.
     Sin tarjeta de crédito.
     Sin compromiso.

     ¿Empezamos?"

FASE 4: CONVERSIÓN (mensajes 11-13)
────────────────────────────────────────────────────────────────

Bot: "Para crear tu cuenta necesito 3 datos:

     1. Tu nombre completo
     2. Tu RUT
     3. Tu especialidad / profesión"

[Recibe datos uno a uno]

Bot: "Listo [Nombre] 🎉

     Tu cuenta está siendo creada.
     En 2 minutos recibes el link
     para entrar por primera vez.

     Una cosa más — ¿conoces a otro
     profesional que esté en la misma
     situación que tú?

     Si los invitas y se registran,
     tú ganas 1 mes gratis adicional."

[Sistema crea tenant automáticamente vía API Laravel]
[Envía credenciales + link onboarding]
[Registra referido si aplica]
```

---

### FLUJO B — DUEÑO DE NEGOCIO PEQUEÑO

```
FASE 1: IDENTIFICACIÓN DEL NEGOCIO (mensajes 1-4)
────────────────────────────────────────────────────────────────

Bot: "Hola 👋 ¿Tienes o estás pensando
     en poner un negocio?"

[Responde: "tengo una ferretería" / "un almacén" / etc.]

Bot: "Buenísimo. ¿Cuántos años lleva
     el negocio funcionando?"

[Responde]

Bot: "Y hoy, ¿cómo llevas el control
     de ventas y stock?

     1️⃣ Cuaderno o Excel
     2️⃣ Algún programa o app
     3️⃣ De memoria / sin control
     4️⃣ Tengo alguien que lo hace"

[Responde]

FASE 2: HOOK ECONÓMICO (mensajes 5-7)
────────────────────────────────────────────────────────────────

[Bot adapta según respuesta anterior]

Si cuaderno/memoria:

Bot: "Un negocio sin control digital
     pierde en promedio entre un 15%
     y un 25% de sus ventas potenciales.

     Con ventas de $3.000.000 al mes
     eso son entre $450.000 y $750.000
     que se van sin que te des cuenta.

     ¿Ese rango se parece a tu negocio?"

[Responde]

Bot: "BenderAnd recupera eso.
     No es solo un programa —
     es el sistema que te permite
     crecer de 1 local a 3
     sin contratar más gente.

     ¿Puedo mostrarte cómo funciona
     para una [ferretería/almacén/etc.]?"

FASE 3: DEMO DEL RUBRO EXACTO (mensajes 8-11)
────────────────────────────────────────────────────────────────

[Bot despliega el módulo exacto para su industria]

Ejemplo ferretería:

Bot: "Esto es lo que tendría tu ferretería 👇

     📦 Stock en tiempo real
        → Cada venta descuenta automático
        → Alertas cuando algo está bajo

     🧾 Factura o boleta en 10 segundos
        → SII integrado, sin trámites

     📱 Tus clientes piden por WhatsApp
        → El bot responde si tienes el producto
        → Crea la venta solo

     👥 Varios vendedores en pantallas distintas
        → Todos agregando a la misma venta

     ¿Quieres que te muestre una demo
     en vivo de 5 minutos?"

FASE 4: CONVERSIÓN (mensajes 12-15)
────────────────────────────────────────────────────────────────

Bot: "Para crear tu cuenta necesito:

     1. Nombre del negocio
     2. RUT del negocio (o tuyo si eres persona natural)
     3. ¿Cuántas personas trabajan contigo?"

[Recibe datos]

Bot: "Perfecto [Nombre del negocio] 🏪

     Cuenta creada. Tienes 30 días gratis
     para probar todo sin límites.

     Después son $19.990/mes base
     + una comisión pequeña sobre tus ventas.
     (Te explico eso cuando estés adentro)

     Link para entrar: [URL personalizado]

     PD: Si invitas a otro negocio
     y se registran, ganas 1 mes gratis.
     ¿Conoces alguien?"
```

---

### FLUJO D — REFERIDO

```
FASE 1: RECONOCIMIENTO INMEDIATO (mensajes 1-2)
────────────────────────────────────────────────────────────────

[Bot detecta parámetro ref= en el link de entrada]

Bot: "Hola [Nombre si viene en el link] 👋

     [Nombre del referidor] me dijo
     que podrías estar interesado/a
     en [beneficio específico que mencionó].

     ¿Es así?"

[Responde sí]

Bot: "Perfecto. Por venir referido/a
     tienes 45 días gratis en vez de 30.

     ¿Eres [profesional independiente]
     o tienes un negocio?"

[Salta directamente a FASE 3 del flujo correspondiente]
```

---

## SISTEMA DE GAMIFICACIÓN

### "Nivel 1 de tu cadena"

Cada negocio entra al sistema como **Nivel 1**. El framing es explícito:

```
NIVELES DE CRECIMIENTO
──────────────────────────────────────────────────────────────
Nivel 1 — Un local / Un profesional solo
  Desbloqueado: POS, stock, agenda, SII, WhatsApp bot
  Meta: $X en ventas/mes (calculado según rubro)

Nivel 2 — Primer empleado o segunda ubicación
  Desbloqueado: Multi-operario, RRHH básico, delivery
  Meta: equipo funcionando sin el dueño todo el día

Nivel 3 — Multi-sucursal o multi-profesional
  Desbloqueado: Multi-sucursal, reportes cruzados, CRM avanzado
  Meta: la segunda sucursal paga sola

Nivel 4 — Cadena regional
  Desbloqueado: API propia, white-label, red de proveedores
  Meta: franquicia o expansión regional
──────────────────────────────────────────────────────────────
```

El bot **menciona el nivel** durante el onboarding:

```
Bot: "Estás entrando como Nivel 1.
     Tu meta este mes es llegar a $X.
     Cuando lo logres, te mostramos
     qué se desbloquea para el Nivel 2.

     Hay ferreterías que comenzaron
     igual que tú y hoy tienen 3 locales.
     Tú eres la primera sucursal."
```

### Progreso visible en el ERP

El dashboard del tenant muestra:

```
┌─────────────────────────────────────────┐
│  🏪 FERRETERÍA DON PEDRO               │
│  ████████░░░░░░░░ NIVEL 1 → 2          │
│                                         │
│  Ventas este mes:   $1.240.000          │
│  Meta nivel 2:      $3.000.000          │
│  Faltan:            $1.760.000 (59%)    │
│                                         │
│  Para subir de nivel necesitas:         │
│  ✅ 3 meses consecutivos sobre $2M      │
│  ⬜ Registrar tu primer empleado        │
│  ⬜ Activar WhatsApp bot                │
└─────────────────────────────────────────┘
```

---

## MODELO DE COMISIONES POR REFERIDO

```
QUIEN REFIERE          BENEFICIO
────────────────────────────────────────────────────────
Tenant refiere tenant  1 mes gratis por cada conversión
Profesional refiere    1 mes gratis + 10% comisión mes 1
Red de referidos       Hasta 6 meses gratis acumulables
────────────────────────────────────────────────────────
```

El bot **siempre termina preguntando por referidos**, sin excepción.
Es el último mensaje de cada conversión exitosa.

---

## MODELO DE DATOS — NUEVAS TABLAS

### Schema público (PostgreSQL)

```sql
-- Prospectos y pipeline de captación
CREATE TABLE prospectos (
    id              BIGSERIAL PRIMARY KEY,
    canal           VARCHAR(20) NOT NULL, -- 'whatsapp' | 'telegram'
    canal_id        VARCHAR(100) NOT NULL, -- phone o telegram_id
    nombre          VARCHAR(255),
    perfil          VARCHAR(20),  -- 'profesional'|'negocio'|'emprendedor'|'referido'
    rubro_detectado VARCHAR(100),
    estado          VARCHAR(30) DEFAULT 'nuevo',
    -- nuevo | calculadora | demo | conversión | convertido | perdido
    ref_tenant_id   BIGINT REFERENCES tenants(id), -- quien lo refirió
    datos_json      JSONB,  -- respuestas del flujo
    mrr_calculado   BIGINT, -- ingreso estimado que bot calculó
    created_at      TIMESTAMP DEFAULT NOW(),
    ultimo_mensaje  TIMESTAMP,
    convertido_at   TIMESTAMP,
    tenant_id       BIGINT REFERENCES tenants(id) -- si ya convirtió
);

-- Conversaciones del bot de captación
CREATE TABLE conversaciones_captacion (
    id              BIGSERIAL PRIMARY KEY,
    prospecto_id    BIGINT REFERENCES prospectos(id),
    canal           VARCHAR(20),
    rol             VARCHAR(10), -- 'bot' | 'user'
    contenido       TEXT,
    intencion       VARCHAR(50),
    timestamp       TIMESTAMP DEFAULT NOW()
);

-- Referidos y red
CREATE TABLE referidos (
    id              BIGSERIAL PRIMARY KEY,
    referidor_id    BIGINT REFERENCES tenants(id),
    prospecto_id    BIGINT REFERENCES prospectos(id),
    estado          VARCHAR(20) DEFAULT 'pendiente',
    -- pendiente | convertido | expirado
    meses_ganados   INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    convertido_at   TIMESTAMP
);

-- Niveles de gamificación por tenant
CREATE TABLE tenant_niveles (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT REFERENCES tenants(id) UNIQUE,
    nivel_actual    INTEGER DEFAULT 1,
    meta_ventas_mes BIGINT,  -- CLP, calculado por rubro
    ventas_mes_1    BIGINT DEFAULT 0,
    ventas_mes_2    BIGINT DEFAULT 0,
    ventas_mes_3    BIGINT DEFAULT 0,
    meses_en_meta   INTEGER DEFAULT 0,
    logros_json     JSONB DEFAULT '[]',
    nivel_desbloqueado_at TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

## SISTEMA DE PROMPTS POR PERFIL

### Prompt base del bot captador

```
Eres el asistente de ventas de BenderAnd, una plataforma que
ayuda a pequeños negocios y profesionales independientes a
gestionar y hacer crecer sus operaciones.

TU OBJETIVO: Convertir al prospecto en un tenant registrado.
No en una conversación larga. En la menor cantidad de mensajes posible.

REGLAS:
1. Nunca menciones "app" o "software". Di "sistema" o "plataforma".
2. Siempre ancla en dinero concreto, no en features.
3. Cada mensaje máximo 4 líneas. Nunca walls of text.
4. Si el prospecto duda, vuelve al número económico.
5. El cierre siempre es pedir 3 datos para crear la cuenta.
6. El último mensaje siempre pregunta por referidos.
7. Nunca prometas lo que el sistema no tiene.
8. Trata cada negocio como la sucursal 1 de una cadena futura.

PERFIL DETECTADO: {perfil}
RUBRO DETECTADO: {rubro}
INGRESO CALCULADO: {mrr_calculado}
VIENE REFERIDO DE: {referidor_nombre | null}

HISTORIAL: {historial_conversacion}
```

### Calculadora de ingresos por profesión

```javascript
const CALCULADORA = {
  psicologo:  { sesion: 35000, sesiones_hora: 1, label: 'sesión' },
  medico:     { sesion: 45000, sesiones_hora: 1, label: 'consulta' },
  dentista:   { sesion: 55000, sesiones_hora: 1, label: 'atención' },
  abogado:    { sesion: 85000, sesiones_hora: 1, label: 'hora profesional' },
  gasfiter:   { sesion: 35000, sesiones_hora: 0.5, label: 'trabajo' },
  mecanico:   { sesion: 45000, sesiones_hora: 0.3, label: 'servicio' },
  profesor:   { sesion: 20000, sesiones_hora: 1, label: 'clase' },
  nutricionista: { sesion: 30000, sesiones_hora: 1, label: 'consulta' },
  kinesiologo: { sesion: 30000, sesiones_hora: 1, label: 'sesión' },
  fonoaudiologo: { sesion: 30000, sesiones_hora: 1, label: 'sesión' },
};

function calcularIngreso(profesion, horasLibres) {
  const p = CALCULADORA[profesion];
  if (!p) return null;
  const sesiones = Math.floor(horasLibres * p.sesiones_hora);
  const semana = sesiones * p.sesion;
  const mes = semana * 4;
  const anio = mes * 12;
  return { sesiones, semana, mes, anio, label: p.label };
}
```

---

## TELEGRAM — IMPLEMENTACIÓN PARALELA

### Por qué Telegram desde día 1

- **Sin costo por mensaje** (WhatsApp cobra por conversación iniciada por negocio)
- **Bot API gratuita** y sin aprobación de Meta
- **Sin límite de mensajes** por número
- **Mayor privacidad** — atractivo para profesionales (psicólogos, abogados)
- **Sin restricciones de template** — el bot puede escribir libremente

### Arquitectura dual-canal

```javascript
// adapter/whatsapp.adapter.js (existente)
// adapter/telegram.adapter.js (nuevo)

// message.handler.js — canal agnóstico
async function handleIncoming(canal, userId, texto, metadata) {
  // mismo flujo independiente del canal
  const prospecto = await getOrCreateProspecto(canal, userId);
  const respuesta = await procesarMensaje(prospecto, texto);
  await enviar(canal, userId, respuesta); // adapter decide cómo
}

// El flujo de conversación es idéntico en ambos canales
// Solo cambia el adapter de envío/recepción
```

### Estrategia de migración WhatsApp → Telegram

```
MES 1-2: WhatsApp principal, Telegram secundario
  → Bot responde en ambos canales
  → Nuevos prospectos pueden entrar por cualquiera

MES 3-4: Incentivo activo para migrar
  → "Por chatear por Telegram tienes 5 días gratis extra"
  → Tenants existentes reciben notificación de beneficio

MES 5+: Telegram principal
  → WhatsApp solo para rubros donde es el canal dominante
    (almacenes, moteles — clientela mayor, menos tech-savvy)
  → WhatsApp se convierte en canal de soporte, no captación
```

---

## API ENDPOINTS — NUEVOS

```
POST   /captacion/webhook/whatsapp     Recibe mensajes WA (existente, redirigir)
POST   /captacion/webhook/telegram     Recibe mensajes Telegram (nuevo)
GET    /captacion/prospectos           Lista prospectos con pipeline
GET    /captacion/prospectos/:id       Detalle prospecto + historial
POST   /captacion/prospectos/:id/convertir   Conversión manual si falla auto
GET    /captacion/metricas             Tasa conversión, tiempo promedio, por rubro
GET    /captacion/referidos            Red de referidos activa
POST   /captacion/referidos/validar    Validar y acreditar mes gratis
GET    /tenant/:id/nivel               Nivel gamificación del tenant
POST   /tenant/:id/nivel/recalcular    Forzar recalculo de nivel
```

---

## PLAN DE IMPLEMENTACIÓN

### Semana 1 — Base del flujo
```
[ ] Crear tablas prospectos, conversaciones_captacion, referidos
[ ] Crear tenant_niveles en schema público
[ ] Bifurcar el bot existente: nuevo handler captacion.handler.js
[ ] Implementar detección de perfil (profesional / negocio / referido)
[ ] Flujo A completo — Profesional (4 fases)
[ ] Calculadora de ingresos por profesión
[ ] Integración con API Laravel para crear tenant automático
```

### Semana 2 — Flujos restantes + Telegram
```
[ ] Flujo B completo — Dueño de negocio (4 fases)
[ ] Flujo D — Referido (versión corta)
[ ] Adapter Telegram (telegram.adapter.js)
[ ] Webhook Telegram registrado y activo
[ ] Sistema de referidos — link único por tenant
[ ] Acreditación automática de mes gratis
```

### Semana 3 — Gamificación + Dashboard
```
[ ] Lógica de niveles (1→4) por rubro con metas calculadas
[ ] Widget de progreso en dashboard admin de cada tenant
[ ] Panel Super Admin — pipeline de prospectos en tiempo real
[ ] Métricas: tasa conversión por canal, por perfil, por rubro
[ ] Notificación automática cuando tenant sube de nivel
[ ] Tests end-to-end flujo completo WA y Telegram
```

---

## MÉTRICAS DE ÉXITO

```
SEMANA 1 POST-LANZAMIENTO
  → Tasa conversión prospecto → cuenta creada: > 25%
  → Tiempo promedio conversación hasta conversión: < 8 mensajes
  → Cero intervención manual de BenderAnd

MES 1
  → 10 tenants nuevos captados por el bot
  → 3 vía Telegram (valida canal)
  → 1 cadena de referidos activa (A refirió a B que refirió a C)

MES 3
  → 40% de nuevos tenants vienen por referido
  → Telegram representa > 30% del canal de captación
  → Al menos 2 tenants subieron de Nivel 1 a Nivel 2
```

---

## CHECKLIST DE VERIFICACIÓN

### Semana 1
- [ ] Bot detecta perfil en ≤ 2 mensajes
- [ ] Calculadora produce número correcto para 10 profesiones
- [ ] Tenant se crea automáticamente en Laravel al terminar flujo
- [ ] Credenciales llegan al nuevo tenant en < 2 minutos
- [ ] Link de referido único generado al convertir

### Semana 2
- [ ] Flujo Telegram idéntico al WhatsApp
- [ ] Referido recibe 45 días (no 30) y bot lo confirma
- [ ] Referidor recibe notificación cuando referido convierte
- [ ] Mes gratis se acredita automáticamente en billing

### Semana 3
- [ ] Dashboard muestra nivel + progreso visualmente
- [ ] Super Admin ve pipeline completo en tiempo real
- [ ] Bot pregunta por referidos en el 100% de conversiones
- [ ] Métricas exportables por semana/mes/canal/perfil

---

## NOTAS DE IMPLEMENTACIÓN

**Sobre el tono del bot:**
No es un bot corporativo. Es directo, usa números, no usa jerga de startup.
"Tu primera sucursal" no "escala tu negocio". 
"$420.000 este mes" no "maximiza tus ingresos".

**Sobre el timing de Telegram:**
Registrar el bot con BotFather desde el día 1. No requiere aprobación.
El adapter es < 80 líneas de código sobre la base existente.
No hay razón para esperar.

**Sobre la creación automática de tenants:**
El endpoint `POST /api/tenants` de Laravel ya existe (Hito 6).
Solo necesita un JWT de Super Admin para llamarlo desde el bot.
El onboarding vía WhatsApp bot ya está especificado en `BENDERAND_CONFIG_INDUSTRIAS.md`.

**Sobre el modelo de comisión al momento de la conversión:**
El bot NO menciona el porcentaje de comisión en la conversación de captación.
Solo menciona "una comisión pequeña sobre tus ventas — te explico cuando estés adentro".
El detalle se ve en el onboarding dentro del ERP, no antes.
