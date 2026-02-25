# PLAN — moteland-bridge v2 (Multi-DB)
# Bridge PHP que sirve 6 bases de datos distintas en una sola API
# Directorio: /home/master/Documentos/sitiosweb/docker/src/moteland-bridge/

## Mapa completo de bases de datos

| DB | Tipo | Nombre | motel_id interno | Tiene motel_id en tablas |
|----|------|--------|-----------------|--------------------------|
| admin_mlunaa      | motel    | Motel Luna A   | 1 | SÍ (motel_id_motel) |
| admin_mluzd       | motel    | Motel Luz D    | 1 | SÍ (motel_id_motel) |
| admin_mlunap      | motel    | Motel Luna P   | 2 | SÍ (motel_id_motel) |
| admin_motelander  | motel    | Motel Ander    | 2 | SÍ (motel_id_motel) |
| admin_repuestoand | repuesto | Repuestos AND  | - | NO (sin empresa_id) |
| admin_repuestosmoto | repuesto | Repuestos Moto | - | NO (sin empresa_id) |

## Conclusión crítica

Los moteles: cada DB tiene su propia tabla `motel` con `id_motel`.
El identificador del negocio ES la base de datos misma, no un campo interno.

Los repuestos: tampoco tienen empresa_id. Cada DB = un negocio completo.
Tabla `producto` con: nombre, cantidad_producto, valor_producto, costo_producto, codigo_producto.
Tabla `venta` con: fecha en formato `d/m/Y H:i:s` (string, no datetime).
Sin tabla `habitacion` — son repuestos de motos/autos.

## Diseño del bridge: db_key como identificador universal

El bot asocia cada tenant con una `db_key` (nombre de la DB en MariaDB).
Esto es todo lo que necesita. Sin motel_id interno, sin lógica especial.

```
tenant.pms_db_key = "admin_motelander"   → motel, motel_id=2
tenant.pms_db_key = "admin_repuestoand"  → repuestos, sin motel_id
tenant.pms_tipo   = "motel" | "repuesto"
tenant.pms_motel_id = 2 (solo para moteles, null para repuestos)
```

---

## Endpoints del bridge

### Compartidos (ambos tipos)
```
GET  /health
GET  /api/info?db=admin_mlunaa           → nombre del negocio, tipo
GET  /api/productos/buscar?db=X&q=TEXTO  → buscar producto por nombre/código
```

### Solo moteles
```
GET  /api/habitaciones/disponibles?db=admin_motelander
GET  /api/habitaciones/precios?db=admin_motelander
POST /api/reservas?db=admin_motelander
```

### Solo repuestos
```
GET  /api/repuestos/stock?db=admin_repuestoand&q=TEXTO
GET  /api/repuestos/catalogo?db=admin_repuestoand
```

---

## Estructura de archivos

```
moteland-bridge/
├── Dockerfile
├── index.php              ← Router
├── config.php             ← Multi-DB connection factory
├── auth.php               ← X-Internal-Secret
└── routes/
    ├── health.php
    ├── info.php            ← Info del negocio (detecta tipo)
    ├── habitaciones.php    ← Disponibilidad + precios (moteles)
    ├── reservas.php        ← Crear reserva (moteles)
    └── repuestos.php       ← Stock + catálogo (repuestos)
```

---

## Tarea 1 — Dockerfile

```dockerfile
FROM php:8.2-cli-alpine
RUN docker-php-ext-install pdo pdo_mysql
WORKDIR /app
COPY . .
RUN adduser -D -u 1001 bridge && chown -R bridge:bridge /app
USER bridge
EXPOSE 3080
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3080/health || exit 1
CMD ["php", "-S", "0.0.0.0:3080", "index.php"]
```

---

## Tarea 2 — config.php (Multi-DB factory)

```php
<?php
date_default_timezone_set('America/Santiago');

define('DB_HOST',         getenv('PMS_DB_HOST')     ?: 'host.docker.internal');
define('DB_PORT',         getenv('PMS_DB_PORT')     ?: '3306');
define('DB_USER',         getenv('PMS_DB_USER')     ?: '');
define('DB_PASS',         getenv('PMS_DB_PASS')     ?: '');
define('INTERNAL_SECRET', getenv('INTERNAL_API_SECRET') ?: '');

// Registro de todas las bases de datos válidas
// El bridge SOLO acepta db_keys que estén en esta lista
define('DB_REGISTRY', [
    'admin_mlunaa'       => ['tipo' => 'motel',    'nombre' => 'Motel Luna A',    'motel_id' => 1],
    'admin_mluzd'        => ['tipo' => 'motel',    'nombre' => 'Motel Luz D',     'motel_id' => 1],
    'admin_mlunap'       => ['tipo' => 'motel',    'nombre' => 'Motel Luna P',    'motel_id' => 2],
    'admin_motelander'   => ['tipo' => 'motel',    'nombre' => 'Motel Ander',     'motel_id' => 2],
    'admin_repuestoand'  => ['tipo' => 'repuesto', 'nombre' => 'Repuestos AND',   'motel_id' => null],
    'admin_repuestosmoto'=> ['tipo' => 'repuesto', 'nombre' => 'Repuestos Moto',  'motel_id' => null],
]);

function getDBInfo(string $dbKey): array {
    $registry = DB_REGISTRY;
    if (!isset($registry[$dbKey])) {
        jsonError("Base de datos no registrada: $dbKey", 400);
    }
    return $registry[$dbKey];
}

// Pool de conexiones por DB (una por request, lazy)
$_pdoPool = [];

function getDB(string $dbKey): PDO {
    global $_pdoPool;
    getDBInfo($dbKey); // valida que existe en registry

    if (!isset($_pdoPool[$dbKey])) {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            DB_HOST, DB_PORT, $dbKey);
        $_pdoPool[$dbKey] = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT            => 5,
        ]);
    }
    return $_pdoPool[$dbKey];
}

function getDbParam(): string {
    $db = trim($_GET['db'] ?? '');
    if (empty($db)) jsonError('Parámetro db requerido', 400);
    getDBInfo($db); // valida whitelist
    return $db;
}

function jsonOk(array $data): void {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $msg, int $code = 400): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// Precio real según día/hora (lógica del PMS)
function calcularPrecioActual(array $p): int {
    $ahora     = new DateTime('now', new DateTimeZone('America/Santiago'));
    $dia       = (int)$ahora->format('w'); // 0=dom, 6=sab
    $horaStr   = $ahora->format('H:i:s');

    if ($p['pricechange_producto'] == 1
        && $dia  >= (int)$p['startday_producto']
        && $dia  <= (int)$p['endday_producto']
        && $horaStr >= $p['starttime_producto']
        && $horaStr <= $p['endtime_producto']
    ) {
        return (int)($p['priceonchange_producto'] ?: $p['valor_producto']);
    }
    if (($dia === 0 || $dia === 6) && !empty($p['valordiaespecial'])) {
        return (int)$p['valordiaespecial'];
    }
    return (int)$p['valor_producto'];
}
```

---

## Tarea 3 — auth.php

```php
<?php
function requireAuth(): void {
    if (empty(INTERNAL_SECRET)) return;
    $headers = array_change_key_case(getallheaders(), CASE_LOWER);
    $provided = $headers['x-internal-secret'] ?? '';
    if (!hash_equals(INTERNAL_SECRET, $provided)) jsonError('Unauthorized', 401);
}
```

---

## Tarea 4 — index.php (Router)

```php
<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');
$uri    = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { http_response_code(200); exit; }

switch (true) {
    case $uri === '/health' && $method === 'GET':
        require __DIR__ . '/routes/health.php';
        routeHealth();
        break;

    case $uri === '/api/info' && $method === 'GET':
        requireAuth();
        require __DIR__ . '/routes/info.php';
        routeInfo();
        break;

    // MOTELES
    case $uri === '/api/habitaciones/disponibles' && $method === 'GET':
        requireAuth();
        require __DIR__ . '/routes/habitaciones.php';
        getDisponibles();
        break;

    case $uri === '/api/habitaciones/precios' && $method === 'GET':
        requireAuth();
        require __DIR__ . '/routes/habitaciones.php';
        getPrecios();
        break;

    case $uri === '/api/reservas' && $method === 'POST':
        requireAuth();
        require __DIR__ . '/routes/reservas.php';
        crearReserva();
        break;

    // REPUESTOS
    case $uri === '/api/repuestos/stock' && $method === 'GET':
        requireAuth();
        require __DIR__ . '/routes/repuestos.php';
        buscarStock();
        break;

    case $uri === '/api/repuestos/catalogo' && $method === 'GET':
        requireAuth();
        require __DIR__ . '/routes/repuestos.php';
        getCatalogo();
        break;

    default:
        jsonError('Not found', 404);
}
```

---

## Tarea 5 — routes/health.php

```php
<?php
function routeHealth(): void {
    $results = [];
    foreach (array_keys(DB_REGISTRY) as $dbKey) {
        try {
            getDB($dbKey)->query('SELECT 1');
            $results[$dbKey] = 'ok';
        } catch (Exception $e) {
            $results[$dbKey] = 'error';
        }
    }
    $allOk = !in_array('error', $results);
    jsonOk([
        'status'    => $allOk ? 'ok' : 'degraded',
        'databases' => $results,
        'timestamp' => date('c'),
    ]);
}
```

---

## Tarea 6 — routes/info.php

```php
<?php
function routeInfo(): void {
    $dbKey  = getDbParam();
    $info   = getDBInfo($dbKey);

    $nombre = $info['nombre'];
    // Para moteles: confirmar nombre desde la DB
    if ($info['tipo'] === 'motel') {
        try {
            $stmt = getDB($dbKey)->prepare(
                'SELECT nombre_motel FROM motel WHERE id_motel = ? LIMIT 1'
            );
            $stmt->execute([$info['motel_id']]);
            $row = $stmt->fetch();
            if ($row) $nombre = $row['nombre_motel'];
        } catch (Exception $e) { /* usar nombre del registry */ }
    }

    jsonOk([
        'db'       => $dbKey,
        'nombre'   => $nombre,
        'tipo'     => $info['tipo'],
        'motel_id' => $info['motel_id'],
    ]);
}
```

---

## Tarea 7 — routes/habitaciones.php (moteles)

```php
<?php
function assertMotel(string $dbKey): int {
    $info = getDBInfo($dbKey);
    if ($info['tipo'] !== 'motel') jsonError('Esta DB no es de motel', 400);
    return (int)$info['motel_id'];
}

function getDisponibles(): void {
    $dbKey    = getDbParam();
    $motelId  = assertMotel($dbKey);

    try {
        $db = getDB($dbKey);

        $stmt = $db->prepare("
            SELECT
                h.id_habitacion,
                h.numero_habitacion,
                h.ocupada_habitacion,
                CASE h.ocupada_habitacion
                    WHEN 0 THEN 'libre'
                    WHEN 1 THEN 'ocupada'
                    WHEN 2 THEN 'reservada'
                    WHEN 3 THEN 'limpieza'
                    ELSE 'desconocido'
                END AS estado,
                hd.horaentrada_habitaciondetalle,
                hd.horasalida_habitaciondetalle
            FROM habitacion h
            LEFT JOIN habitaciondetalle hd
                ON hd.habitacion_id_habitacion = h.id_habitacion
                AND hd.open_habitaciondetalle = 1
            WHERE h.motel_id_motel = ?
            ORDER BY h.numero_habitacion ASC
        ");
        $stmt->execute([$motelId]);
        $habitaciones = $stmt->fetchAll();

        $stmtP = $db->prepare("
            SELECT nombre_producto, valor_producto, priceonchange_producto,
                   valordiaespecial, duracion_producto, pricechange_producto,
                   startday_producto, endday_producto,
                   starttime_producto, endtime_producto
            FROM producto
            WHERE motel_id_motel = ?
            AND familia_producto_id_familia_producto = 3
            AND mostrarweb_producto = 1
            ORDER BY valor_producto ASC
        ");
        $stmtP->execute([$motelId]);
        $precios = array_map(fn($p) => [
            'nombre'   => $p['nombre_producto'],
            'precio'   => calcularPrecioActual($p),
            'duracion' => $p['duracion_producto'] ?? null,
        ], $stmtP->fetchAll());

        $libres = array_filter($habitaciones, fn($h) => $h['ocupada_habitacion'] == 0);

        jsonOk([
            'db'                 => $dbKey,
            'total_habitaciones' => count($habitaciones),
            'disponibles'        => count($libres),
            'habitaciones'       => array_values($habitaciones),
            'precios'            => $precios,
            'timestamp'          => date('c'),
        ]);

    } catch (Exception $e) {
        error_log('[bridge] getDisponibles error: ' . $e->getMessage());
        jsonError('Error consultando disponibilidad', 500);
    }
}

function getPrecios(): void {
    $dbKey   = getDbParam();
    $motelId = assertMotel($dbKey);

    try {
        $stmt = getDB($dbKey)->prepare("
            SELECT id_producto, nombre_producto, valor_producto,
                   priceonchange_producto, valordiaespecial,
                   duracion_producto, pricechange_producto,
                   startday_producto, endday_producto,
                   starttime_producto, endtime_producto
            FROM producto
            WHERE motel_id_motel = ?
            AND familia_producto_id_familia_producto = 3
            AND mostrarweb_producto = 1
            ORDER BY valor_producto ASC
        ");
        $stmt->execute([$motelId]);
        $rows = $stmt->fetchAll();

        $precios = array_map(fn($p) => [
            'id'              => (int)$p['id_producto'],
            'nombre'          => $p['nombre_producto'],
            'precio_base'     => (int)$p['valor_producto'],
            'precio_actual'   => calcularPrecioActual($p),
            'precio_especial' => $p['pricechange_producto'] == 1 ? (int)$p['priceonchange_producto'] : null,
            'precio_finde'    => !empty($p['valordiaespecial']) ? (int)$p['valordiaespecial'] : null,
            'duracion'        => $p['duracion_producto'],
        ], $rows);

        jsonOk(['db' => $dbKey, 'precios' => $precios, 'timestamp' => date('c')]);

    } catch (Exception $e) {
        error_log('[bridge] getPrecios error: ' . $e->getMessage());
        jsonError('Error consultando precios', 500);
    }
}
```

---

## Tarea 8 — routes/reservas.php

```php
<?php
function crearReserva(): void {
    $input   = json_decode(file_get_contents('php://input'), true) ?? [];
    $dbKey   = $input['db'] ?? ($_GET['db'] ?? '');
    if (empty($dbKey)) jsonError('Parámetro db requerido', 400);
    getDBInfo($dbKey); // valida whitelist

    foreach (['fecha', 'hora', 'nombre_contacto', 'whatsapp_contacto'] as $f) {
        if (empty($input[$f])) jsonError("Campo requerido: $f", 400);
    }

    try {
        $db   = getDB($dbKey);
        $stmt = $db->prepare("
            INSERT INTO reserva (idhabitacion_reserva, hora_reserva, fecha_reserva,
                                  valor_reserva, pagado_reserva, respuesta_reserva)
            VALUES (?, ?, ?, ?, '0', ?)
        ");
        $respuesta = json_encode([
            'nombre'   => $input['nombre_contacto'],
            'whatsapp' => $input['whatsapp_contacto'],
            'origen'   => 'whatsapp_bot',
        ], JSON_UNESCAPED_UNICODE);

        $idHab = $input['id_habitacion'] ?? 'bot';
        $stmt->execute([$idHab, $input['hora'], $input['fecha'], $input['valor'] ?? '0', $respuesta]);
        $id = $db->lastInsertId();

        jsonOk([
            'reserva_id'   => (int)$id,
            'confirmacion' => 'RSV-' . str_pad($id, 6, '0', STR_PAD_LEFT),
            'mensaje'      => "Reserva confirmada para el {$input['fecha']} a las {$input['hora']}.",
        ]);
    } catch (Exception $e) {
        error_log('[bridge] crearReserva error: ' . $e->getMessage());
        jsonError('Error creando reserva', 500);
    }
}
```

---

## Tarea 9 — routes/repuestos.php (sin motel_id)

La DB de repuestos NO tiene motel_id en ninguna tabla.
Toda la DB = un solo negocio. Queries sin filtro de tenant.

```php
<?php
function assertRepuesto(string $dbKey): void {
    $info = getDBInfo($dbKey);
    if ($info['tipo'] !== 'repuesto') jsonError('Esta DB no es de repuestos', 400);
}

function buscarStock(): void {
    $dbKey = getDbParam();
    assertRepuesto($dbKey);

    $q = trim($_GET['q'] ?? '');
    if (strlen($q) < 2) jsonError('Búsqueda mínimo 2 caracteres', 400);

    try {
        $stmt = getDB($dbKey)->prepare("
            SELECT
                id_producto,
                nombre_producto,
                codigo_producto,
                codigo_referencia_producto,
                marca_producto,
                cantidad_producto,
                valor_producto,
                costo_producto,
                familia_producto
            FROM producto
            WHERE (
                nombre_producto    LIKE ?
                OR codigo_producto LIKE ?
                OR marca_producto  LIKE ?
                OR codigo_referencia_producto LIKE ?
            )
            AND cantidad_producto > 0
            ORDER BY nombre_producto ASC
            LIMIT 20
        ");
        $like = "%$q%";
        $stmt->execute([$like, $like, $like, $like]);
        $rows = $stmt->fetchAll();

        $productos = array_map(fn($p) => [
            'id'          => (int)$p['id_producto'],
            'nombre'      => $p['nombre_producto'],
            'codigo'      => $p['codigo_producto'],
            'referencia'  => $p['codigo_referencia_producto'],
            'marca'       => $p['marca_producto'],
            'stock'       => (int)$p['cantidad_producto'],
            'precio'      => (int)$p['valor_producto'],
            'categoria'   => $p['familia_producto'],
        ], $rows);

        jsonOk([
            'db'        => $dbKey,
            'busqueda'  => $q,
            'total'     => count($productos),
            'productos' => $productos,
        ]);

    } catch (Exception $e) {
        error_log('[bridge] buscarStock error: ' . $e->getMessage());
        jsonError('Error buscando stock', 500);
    }
}

function getCatalogo(): void {
    $dbKey = getDbParam();
    assertRepuesto($dbKey);

    // Categorías disponibles con cantidad de productos en stock
    try {
        $stmt = getDB($dbKey)->query("
            SELECT
                familia_producto AS categoria,
                COUNT(*) AS total_productos,
                SUM(CASE WHEN cantidad_producto > 0 THEN 1 ELSE 0 END) AS con_stock
            FROM producto
            WHERE familia_producto IS NOT NULL AND familia_producto != ''
            GROUP BY familia_producto
            ORDER BY con_stock DESC
        ");
        $rows = $stmt->fetchAll();

        jsonOk([
            'db'         => $dbKey,
            'categorias' => $rows,
            'timestamp'  => date('c'),
        ]);
    } catch (Exception $e) {
        error_log('[bridge] getCatalogo error: ' . $e->getMessage());
        jsonError('Error obteniendo catálogo', 500);
    }
}
```

---

## Tarea 10 — docker-compose snippet

Agregar al docker-compose.yml principal:
```yaml
  moteland-bridge:
    build:
      context: ./moteland-bridge
      dockerfile: Dockerfile
    container_name: moteland-bridge
    restart: unless-stopped
    environment:
      - PMS_DB_HOST=host.docker.internal
      - PMS_DB_PORT=3306
      - PMS_DB_USER=${PMS_DB_USER}
      - PMS_DB_PASS=${PMS_DB_PASS}
      - INTERNAL_API_SECRET=${INTERNAL_API_SECRET}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks:
      - moteland_net
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

Agregar al .env:
```
PMS_DB_HOST=host.docker.internal
PMS_DB_PORT=3306
PMS_DB_USER=moteland_bridge
PMS_DB_PASS=PASSWORD_DEL_USUARIO_READONLY
```

---

## Tarea 11 — Migración Prisma: pms_db_key y pms_tipo

Agregar al schema.prisma en el modelo Tenant:
```prisma
pms_db_key  String?  // ej: "admin_motelander" — clave para el bridge
pms_tipo    String?  // "motel" | "repuesto"
```

Ejecutar: npx prisma migrate dev --name add-pms-db-key

---

## Tarea 12 — Actualizar src/moteland/client.js

Cambiar el cliente para usar db_key en lugar de id_motel:

```javascript
// config
const BRIDGE_URL = config.MOTELAND_BRIDGE_URL || 'http://moteland-bridge:3080'

// Para moteles:
async getDisponibilidad(tenant) {
  const url = `${BRIDGE_URL}/api/habitaciones/disponibles?db=${tenant.pms_db_key}`
  // ...
}

async getPrecios(tenant) {
  const url = `${BRIDGE_URL}/api/habitaciones/precios?db=${tenant.pms_db_key}`
  // ...
}

// Para repuestos:
async buscarRepuesto(tenant, query) {
  const url = `${BRIDGE_URL}/api/repuestos/stock?db=${tenant.pms_db_key}&q=${encodeURIComponent(query)}`
  // ...
}
```

El agente del bot detecta el tipo via tenant.pms_tipo y elige el handler correcto.
El handler de repuestos necesita manejar intenciones distintas:
- DISPONIBILIDAD → en repuestos significa "¿tienen el repuesto X?"
- PRECIOS → "¿cuánto cuesta X?"

---

## Tarea 13 — SQL para crear usuario de solo lectura

Ejecutar en MariaDB de HestiaCP como root:

```sql
CREATE USER 'moteland_bridge'@'%' IDENTIFIED BY 'PASSWORD_SEGURO_AQUI';

-- Moteles (SELECT en tablas de datos, INSERT en reserva)
GRANT SELECT ON admin_mlunaa.habitacion       TO 'moteland_bridge'@'%';
GRANT SELECT ON admin_mlunaa.habitaciondetalle TO 'moteland_bridge'@'%';
GRANT SELECT ON admin_mlunaa.producto          TO 'moteland_bridge'@'%';
GRANT SELECT ON admin_mlunaa.motel             TO 'moteland_bridge'@'%';
GRANT INSERT ON admin_mlunaa.reserva           TO 'moteland_bridge'@'%';

-- Repetir para: admin_mluzd, admin_mlunap, admin_motelander

-- Repuestos (solo SELECT)
GRANT SELECT ON admin_repuestoand.producto    TO 'moteland_bridge'@'%';
GRANT SELECT ON admin_repuestoand.usuario     TO 'moteland_bridge'@'%';

-- Repetir para: admin_repuestosmoto

FLUSH PRIVILEGES;
```

---

## Tarea 14 — Script de test completo

moteland-bridge/test-bridge.sh:
```bash
#!/bin/bash
BASE="${1:-http://localhost:3080}"
SECRET="${INTERNAL_API_SECRET:-}"
H="-H 'X-Internal-Secret: $SECRET'"

echo "🧪 Test moteland-bridge multi-DB"
echo ""

# Health (verifica todas las DBs)
echo "=== HEALTH ==="
curl -s $BASE/health | python3 -m json.tool
echo ""

# Motel
echo "=== MOTEL: disponibilidad ==="
curl -s -H "X-Internal-Secret: $SECRET" \
  "$BASE/api/habitaciones/disponibles?db=admin_motelander" | python3 -m json.tool
echo ""

echo "=== MOTEL: precios ==="
curl -s -H "X-Internal-Secret: $SECRET" \
  "$BASE/api/habitaciones/precios?db=admin_motelander" | python3 -m json.tool
echo ""

# Repuesto
echo "=== REPUESTO: buscar 'freno' ==="
curl -s -H "X-Internal-Secret: $SECRET" \
  "$BASE/api/repuestos/stock?db=admin_repuestoand&q=freno" | python3 -m json.tool
echo ""

echo "=== REPUESTO: catálogo categorías ==="
curl -s -H "X-Internal-Secret: $SECRET" \
  "$BASE/api/repuestos/catalogo?db=admin_repuestoand" | python3 -m json.tool
echo ""

# Seguridad: DB no registrada → 400
echo "=== SEGURIDAD: DB no válida → debe ser 400 ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Internal-Secret: $SECRET" \
  "$BASE/api/habitaciones/precios?db=admin_cualquier_cosa")
[ "$STATUS" = "400" ] && echo "✅ 400 correcto" || echo "❌ Status: $STATUS"

# Seguridad: sin auth → 401
echo "=== SEGURIDAD: sin auth → debe ser 401 ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/api/habitaciones/precios?db=admin_motelander")
[ "$STATUS" = "401" ] && echo "✅ 401 correcto" || echo "❌ Status: $STATUS"
```

---

## Commit esperado

`feat(bridge): microservicio PHP multi-DB — 4 moteles + 2 repuestos, disponibilidad y stock real`
