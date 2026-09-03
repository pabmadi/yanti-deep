# 06 — Modelo de datos y contratos de API

**Estado:** Borrador implementable sujeto a decisiones pendientes  
**Versión:** 0.1.1  
**Última actualización:** 2026-08-07  
**Responsable:** Arquitectura de datos / API  
**Audiencia:** Ingeniería, QA, Producto, Seguridad, Operaciones y Auditoría  
**Carácter:** Fuente de verdad para persistencia, contratos HTTP, eventos e integraciones del MVP

> Este documento deriva de `01_PRD.md`, `02_FSD.md`, `03_DOMAIN_AND_STATE_MACHINES.md` y `07_PAYMENTS_DISPUTES.md`. No resuelve `DP-001` a `DP-021`, no presupone capacidades de Mercado Pago y no contiene secretos. Una ruta que dependa de una decisión abierta solo puede operar si existe una política y una matriz de capacidad aprobadas; de lo contrario responde `DECISION_PENDING` o `CAPABILITY_NOT_ENABLED`.

## 1. Propósito, alcance y precedencia

Este documento define el contrato lógico —independiente del motor de base de datos y framework— para:

- modelo relacional y propiedad de los datos;
- dinero, tiempo, políticas congeladas, evidencia y auditoría;
- API HTTP `/v1`, autenticación y autorización por recurso;
- idempotencia, concurrencia optimista y paginación;
- cargas de archivos, webhooks, eventos internos y entrega externa;
- migraciones, retención, privacidad y criterios contractuales.

Precedencia: decisiones aprobadas → PRD → FSD → modelo de dominio → `07_PAYMENTS_DISPUTES.md` para semántica financiera → arquitectura técnica → este documento para representación y contratos → código. Se revisó `05_TECHNICAL_ARCHITECTURE.md`: este contrato adopta PostgreSQL/Cloud SQL, outbox/inbox transaccional y Cloud Storage privado propuestos allí, sin convertir recomendaciones técnicas pendientes de ratificación en reglas de negocio. Si 06 no puede representar una invariante financiera de 07, se corrige 06; no se debilita la invariante.

### 1.1 Alineación con la arquitectura técnica

- La fuente interna transaccional es PostgreSQL en Cloud SQL; el proveedor sigue siendo autoridad del resultado financiero externo.
- API NestJS/Fastify y workers comparten los contratos, pero solo API/workers acceden a la base.
- `operation`, ledger, holds, idempotencia, auditoría, `webhook_inbox`, `outbox` y tareas durables viven en PostgreSQL.
- Los blobs viven en Cloud Storage privado; PostgreSQL conserva metadatos, hashes, ownership y estado de análisis.
- Cloud Tasks/Scheduler entregan al menos una vez; las claves y restricciones de este documento logran efecto funcional a lo sumo una vez.
- Estas elecciones corresponden a `AR-REC-001..005`/`DP-019` y requieren ratificación según el documento 05; cambiar tecnología no autoriza cambiar contratos.

## 2. Convenciones normativas

- **DEBE / NO DEBE:** requisito obligatorio.
- Identificadores públicos: opacos, no secuenciales y no inferibles. El código legible de operación es solo para búsqueda/soporte.
- IDs de ejemplo usan prefijos (`op_`, `pay_`, `dsp_`, `ret_`, `fo_`, `rat_`, `evt_`) únicamente para legibilidad; el formato físico queda en arquitectura.
- JSON usa `snake_case`; fechas usan RFC 3339 UTC, por ejemplo `2026-08-07T15:03:22.123Z`.
- Importes usan enteros en unidades menores y código ISO 4217; nunca punto flotante.
- Campos desconocidos en requests se rechazan en operaciones financieras/sensibles y pueden ignorarse solo donde el contrato lo permita expresamente.
- Valores de enum son estables dentro de una versión mayor. Los clientes DEBEN tolerar valores futuros al mostrar estados, pero no deben inventar acciones.
- Los ejemplos son ilustrativos y no fijan países, monedas, tasas, plazos ni capacidades productivas.

## 3. Principios de propiedad y límites

| Conjunto de datos | Contexto propietario | Escritura permitida | Consumidores |
|---|---|---|---|
| Cuenta, correo, preferencias, consentimientos | Identidad | Identidad | Todos por referencia/proyección minimizada |
| Operación, participantes, acuerdo, política congelada | Operaciones | Operaciones | Pagos, logística, disputas, dashboards |
| Política y matriz de lanzamiento/capacidad | Políticas | Administrador del sistema vía Políticas | Operaciones, pagos, plazos, reputación |
| Intentos, conciliaciones, órdenes y asientos | Pagos/Libro | Pagos; nunca UI directa | Operaciones, disputas, auditoría |
| Envío, tracking y evidencia logística | Logística | Vendedor/sistema mediante Logística | Operaciones, disputa |
| Reclamo, evidencia, resolución | Disputas | Partes/admin mediante Disputas | Operaciones, finanzas, devolución |
| Devolución | Devoluciones | Partes/admin/sistema mediante Devoluciones | Disputa, finanzas |
| Calificación y reputación | Reputación | Partes/moderación mediante Reputación | Perfil público |
| Notificación y entrega | Notificaciones | Sistema/proveedores de comunicación | Soporte, auditoría |
| Auditoría | Auditoría append-only | Sistema | Personal autorizado |

Ningún contexto actualiza directamente el estado propietario de otro. Usa comando público o evento. Las proyecciones no son fuentes de verdad y deben poder reconstruirse.

## 4. Modelo lógico de datos

### 4.1 Relaciones principales

```text
account 1 ── n operation_party n ── 1 operation
operation 1 ── n agreement_version
operation 1 ── n pricing_quote
operation 1 ── 0..1 frozen_policy_snapshot
frozen_policy_snapshot 1 ── 1 financial_breakdown_snapshot
operation 1 ── 1 payment ── n payment_attempt ── n provider_observation
operation 1 ── 1 operation_ledger ── n journal_entry ── 2..n ledger_posting
operation 1 ── n hold
operation 1 ── 0..1 shipment ── n tracking_version
operation 1 ── n evidence_item ── 1..n evidence_blob_version
operation 1 ── 0..1 dispute ── n dispute_submission
dispute   1 ── 0..1 resolution ── n resolution_approval
dispute   1 ── n settlement_proposal ── n settlement_acceptance
resolution 1 ── 0..1 return_case
operation 1 ── n financial_order
operation 1 ── 0..2 rating
account 1 ── 1 reputation_projection_by_role
policy_definition 1 ── n policy_version
operation 1 ── n domain_event / audit_record / notification
dispute   1 ── n internal_admin_note
```

### 4.2 Tablas y documentos lógicos

| Recurso lógico | Clave y relaciones | Campos obligatorios destacados | Restricciones esenciales |
|---|---|---|---|
| `account` | `account_id` | estado, nombre visible, locale, país, zona, timestamps | correo no vive en perfil público; versión optimista |
| `account_email` | `email_id`, FK cuenta | original, canónico, verificado_en, estado | unicidad canónica según política; cambio no rompe historial |
| `consent_acceptance` | `consent_id`, FK cuenta/operación opcional | tipo, versión, idioma, texto_hash, aceptado_en, evidencia | append-only |
| `operation` | `operation_id`, `support_code` | país, moneda, monto base, categoría, estado coordinador, versión | `operation_party` es la fuente canónica de comprador/vendedor; moneda/monto inmutables tras aceptación |
| `operation_party` | `(operation_id, role)` | `account_id`, rol, vinculado_en | exactamente un `BUYER` y un `SELLER`, distintos; cualquier columna redundante en `operation` es solo proyección y se actualiza atómicamente |
| `agreement_version` | `(operation_id, agreement_version)` | descripción, condición, enlace, snapshot de campos, creado_por, sellado_en | versión aceptada inmutable; una activa aceptada |
| `pricing_quote` | `quote_id`, FK operación, versión | inputs, políticas candidatas, desglose, vence_en, creado_en | versionable y no autoriza pago; puede recalcularse hasta el hito de `DP-005` |
| `frozen_policy_snapshot` | `snapshot_id`, FK única operación | hito, versiones resueltas, valores efectivos, redondeo, plazos, hashes legales | `0..1` antes del hito de `DP-005`; exactamente uno antes del primer efecto que dependa de él; inmutable |
| `financial_breakdown_snapshot` | `breakdown_snapshot_id`, FK snapshot/operación | principal, fees, impuestos, buyer_total, seller_net_estimate, redondeo | uno por snapshot congelado; inmutable y reconciliable por componentes |
| `payment` | `payment_id`, FK operación | `expected_collected_total`, `breakdown_snapshot_id`, moneda, estado agregado, intento acreditado | uno por operación; total esperado inequívoco; máximo un intento acreditado |
| `payment_attempt` | `attempt_id`, FK pago | proveedor, referencia, estado, importes observados, idempotencia | referencia externa única por ámbito; estado monotónico |
| `webhook_inbox` / `provider_observation` | `inbox_id`/`observation_id`, FK intento/orden cuando se correlaciona | proveedor, entorno, account_scope, tipo, external_event_id, resource_reference, payload_hash, estado autenticación/proceso, recibido_en | recepción durable; scope canónico único; fallback sin efecto financiero directo; payload original protegido |
| `operation_ledger` | `ledger_id`, FK operación | moneda, estado conciliación | una moneda por libro |
| `journal_entry` | `journal_entry_id`, FK libro | tipo, moneda, estado, causa, correlación, contabilizado_en, `reverses_entry_id` opcional | append-only al quedar `POSTED`; transición atómica; no se edita ni elimina |
| `ledger_posting` | `posting_id`, FK asiento | cuenta lógica, lado `DEBIT/CREDIT`, monto positivo, componente, participante económico opcional | al menos dos por asiento; débitos = créditos por moneda antes de `POSTED` |
| `hold` | `hold_id`, FK operación | tipo, acciones bloqueadas, origen, estado, creado/levantado | conjunto; levantar requiere autoridad explícita |
| `shipment` | `shipment_id`, FK operación | estado, modalidad, transportista, despacho, entrega estimada, política | uno ordinario por operación MVP |
| `tracking_version` | `tracking_version_id`, FK envío | código/URL, autor, válido_desde, reemplaza_a | corrección agrega versión |
| `evidence_item` | `evidence_id`, FK operación y opcional disputa/devolución/envío | propósito, autor, visibilidad, estado seguridad, timestamps | nunca reemplazar original silenciosamente |
| `evidence_blob_version` | `blob_version_id`, FK evidencia | object_key opaca de Cloud Storage, hash, tamaño, mime detectado, estado análisis, original | acceso mediante autorización; no URL pública permanente |
| `dispute` | `dispute_id`, FK única operación | motivo, estado, abierto_en, límites, revisor, versión | máximo una disputa ordinaria activa |
| `dispute_submission` | `submission_id`, FK disputa | parte, alegación, evidencias, compartibilidad, presentado_en | append-only; ventana/actor válidos |
| `information_request` | `request_id`, FK disputa | destinatario, texto, vence_en, estado, respuesta | vencimiento explícito; silencio es hecho, no fallo implícito |
| `resolution` | `resolution_id`, FK disputa | tipo, versión, motivo, explicación, allocation, requisitos, autor, confirmado_en | inmutable al confirmar; asignación total y saldo válido |
| `resolution_approval` | `approval_id`, FK resolución | aprobador, decisión, motivo, instante | segundo aprobador distinto cuando aplica |
| `settlement_proposal` | `proposal_id`, FK disputa, versión | proponente, términos, allocation completa, vence_en, estado, reemplaza_a | append-only por versión; doble aceptación no mueve dinero; revocable/expirable antes de aceptación mutua |
| `settlement_acceptance` | `acceptance_id`, FK propuesta | parte `BUYER/SELLER`, proposal_version, aceptado_en, consentimiento | una por parte y versión; cambio de propuesta invalida aceptaciones previas |
| `internal_admin_note` | `note_id`, FK disputa/operación | autor, propósito, texto, visibilidad `ADMIN_ONLY`, creado_en, `supersedes_note_id` opcional | append-only, nunca evidencia compartida ni audit log; acceso y creación auditados |
| `return_case` | `return_id`, FK resolución | instrucciones, costo, plazo, hito reembolso, inacción, estado | todos los campos decisorios explícitos |
| `financial_order` | `order_id`, FK operación/resolución | tipo, monto, moneda, causa, destino funcional, estado, idempotencia | reserva/saldo; confirmación reconciliada |
| `rating` | `rating_id`, FK operación | autor, evaluado, rol, escala, comentario, estado, policy_version | único por operación/autor/rol; sin autocalificación |
| `reputation_projection` | `(account_id, role, projection_version)` | conteos, score, ventana, actualizado_en | reconstruible; no editar manualmente |
| `policy_definition/version` | IDs y versión | ámbito, valores, vigencia, estado, autor, motivo | no editar tras publicación; sin ambigüedad efectiva |
| `idempotency_record` | `(scope, key)` | request_hash, estado, status_code, response_ref, expira_en | misma clave + otro hash = conflicto |
| `domain_event` / `outbox` | `event_id`/`outbox_id` | agregado/versión, tipo, payload versionado, correlación, causalidad, estado/intentos de despacho | append-only; commit atómico; publicación al menos una vez; reclamación concurrente segura |
| `task_execution` | `task_id` | tipo, clave estable, vencimiento, estado, intentos, último error clasificado | una ejecución funcional por clave; workers idempotentes |
| `audit_record` | `audit_id` | actor/rol efectivo, acción, recurso, antes/después permitido, motivo, correlación | append-only y acceso restringido |
| `notification` / `delivery_attempt` | IDs | destinatario, plantilla/idioma, estado, dedupe_key, proveedor, intentos | entrega no cambia el hecho de negocio |

### 4.3 Restricciones de unicidad mínimas

- `operation.support_code` único sin revelar orden de creación.
- `operation_party(operation_id, role)` único; roles `BUYER` y `SELLER` exactamente una vez.
- `payment(operation_id)` único.
- índice parcial/lógico único de `payment_attempt(payment_id)` donde estado = `ACCREDITED`.
- `provider_observation(provider, environment, account_scope, external_event_id)` único cuando existe ID estable; fallback único por `(provider, environment, account_scope, resource_reference, observed_type, payload_hash)` y siempre sujeto a consulta/reconciliación.
- `dispute(operation_id, dispute_kind)` único para reclamo ordinario.
- `settlement_proposal(dispute_id, proposal_version)` único y `settlement_acceptance(proposal_id, proposal_version, party_role)` único.
- `financial_order(operation_id, order_type, cause_id, resolution_version)` único.
- `rating(operation_id, author_account_id, evaluated_role)` único.
- `domain_event(aggregate_id, aggregate_version)` único.
- `idempotency_record(scope, key)` único.
- `ledger_posting` no puede existir sin `journal_entry`; un asiento solo pasa a `POSTED` si tiene al menos dos postings y suma de débitos igual a créditos en su moneda, dentro de la misma transacción.

La base de datos DEBE reforzar invariantes críticas además del código cuando la tecnología lo permita.

## 5. Contratos transversales de datos

### 5.1 Dinero

```json
{
  "amount_minor": 125000,
  "currency": "XXX"
}
```

`amount_minor` es entero con rango definido por la política y capacidad del proveedor. `currency` debe coincidir en toda suma. La cantidad de decimales se obtiene de un catálogo ISO versionado; no se infiere del locale.

Desglose congelado:

```json
{
  "breakdown_snapshot_id": "brk_example",
  "base_amount": {"amount_minor": 125000, "currency": "XXX"},
  "buyer_fee": {"amount_minor": 0, "currency": "XXX"},
  "seller_fee": {"amount_minor": 0, "currency": "XXX"},
  "known_taxes": [],
  "buyer_total": {"amount_minor": 125000, "currency": "XXX"},
  "seller_net_estimate": {"amount_minor": 125000, "currency": "XXX"},
  "rounding_rule_id": "rounding_rule_example",
  "frozen_policy_snapshot_id": "ps_example"
}
```

Los ceros son ilustrativos, no valores productivos. El tratamiento de comisiones en resolución depende de `DP-006` y `DP-007`.

`payment.expected_collected_total` siempre referencia `buyer_total` de `breakdown_snapshot_id`; nunca el principal aislado. Todo evento de acreditación usa los nombres `expected_collected_total` y `observed_collected_total`, más `breakdown_snapshot_id`, en lugar de un campo ambiguo `amount`.

### 5.2 Tiempo y plazos

```json
{
  "starts_at": "2026-08-07T15:03:22Z",
  "due_at": "2026-08-10T15:03:22Z",
  "policy_timezone": "Region/City",
  "calendar_type": "CALENDAR_DAYS",
  "cutoff_rule_id": "cutoff_example",
  "policy_version_id": "pv_example"
}
```

`calendar_type`, corte y valores requieren resolución de `DP-009`, `DP-010` o `DP-014`. La API muestra además `display_timezone` solo como presentación; no cambia el vencimiento persistido.

### 5.3 Cotización y snapshot de política

Antes del hito `DP-005`, una operación puede tener cero o más `pricing_quote` y cero `frozen_policy_snapshot`. Una cotización puede expirar o ser reemplazada y no autoriza un efecto financiero. Al alcanzar el hito aprobado, se crea exactamente un snapshot congelado a partir de una cotización revalidada; desde ese momento no se muta.

```json
{
  "frozen_policy_snapshot_id": "ps_example",
  "frozen_at": "2026-08-07T15:03:22Z",
  "freeze_milestone": "APPROVED_VALUE_REQUIRED",
  "scope": {"country": "XX", "currency": "XXX", "category": "physical_goods"},
  "resolved_versions": [
    {"policy_type": "FEES", "policy_version_id": "pv_example", "content_hash": "sha256:..."}
  ],
  "effective_values": {},
  "legal_text_versions": []
}
```

`freeze_milestone` no puede quedar como el valor de ejemplo en una operación ejecutable; depende de `DP-005`.

### 5.4 Estados y acciones disponibles

Las respuestas de operación incluyen `state` y `available_actions`. El cliente solo usa esta última para presentación; el servidor vuelve a validar.

```json
{
  "state": "PAID_AWAITING_SHIPMENT",
  "state_version": 12,
  "available_actions": ["CREATE_SHIPMENT_DRAFT", "DECLARE_SHIPMENT"]
}
```

Valores técnicos canónicos de `operation.state`, alineados con el catálogo del documento 03:

`DRAFT`, `AWAITING_ACCEPTANCE`, `ACCEPTED_AWAITING_PAYMENT`, `PAYMENT_IN_PROGRESS`, `PAID_AWAITING_SHIPMENT`, `SHIPPED_AWAITING_RECEIPT`, `CONFIRMATION_OVERDUE`, `IN_DISPUTE`, `RETURN_REQUIRED`, `RELEASE_IN_PROGRESS`, `REFUND_IN_PROGRESS`, `COMPLETED`, `REFUNDED`, `CANCELLED`, `EXPIRED`, `EXCEPTION_REVIEW`.

Estados canónicos de intento de pago:

`CREATED`, `PENDING_USER_PROVIDER`, `UNDER_REVIEW`, `ACCREDITED_PENDING_RECONCILIATION`, `ACCREDITED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `INCONSISTENT`.

Tipos canónicos de orden: `RELEASE`, `REFUND`, `AUTHORIZED_ADJUSTMENT`.

Estados canónicos de orden financiera:

`INTENT_RECORDED`, `READY_TO_SEND`, `SENT`, `RESULT_UNKNOWN`, `PENDING_CONFIRMATION`, `CONFIRMED`, `REJECTED`, `RETRYABLE_FAILURE`, `MANUAL_REVIEW`, `CANCELLED_BEFORE_SEND`.

Tipos canónicos de retención: `DISPUTE_OPEN`, `RISK_REVIEW`, `CHARGEBACK`, `PAYMENT_INCONSISTENCY`, `FINANCIAL_ORDER_UNKNOWN`, `SHIPMENT_INCIDENT`, `RETURN_INCIDENT`, `ADMINISTRATIVE`, `PROVIDER_CAPABILITY_UNVERIFIED`, `LATE_PAYMENT_REVIEW`.

Estados canónicos de disputa:

`NONE`, `OPEN`, `AWAITING_RESPONSE`, `COLLECTING_EVIDENCE`, `UNDER_REVIEW`, `AWAITING_INFORMATION`, `RESOLUTION_PROPOSED`, `PENDING_SECOND_APPROVAL`, `RESOLVED_RELEASE`, `RESOLVED_REFUND`, `RESOLVED_RETURN`, `RESOLVED_SETTLEMENT`, `EXCEPTION_CORRECTION`.

Estados canónicos de devolución:

`INSTRUCTIONS_ISSUED`, `PREPARING`, `DISPATCHED`, `IN_TRANSIT`, `RECEIVED_AWAITING_CONFIRMATION`, `RECEIVED_CONFIRMED`, `INCIDENT`, `BUYER_DEFAULTED`, `CLOSED_REFUND`, `CLOSED_CONSEQUENCE`.

Estados canónicos persistentes de propuesta de acuerdo: `DRAFT`, `OPEN`, `PARTIALLY_ACCEPTED`, `SUBMITTED_FOR_REVIEW`, `INCORPORATED_IN_RESOLUTION`, `REVOKED`, `EXPIRED`. La aceptación mutua es un hecho/evento, no un estado estable.

Estados canónicos de revisión de pago tardío: `OPEN`, `RECONCILING`, `PENDING_DECISION`, `COMPENSATING_ORDER_IN_PROGRESS`, `CLOSED_NO_MOVEMENT`, `CLOSED_COMPENSATED`. Este subproceso es ortogonal: `CANCELLED` o `EXPIRED` conserva su terminal histórico.

Las etiquetas españolas del FSD son presentación; no viajan como enums. Los estados de subprocesos, tipos de eventos y transiciones deben usar la tabla normativa de correspondencia del documento 03. OpenAPI y AsyncAPI se generan o validan contra ese catálogo; no pueden crear sinónimos locales.

### 5.5 Actor, correlación y auditoría

Cada escritura recibe/genera `X-Correlation-Id`; si el cliente lo envía debe ser opaco, válido y sin PII. La respuesta siempre devuelve el ID aceptado. El sistema genera `causation_id` interno y registra cuenta, rol efectivo y sujeto afectado.

## 6. Versionado, migraciones y retención

### 6.1 Versionado de esquema

- La API usa versión mayor en ruta: `/v1`.
- Cambios compatibles agregan campos opcionales, endpoints o valores de enum; no cambian semántica existente.
- Eliminar/renombrar campos, cambiar tipos, obligatoriedad o semántica requiere nueva versión mayor y período de migración aprobado.
- Eventos internos incluyen `schema_version`; consumidores deben rechazar a dead-letter versiones no soportadas sin perderlas.
- Payloads de proveedor se conservan como observaciones protegidas y se traducen a un esquema canónico versionado.

### 6.2 Migraciones

- Toda migración tiene ID, checksum, autor, fecha, compatibilidad hacia atrás, plan de verificación y rollback/forward-fix.
- Cambios expansivos preceden al despliegue de código; contracciones ocurren solo tras dejar de escribir/leer el campo y medir uso cero.
- Backfills son idempotentes, acotados, observables y no fabrican hechos de dominio.
- Estados históricos desconocidos no se fuerzan a un estado exitoso; se mapean a revisión explícita.
- Un cambio de política nunca se implementa como migración retroactiva de operaciones.

### 6.3 Retención, borrado y privacidad

Las duraciones exactas dependen de `DP-018` y obligaciones legales por país. Hasta su aprobación:

- no se codifican períodos definitivos;
- datos financieros, auditoría, consentimientos, fallos y evidencia permanecen bajo retención legal configurable;
- solicitudes de supresión producen anonimización/restricción cuando legalmente corresponda, sin romper libro, prevención de fraude o trazabilidad;
- el ciclo de seguridad del blob usa `PENDING`, `SCANNING`, `ACCEPTED`, `REJECTED`, `RESTRICTED`; solo `ACCEPTED` es evidencia utilizable. La retención se modela aparte con `ACTIVE`, `LOGICALLY_DELETED`, `LEGAL_HOLD`, `PURGED`; `PURGED` solo por política aprobada y registro auditable;
- perfiles públicos se despublican separadamente de la conservación interna;
- backups y réplicas obedecen un proceso documentado de expiración, no borrado ad hoc.

## 7. Estilo de API HTTP

### 7.1 Base y representación

- Base: `/v1`.
- `Content-Type: application/json`; errores: `application/problem+json`.
- Respuestas incluyen `request_id`, y recursos versionables incluyen `version` y `ETag`.
- Timestamps siempre RFC 3339 UTC; locale no altera valores.
- `Accept-Language` puede elegir texto de presentación; códigos y datos son estables.

### 7.2 Autenticación

- Endpoints privados requieren sesión segura derivada de magic link.
- Cookies, tokens y CSRF exactos se definen en Seguridad/Arquitectura; nunca se incluyen en URL ni logs.
- Magic links son de un uso, expirables y almacenados como hash/verificador, no token recuperable.
- El `GET` originado por el enlace NO consume el desafío: solo presenta una página local de continuación sin subrecursos externos, con política de referrer restrictiva. El consumo atómico ocurre únicamente mediante `POST` tras interacción explícita; scanners y prefetch no pueden invalidar el enlace.
- Acciones financieras, resolución y cambios administrativos pueden exigir autenticación reciente según política.
- Los endpoints administrativos permanecen deny-by-default hasta aprobar `DTA-SEC-001`: IdP corporativo, MFA, identidad interna vinculada, origen/sesión separados, lifecycle, recent auth y break-glass. Una sesión de participante por magic link no concede privilegios administrativos.

### 7.3 Autorización por recurso

La autorización evalúa: identidad, rol global, rol en operación, estado, acción, país/ámbito, restricciones de cuenta, retenciones y sensibilidad. Un ID válido no concede acceso.

| Recurso/acción | Comprador | Vendedor | Soporte | Admin operaciones | Admin sistema |
|---|---:|---:|---:|---:|---:|
| Ver operación propia | Sí | Sí | Lectura autorizada | Sí | Según permiso |
| Crear/enviar/cancelar solicitud | No | Sí propia | No | Cancelación excepcional | No |
| Aceptar/pagar/confirmar/reclamar | Sí propia | No | No | No | No |
| Declarar envío | No | Sí propia | No | Corrección excepcional | No |
| Evidencia compartible propia | Sí | Sí | Según necesidad | Sí | Según permiso |
| Resolver disputa | No | No | No | Sí, sin conflicto | Solo permiso específico |
| Ejecutar acción financiera | No | No | No | Según umbral | Permiso financiero |
| Política | Lectura efectiva mínima | Igual | No | Simulación si permiso | Administración |

Para recursos ajenos se recomienda `404 RESOURCE_NOT_FOUND` en vez de distinguir existencia con `403`, salvo consola autorizada.

### 7.4 Idempotencia HTTP

`Idempotency-Key` es obligatorio en POST que crea operación, intento de pago, reclamo, declaración de envío, confirmación, resolución y orden/acción financiera. Reglas:

- longitud y caracteres limitados; clave opaca sin PII;
- ámbito = actor + endpoint + recurso padre;
- se almacena hash canónico del request;
- mismo ámbito/clave/hash devuelve el status y referencia originales;
- misma clave con otro hash responde `409 IDEMPOTENCY_KEY_REUSED`;
- la ventana de retención es configurable y no puede expirar mientras una orden financiera pueda reintentarse.

### 7.5 Concurrencia optimista

- GET devuelve `ETag: "12"` y campo `version: 12`.
- PATCH/acciones sensibles exigen `If-Match: "12"`.
- Ausencia donde es obligatorio: `428 PRECONDITION_REQUIRED`.
- Desajuste: `412 VERSION_MISMATCH`, con enlace para recargar; no aplica escritura parcial.
- Webhooks usan unicidad de evento y transición monotónica, no `If-Match` del proveedor.

### 7.6 Paginación y filtros

Listados usan cursor opaco estable:

```json
{
  "data": [],
  "page": {"next_cursor": null, "has_more": false},
  "request_id": "req_example"
}
```

- `limit` predeterminado y máximo se configuran técnicamente; no forman política financiera.
- Orden por defecto estable: `updated_at DESC, operation_id DESC`.
- Cursor fija orden y filtros; reutilizarlo con filtros distintos responde `400 INVALID_CURSOR`.
- No se exponen conteos exactos costosos o sensibles salvo necesidad.
- Filtros: `state`, `role`, `created_from`, `created_to`, `currency`, `requires_action`; búsqueda por código o contraparte autorizada.

## 8. Sobre de recursos y errores

### 8.1 Éxito

```json
{
  "data": {"operation_id": "op_example", "version": 3},
  "request_id": "req_example"
}
```

### 8.2 Error RFC 9457 compatible

```json
{
  "type": "https://api.example.invalid/problems/version-mismatch",
  "title": "El recurso cambió",
  "status": 412,
  "code": "VERSION_MISMATCH",
  "detail": "Actualiza la operación antes de volver a intentar.",
  "instance": "/v1/operations/op_example",
  "request_id": "req_example",
  "correlation_id": "corr_example",
  "errors": [
    {"field": "if_match", "code": "STALE_VERSION"}
  ]
}
```

No incluye stack, SQL, payload externo, secreto, reglas antifraude ni existencia de recursos ajenos.

| HTTP | Código estable | Uso |
|---:|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_CURSOR` | Sintaxis/campo/formato |
| 401 | `AUTHENTICATION_REQUIRED`, `RECENT_AUTH_REQUIRED` | Sin sesión o sesión insuficiente |
| 403/404 | `ACTION_NOT_ALLOWED`, `RESOURCE_NOT_FOUND` | Permiso; ocultar enumeración |
| 409 | `INVALID_STATE_TRANSITION`, `IDEMPOTENCY_KEY_REUSED`, `ACTIVE_DISPUTE_EXISTS` | Conflicto de dominio |
| 412 | `VERSION_MISMATCH` | ETag desactualizado |
| 422 | `BUSINESS_RULE_VIOLATION`, `DECISION_PENDING`, `CAPABILITY_NOT_ENABLED` | Payload válido pero regla no satisfecha |
| 428 | `PRECONDITION_REQUIRED` | Falta `If-Match` |
| 429 | `RATE_LIMITED` | Límite; puede incluir `Retry-After` |
| 503 | `DEPENDENCY_UNAVAILABLE` | Proveedor temporal; estado no se marca éxito |
| 202 | No error | Acción aceptada y asíncrona; usar recurso de operación/orden |

## 9. Endpoints de identidad y perfil

| Método y ruta | Propósito | Auth / idempotencia | Resultado |
|---|---|---|---|
| `POST /v1/auth/magic-links` | Solicitar enlace | Público; rate limit; idempotencia recomendada | `202` siempre no revelador |
| `POST /v1/auth/magic-links/consume` | Consumir token una vez | Público con token en body; idempotente por desafío | Sesión y ruta interna segura |
| `POST /v1/auth/logout` | Cerrar sesión | Sesión | `204` |
| `GET /v1/me` | Perfil privado | Sesión | Cuenta y preferencias |
| `PATCH /v1/me` | Editar campos permitidos | Sesión + `If-Match` | Perfil actualizado |
| `GET /v1/public-profiles/{public_id}` | Perfil minimizado | Público | Reputación publicable; nunca correo/documentos |
| `POST /v1/me/consents` | Aceptar versión de texto | Sesión + idempotencia | Registro append-only |

Solicitud de magic link:

```json
{"email": "person@example.invalid", "return_path": "/operations/op_example", "locale": "es"}
```

`return_path` debe ser relativa y pertenecer a una allowlist de rutas; nunca URL externa.

El enlace de email abre una ruta web `GET /auth/continue`; esa ruta no invoca consumo automáticamente. El token solo se envía en el body de `POST /v1/auth/magic-links/consume`, no en analítica, logs, referrers ni requests de assets externos.

## 10. Endpoints de operaciones y acuerdos

| Método y ruta | Acción | Actor | Contratos clave |
|---|---|---|---|
| `POST /v1/operations` | Crear borrador | Vendedor | `Idempotency-Key`; participantes, país, moneda, dinero |
| `GET /v1/operations/{id}` | Detalle canónico | Participante/admin autorizado | Campos filtrados por rol; ETag |
| `PATCH /v1/operations/{id}/draft` | Editar borrador | Vendedor | `If-Match`; solo `DRAFT` |
| `POST /v1/operations/{id}/send` | Sellar y enviar | Vendedor | Idempotencia + `If-Match`; elegibilidad/política |
| `POST /v1/operations/{id}/accept` | Aceptar versión | Comprador | Consentimientos + `If-Match` |
| `POST /v1/operations/{id}/cancel` | Cancelar no pagada | Vendedor/admin excepcional | Motivo admin; guardas de pago |
| `GET /v1/operations` | Dashboard compras/ventas | Sesión | Cursor, filtros, autorización por participante |
| `GET /v1/operations/{id}/timeline` | Eventos publicables | Participante/admin | Cursor; minimización |
| `GET /v1/operations/{id}/financial-summary` | Desglose | Participante/admin | Vistas adecuadas; misma moneda |

Crear borrador:

```json
{
  "buyer_email": "buyer@example.invalid",
  "operating_country": "XX",
  "currency": "XXX",
  "base_amount": {"amount_minor": 125000, "currency": "XXX"},
  "category_code": "configured_category",
  "agreement": {
    "title": "Artículo acordado",
    "description": "Descripción material suficiente",
    "condition_code": "configured_condition",
    "listing_url": "https://marketplace.example.invalid/item/reference"
  },
  "locale": "es"
}
```

Respuesta abreviada:

```json
{
  "data": {
    "operation_id": "op_example",
    "support_code": "SAFE-EXAMPLE",
    "state": "DRAFT",
    "version": 1,
    "base_amount": {"amount_minor": 125000, "currency": "XXX"},
    "available_actions": ["EDIT_DRAFT", "SEND_REQUEST"]
  },
  "request_id": "req_example"
}
```

La respuesta completa de operación puede incluir `payment`, `shipment`, `dispute`, `return_case` y `financial_order` como resúmenes, nunca payloads crudos de proveedores.

## 11. Endpoints de pagos y conciliación

| Método y ruta | Acción | Actor | Resultado |
|---|---|---|---|
| `POST /v1/operations/{id}/payment-attempts` | Crear intento | Comprador | `202/201`; sesión/redirección del proveedor solo si capacidad habilitada |
| `GET /v1/operations/{id}/payment` | Estado canónico | Participante/admin | No expone datos de instrumento |
| `GET /v1/payment-attempts/{id}` | Ver intento propio | Comprador/admin | Estado canónico y próxima acción |
| `POST /v1/admin/payments/{id}/reconcile` | Solicitar conciliación | Admin autorizado/sistema | `202`; motivo, recent auth, auditoría |
| `GET /v1/admin/financial-orders/{id}` | Inspección | Permiso financiero | Intentos y conciliación minimizados |
| `POST /v1/admin/financial-orders/{id}/retry` | Reintento controlado | Permiso financiero + recent auth | `reason_code`, nota, `If-Match`, `Idempotency-Key`, auditoría; solo estado elegible y misma identidad externa |

```json
{
  "data": {
    "payment_attempt_id": "payatt_example",
    "state": "PENDING_USER_PROVIDER",
    "provider": "MERCADO_PAGO",
    "expected_collected_total": {"amount_minor": 125000, "currency": "XXX"},
    "breakdown_snapshot_id": "brk_example",
    "next_action": {
      "type": "REDIRECT",
      "url": "https://provider.example.invalid/session/opaque",
      "expires_at": "2026-08-07T15:20:00Z"
    }
  },
  "request_id": "req_example"
}
```

La URL es efímera, no se persiste en logs, y su retorno nunca acredita. La acreditación requiere webhook autenticado **o** consulta autoritativa, siempre correlacionada y reconciliada contra `expected_collected_total`, moneda, entorno, account scope y operación. Qué modelo de pago, retención, liberación o reembolso se usa depende de `DP-002` y `DP-003`.

El retry administrativo recibe:

```json
{
  "reason_code": "TRANSIENT_FAILURE_CONFIRMED",
  "note": "Motivo operativo sin datos sensibles."
}
```

Requiere versión vigente y crea una ejecución auditada con respuesta `202`. Está prohibido si la orden está `RESULT_UNKNOWN`: primero debe consultarse y reconciliarse; tampoco puede cambiar clave, payload material, importe o destino.

## 12. Endpoints de envío y evidencia

| Método y ruta | Acción | Actor | Guardas |
|---|---|---|---|
| `POST /v1/operations/{id}/shipment` | Crear/obtener borrador | Vendedor | Pago acreditado/conciliado |
| `PATCH /v1/shipments/{id}` | Editar borrador | Vendedor | `If-Match`; no declarado |
| `POST /v1/shipments/{id}/declare` | Declarar despacho | Vendedor | Idempotencia, `If-Match`, evidencia completa |
| `POST /v1/shipments/{id}/tracking-versions` | Corregir/completar | Vendedor/admin excepcional | Nueva versión; motivo si material |
| `POST /v1/operations/{id}/confirm-receipt` | Confirmar conforme | Comprador | Idempotencia, recent auth posible, sin disputa/retención |
| `POST /v1/evidence/uploads` | Iniciar carga segura | Actor autorizado | Propósito, tamaño, tipo declarado |
| `POST /v1/evidence/uploads/{upload_id}/complete` | Finalizar | Mismo actor | Hash/tamaño, objeto presente; inicia análisis |
| `GET /v1/evidence/{id}` | Metadatos | Parte/admin autorizado | Visibilidad/need-to-know; no devuelve URL bearer de lectura sensible |
| `GET /v1/evidence/{id}/content` | Ver/descargar por gateway | Parte/admin autorizado | Sesión, autorización por recurso y auditoría del actor; streaming con headers seguros |

Declarar envío:

```json
{
  "carrier_code": "configured_carrier",
  "tracking": {"code": "opaque-tracking-code", "url": null},
  "shipped_at": "2026-08-07T15:03:22Z",
  "estimated_delivery_at": "2026-08-10T15:03:22Z",
  "evidence_ids": ["ev_example"]
}
```

La API valida la fecha con la política congelada; no asume que diez días sea el valor productivo.

## 13. Contrato de cargas seguras

### 13.1 Flujo

1. Cliente solicita `upload` con propósito, nombre saneado, MIME declarado y tamaño.
2. Servidor autoriza sobre operación/disputa/devolución y devuelve credencial de carga efímera de alcance único.
3. Cliente carga directamente al almacenamiento privado.
4. Cliente completa indicando hash local opcional; servidor verifica objeto, tamaño y tipo detectado.
5. Archivo queda `PENDING` y luego `SCANNING`; no cuenta como evidencia válida ni se comparte.
6. Análisis produce `ACCEPTED`, `REJECTED` o `RESTRICTED` y hash del original.
7. Solo `ACCEPTED` puede adjuntarse a una declaración o presentación.
8. La lectura sensible atraviesa el gateway autenticado, que revalida actor/recurso y registra el acceso antes de transmitir.

### 13.2 Restricciones

- allowlist de extensiones/MIME, límites y cantidad provienen de configuración;
- detectar tipo por contenido; no confiar en nombre o header;
- nombres no forman rutas físicas; object keys son aleatorias y privadas;
- desactivar ejecución/transformación insegura; servir con headers de descarga seguros;
- una URL firmada de **upload** puede ser efímera y de objeto único; una URL firmada bearer de **lectura** no se considera ligada a un usuario ni permite atribuir cada uso;
- evidencia sensible se sirve mediante gateway/proxy autenticado; si este usa internamente una URL firmada, no la expone al cliente;
- antivirus/escáner fallido mantiene `RESTRICTED` o sin promoción; nunca “fail open”;
- original, hash, autor, instante y metadatos se conservan según retención aprobada;
- thumbnails/derivados referencian al original y no sustituyen evidencia.

```json
{
  "data": {
    "upload_id": "upl_example",
    "upload_url": "https://storage.example.invalid/opaque-signed-target",
    "required_headers": {"content-type": "image/jpeg"},
    "expires_at": "2026-08-07T15:13:22Z",
    "max_bytes": 10485760
  },
  "request_id": "req_example"
}
```

## 14. Endpoints de disputas

| Método y ruta | Acción | Actor | Contrato |
|---|---|---|---|
| `POST /v1/operations/{id}/disputes` | Abrir reclamo | Comprador | Idempotencia + versión; costo/desglose aceptado si aplica |
| `GET /v1/disputes/{id}` | Expediente visible | Partes/admin | Filtra notas/evidencia protegida |
| `POST /v1/disputes/{id}/submissions` | Alegación/evidencia | Parte | Ventana, autor y adjuntos seguros |
| `POST /v1/admin/disputes/{id}/information-requests` | Pedir información | Admin | Destinatario, plazo, motivo |
| `POST /v1/disputes/{id}/information-requests/{rid}/responses` | Responder | Destinatario | Una respuesta sellada; evidencia opcional |
| `POST /v1/admin/disputes/{id}/assign` | Asignar revisor | Admin | Revisor elegible; auditoría |
| `GET /v1/admin/disputes/{id}/internal-notes` | Leer notas internas | Admin con need-to-know | Cursor; acceso auditado; nunca visible a partes |
| `POST /v1/admin/disputes/{id}/internal-notes` | Agregar nota interna | Admin | Append-only; propósito, texto, `If-Match`, idempotencia y auditoría |
| `GET /v1/disputes/{id}/settlement-proposals` | Ver propuestas compartibles | Partes/admin | Versiones y aceptaciones de la versión vigente |
| `POST /v1/disputes/{id}/settlement-proposals` | Crear borrador versionado | Parte autorizada o admin facilitador | Términos y allocation completa; idempotencia + `If-Match` |
| `PATCH /v1/disputes/{id}/settlement-proposals/{pid}/draft` | Nueva versión del borrador | Proponente | Solo `DRAFT`; no sobrescribe; invalida aceptaciones previas |
| `POST /v1/disputes/{id}/settlement-proposals/{pid}/open` | Abrir a aceptación | Proponente | Versión completa, vigencia y `If-Match` |
| `POST /v1/disputes/{id}/settlement-proposals/{pid}/acceptances` | Aceptar versión exacta | Comprador o vendedor | Consentimiento separado, idempotencia, recent auth y `If-Match` |
| `POST /v1/disputes/{id}/settlement-proposals/{pid}/revoke` | Revocar antes de aceptación mutua | Proponente autorizado | Motivo, idempotencia y `If-Match`; append-only |
| `POST /v1/admin/disputes/{id}/resolution-proposals` | Preparar fallo | Revisor | Desglose completo; no ejecuta |
| `POST /v1/admin/resolutions/{id}/approve` | Segunda aprobación | Otro admin | Distinto, sin conflicto, versión coincide |
| `POST /v1/admin/resolutions/{id}/confirm` | Confirmar fallo | Admin autorizado | Idempotencia, recent auth, capacidad financiera |

Apertura:

```json
{
  "reason_code": "ITEM_NOT_AS_AGREED",
  "statement": "Descripción concreta del problema observado.",
  "evidence_ids": ["ev_example"],
  "accepted_dispute_fee": {
    "amount_minor": 0,
    "currency": "XXX",
    "frozen_policy_snapshot_id": "ps_example"
  }
}
```

El importe de ejemplo no fija costo. El servidor rechaza si la aceptación no coincide exactamente con el desglose vigente congelado o si `DP-006` no está resuelto para la ruta.

Propuesta de resolución:

```json
{
  "outcome": "RETURN_THEN_REFUND",
  "reason_code": "MATERIAL_DIFFERENCE_CONFIRMED",
  "explanation": "Explicación comprensible y compartible.",
  "allocation_state": "COMPLETE",
  "allocation": [
    {"component": "PRINCIPAL", "disposition": "RETURN_THEN_REFUND", "amount_minor": 125000, "currency": "XXX"},
    {"component": "BUYER_FEE", "disposition": "REFUND", "amount_minor": 0, "currency": "XXX"},
    {"component": "SELLER_FEE", "disposition": "WAIVE", "amount_minor": 0, "currency": "XXX"},
    {"component": "DISPUTE_FEE", "disposition": "NOT_CHARGED", "amount_minor": 0, "currency": "XXX"},
    {"component": "BUYER_FEE_TAX", "disposition": "REVERSE", "amount_minor": 0, "currency": "XXX"},
    {"component": "SELLER_FEE_TAX", "disposition": "NOT_APPLICABLE", "amount_minor": 0, "currency": "XXX"},
    {"component": "DISPUTE_FEE_TAX", "disposition": "NOT_APPLICABLE", "amount_minor": 0, "currency": "XXX"},
    {"component": "PROVIDER_COST", "disposition": "PLATFORM_EXPENSE", "amount_minor": 0, "currency": "XXX"},
    {"component": "RETURN_LOGISTICS", "disposition": "SELLER", "amount_minor": 0, "currency": "XXX"}
  ],
  "return_requirements": {
    "destination_reference": "validated_private_destination",
    "shipping_cost_responsibility": "APPROVED_VALUE_REQUIRED",
    "due_at": "2026-08-14T15:03:22Z",
    "refund_milestone": "APPROVED_VALUE_REQUIRED",
    "inactivity_rule_id": "approved_rule_required"
  }
}
```

Los componentes mínimos son principal, fees de comprador/vendedor/reclamo, impuestos de cada fee, costo del proveedor y logística de devolución. Todos deben aparecer una vez con disposición final compatible, incluso como `NOT_CHARGED` o `NOT_APPLICABLE`; `UNRESOLVED`, `POLICY_REQUIRED`, componentes omitidos y `APPROVED_VALUE_REQUIRED` son inválidos para confirmación. La suma se valida contra snapshot, ledger y saldo.

El ejemplo de `RETURN_LOGISTICS` solo ilustra la forma: responsable, importe/límite y tratamiento dependen de `DP-015`. El hito depende de `DP-016`.

### 14.1 Propuesta bilateral de acuerdo

La propuesta sigue el catálogo persistente `DRAFT → OPEN → PARTIALLY_ACCEPTED → SUBMITTED_FOR_REVIEW → INCORPORATED_IN_RESOLUTION`, con salidas `REVOKED` y `EXPIRED`. Cada aceptación vincula actor, rol y versión exacta. La segunda aceptación registra el hecho de aceptación mutua, congela la versión y transiciona atómicamente de `PARTIALLY_ACCEPTED` a `SUBMITTED_FOR_REVIEW`; no existe un estado persistente intermedio `MUTUALLY_ACCEPTED`. No crea orden financiera ni resuelve la disputa por sí sola: un administrador autorizado debe validar legalidad, capacidad, saldo y convertirla en una resolución `RESOLVED_SETTLEMENT`.

Una edición crea nueva versión y revoca la validez de aceptaciones anteriores. Revocación solo procede antes de aceptación mutua; expiración usa deadline del servidor. Todos los cambios generan timeline, auditoría y notificación compartible.

## 15. Endpoints de devoluciones y movimientos

| Método y ruta | Acción | Actor | Guardas |
|---|---|---|---|
| `GET /v1/returns/{id}` | Ver instrucciones/estado | Partes/admin | Vista minimizada por rol |
| `POST /v1/returns/{id}/dispatch` | Declarar devolución | Comprador | Evidencia, tracking, plazo, idempotencia |
| `POST /v1/returns/{id}/confirm-receipt` | Confirmar recepción | Vendedor | `If-Match`, plazo |
| `POST /v1/returns/{id}/incidents` | Reportar problema | Parte | Motivo/evidencia; retención |
| `POST /v1/admin/returns/{id}/resolve-incident` | Resolver incidencia | Admin | Dentro del fallo/política, motivo |
| `GET /v1/operations/{id}/financial-orders` | Ver movimientos propios | Participante/admin | Descripción funcional, no payload proveedor |

No existe endpoint público “liberar” o “reembolsar” arbitrario. Esos movimientos nacen de confirmación válida, vencimiento válido o resolución autorizada y atraviesan `financial_order`.

## 16. Endpoints de reputación

| Método y ruta | Acción | Actor | Guardas |
|---|---|---|---|
| `GET /v1/operations/{id}/rating-eligibility` | Consultar elegibilidad | Participante | Política `DP-017` aprobada |
| `POST /v1/operations/{id}/ratings` | Presentar | Participante | Idempotencia; único; comentario válido |
| `GET /v1/me/ratings` | Propias emitidas/recibidas | Sesión | Cursor y privacidad |
| `POST /v1/ratings/{id}/reports` | Denunciar contenido | Usuario autorizado | Motivo, idempotencia |
| `POST /v1/admin/ratings/{id}/moderation-actions` | Ocultar/restaurar/corregir excepcional | Moderador | `DP-018`, motivo, auditoría |

```json
{
  "score": 5,
  "comment": "Comentario significativo sobre la operación.",
  "evaluated_role": "SELLER",
  "policy_version_id": "pv_reputation_example"
}
```

Escala, ventana, caducidad y fórmula no se habilitan hasta resolver `DP-017`.

## 17. Endpoints administrativos de políticas y auditoría

| Método y ruta | Acción | Permiso |
|---|---|---|
| `GET /v1/admin/policies` | Buscar versiones | Configuración lectura |
| `POST /v1/admin/policies` | Crear borrador | Configuración escritura + idempotencia |
| `PATCH /v1/admin/policies/{id}` | Editar borrador | Propietario autorizado + `If-Match` |
| `POST /v1/admin/policies/{id}/validate` | Validar/simular | Configuración |
| `POST /v1/admin/policies/{id}/publish` | Programar/activar | Publicación, recent auth, doble control si aplica |
| `POST /v1/admin/policies/{id}/retire` | Retirar futuro | Publicación + motivo |
| `POST /v1/admin/policy-resolution:simulate` | Ver regla ganadora | Configuración/operaciones autorizada |
| `GET /v1/admin/audit-records` | Buscar auditoría | Auditoría lectura; filtros restringidos |
| `GET /v1/admin/operations` | Consola | Operaciones lectura |
| `POST /v1/admin/operations/{id}/holds` | Crear retención | Permiso por tipo + motivo |
| `POST /v1/admin/holds/{id}/release` | Levantar | Autoridad del tipo + motivo |

No existe `PATCH /operations/{id}/state`, `PATCH /ledger-entry` ni edición de evidencia/fallo. Las acciones manuales invocan las mismas transiciones e invariantes que el sistema.

## 18. Webhooks entrantes

### 18.1 Endpoint

- `POST /v1/webhooks/providers/{provider}` para proveedores de pago/logística habilitados.
- `POST /v1/webhooks/communications/{provider}` para estados de entrega de email, incluido Resend cuando la integración aprobada lo use.
- El proveedor concreto se configura; un nombre en ruta no habilita capacidades.

### 18.2 Procesamiento obligatorio

1. Leer body crudo con límite de tamaño.
2. Verificar autenticidad, firma, timestamp/replay y origen según documentación oficial vigente del proveedor.
3. Nunca registrar cabeceras secretas ni body completo en logs generales.
4. Extraer `external_event_id`; deduplicar por `(provider, environment, account_scope, external_event_id)`.
5. Persistir observación y outbox antes de responder.
6. Responder rápidamente con el status requerido por el proveedor; procesar negocio asíncronamente.
7. Consultar/reconciliar cuando el webhook no contenga información autoritativa suficiente. Una consulta autoritativa también puede confirmar el hecho cuando el webhook no llegue; el retorno del navegador nunca puede hacerlo.
8. Mapear a estado canónico conservando tipo/código original protegido.
9. Eventos desconocidos se conservan, alertan y no mueven dinero.

Esquema canónico interno de observación:

```json
{
  "provider_observation_id": "pobs_example",
  "provider": "MERCADO_PAGO",
  "environment": "SANDBOX_OR_PRODUCTION",
  "account_scope": "opaque-account-scope",
  "external_event_id": "opaque-external-id",
  "resource_reference": "opaque-resource-id",
  "observed_type": "PAYMENT_STATUS_CHANGED",
  "received_at": "2026-08-07T15:03:22Z",
  "authenticity": "VERIFIED",
  "payload_hash": "sha256:...",
  "canonical_schema_version": 1
}
```

Si no existe `external_event_id` estable, se persiste con clave fallback `(provider, environment, account_scope, resource_reference, observed_type, payload_hash)`. Esa observación por sí sola no produce efectos financieros: una consulta autoritativa y conciliada debe confirmar el recurso.

El formato real de firma, IDs, status y consultas se implementa solo contra documentación oficial y cuenta/país validados en `DP-003`.

### 18.3 Webhooks de Resend

Se traducen a estados de entrega `PREPARED`, `SUBMITTED`, `ACCEPTED`, `DELIVERED`, `BOUNCED`, `COMPLAINED`, `FAILED`. Un rebote genera recuperación/alerta. `DP-021` debe definir por país qué evidencia de notificación, fallback o escalamiento es condición para automatizaciones críticas. Si falta una política aplicable o no se satisface, la autoliberación se deniega y escala a revisión; ningún estado de email se considera suficiente por default.

## 19. Webhooks salientes

La entrega de webhooks de la plataforma es una superficie de integración opcional, deshabilitada por defecto hasta aprobación de alcance y seguridad. No sustituye notificaciones del MVP.

### 19.1 Sobre

```json
{
  "id": "evt_example",
  "type": "operation.state_changed.v1",
  "created_at": "2026-08-07T15:03:22Z",
  "data": {"operation_id": "op_example", "state": "IN_DISPUTE", "version": 14},
  "correlation_id": "corr_example"
}
```

### 19.2 Seguridad y entrega

- HTTPS y destinos allowlisted/verificados; bloquear SSRF y redes privadas.
- Firma HMAC/asimétrica versionada con secreto gestionado fuera de payload/logs; timestamp y event ID para replay protection.
- Entrega al menos una vez; consumidor deduplica por `id`.
- Reintentos con backoff y límite; estado visible y reenvío manual auditado.
- No incluir evidencia, correo, domicilio, tokens, notas internas ni datos de pago; usar IDs y estados minimizados.
- Orden no garantizado entre tipos; `aggregate_version` permite detectar huecos.
- Suscripción y rotación de claves requieren permisos administrativos específicos.

## 20. Eventos internos

Sobre obligatorio:

```json
{
  "event_id": "evt_example",
  "event_type": "payment.accredited.v1",
  "schema_version": 1,
  "aggregate_type": "payment",
  "aggregate_id": "pay_example",
  "aggregate_version": 7,
  "occurred_at": "2026-08-07T15:03:22Z",
  "actor": {"type": "SYSTEM", "id": null},
  "correlation_id": "corr_example",
  "causation_id": "pobs_example",
  "data": {
    "operation_id": "op_example",
    "expected_collected_total": {"amount_minor": 125000, "currency": "XXX"},
    "observed_collected_total": {"amount_minor": 125000, "currency": "XXX"},
    "breakdown_snapshot_id": "brk_example"
  }
}
```

Catálogo inicial alineado exactamente con `03` §7.4: `operation.created.v1`, `operation.request_sent.v1`, `operation.agreement_accepted.v1`, `operation.cancelled.v1`, `operation.expired.v1`, `payment.attempt_created.v1`, `payment.accredited.v1`, `payment.inconsistent.v1`, `shipment.declared.v1`, `shipment.tracking_versioned.v1`, `operation.receipt_confirmed.v1`, `operation.confirmation_grace_started.v1`, `dispute.opened.v1`, `dispute.evidence_submitted.v1`, `dispute.resolution_confirmed.v1`, `dispute.settlement_proposed.v1`, `dispute.settlement_accepted_by_party.v1`, `dispute.settlement_mutually_accepted.v1`, `dispute.settlement_revoked.v1`, `dispute.settlement_expired.v1`, `return.ordered.v1`, `return.dispatched.v1`, `return.received.v1`, `financial_order.created.v1`, `financial_order.confirmed.v1`, `financial_order.failed.v1`, `financial_review.late_payment_detected.v1`, `financial_review.exception_closed.v1`, `rating.submitted.v1`, `rating.published.v1`, `policy.published.v1`, `hold.added.v1`, `hold.released.v1`.

### 20.1 Reglas de consumo

- outbox atómica con actualización del agregado;
- entrega al menos una vez y consumidor idempotente por `event_id`;
- orden por agregado, no orden global;
- detectar salto de `aggregate_version` y reconstruir/esperar antes de aplicar;
- PII minimizada; consumidores consultan recurso autorizado si necesitan detalle;
- fallo va a cola de recuperación con alerta, nunca se descarta;
- evolución compatible o nuevo `event_type`/versión.

## 21. Validaciones e invariantes contractuales

| ID | Validación | Capa obligatoria |
|---|---|---|
| `VC-001` | Comprador y vendedor distintos | API + dominio + restricción DB |
| `VC-002` | País/moneda/categoría/monto habilitados | Dominio con política/matriz |
| `VC-003` | Acuerdo aceptado no se edita | Dominio + persistencia append-only |
| `VC-004` | Una moneda por operación/libro | API + dominio + DB |
| `VC-005` | Máximo un pago acreditado | Dominio + índice único lógico |
| `VC-006` | Retorno navegador no acredita | Adaptador + dominio |
| `VC-007` | Declarar envío requiere pago conciliado | Dominio transaccional |
| `VC-008` | Evidencia `ACCEPTED` y autorizada antes de adjuntar | API + almacenamiento + dominio |
| `VC-009` | Reclamo crea hold antes de liberar | Mismo control transaccional |
| `VC-010` | Resolución asigna todos los componentes y no sobregira | Dominio + libro |
| `VC-011` | Orden financiera única por causa | Dominio + unicidad DB + proveedor idempotente si soporta |
| `VC-012` | Resultado desconocido se consulta antes de retry | Orquestador financiero |
| `VC-013` | Devolución sigue hito escrito | Dominio |
| `VC-014` | Rating único, elegible y no propio | API + dominio + DB |
| `VC-015` | Política publicada inmutable/no retroactiva | Dominio + persistencia |
| `VC-016` | Toda acción sensible conserva actor, motivo y correlación | API + auditoría |
| `VC-017` | Asiento `POSTED` tiene ≥2 postings y balancea débitos/créditos por moneda | Dominio + transacción + DB |
| `VC-018` | Segunda aceptación de settlement congela versión y no mueve dinero | Dominio + DB + outbox |
| `VC-019` | Evidencia sensible se descarga por gateway autenticado y audita actor | API/gateway + auditoría |
| `VC-020` | GET de magic link no consume; POST atómico consume una vez | Web + identidad + DB |

## 22. Trazabilidad

| Contrato | Requisitos/reglas | Máquinas / decisiones |
|---|---|---|
| Cuenta/magic link/consentimiento | `RF-AUT-001..005`, `RF-PER-001..004` | Seguridad; `DP-012`, `DP-018` |
| Operación/acuerdo/policy snapshot | `RF-OPS-001..011`, `RN-001..006` | `SM-OPS`; `DP-005`, `DP-011` |
| Dinero/pagos/libro | `RF-PAG-001..012`, `RN-007..014` | `SM-PAG`, `SM-FIN`; `DP-002..007`, `DP-013` |
| Envío/tiempo/evidencia | `RF-ENV-001..007`, `RN-015..017` | `SM-ENV`; `DP-008..010` |
| Confirmación/automatización | `RF-CON-001..007`, `RN-018..022` | `SM-OPS`; `DP-009..010`, `DP-013` |
| Disputa/resolución | `RF-DIS-001..015`, `RN-023..030` | `SM-DIS`; `DP-006..007`, `DP-014` |
| Devolución | `RF-DEV-001..008` | `SM-DEV`; `DP-014..016` |
| Reputación | `RF-REP-001..011`, `RN-031..034` | `SM-REP`; `DP-017..018` |
| Políticas/admin/auditoría | `RF-ADM-001..010` | `SM-POL`; `DP-012..021`, `DTA-SEC-001` |
| Dashboards/paginación | `RF-DAS-001..006` | Proyecciones autorizadas |
| Webhooks/conciliación | `RF-PAG-002..003`, `RF-ADM-010` | `DP-003`, webhook o consulta autoritativa reconciliada |
| Notificaciones críticas | `RF-CON-003..004`, FSD §10.3/§21 | `DP-021` |

## 23. Criterios contractuales de aceptación

1. OpenAPI generado o escrito representa todos los endpoints públicos de este documento y falla CI ante cambios incompatibles no versionados.
2. Todo POST sensible documentado rechaza ausencia de `Idempotency-Key` y reproduce una respuesta previa para la misma clave/payload.
3. Reutilizar la clave con payload distinto responde `409` sin segundo efecto.
4. Todo PATCH/acción con `If-Match` rechaza versión desactualizada sin escritura parcial.
5. Un usuario nunca obtiene operación, evidencia o dirección ajena por enumeración de IDs.
6. Montos viajan como enteros con moneda; no existe `float/double` en contratos contables.
7. Webhook duplicado o fuera de orden genera como máximo una transición y un asiento.
8. Un webhook con firma inválida no modifica recursos y queda registrado de forma segura para métricas.
9. Un pago acreditado tardío sobre operación expirada no habilita despacho.
10. Un upload no analizado o en cuarentena no puede adjuntarse como evidencia válida.
11. La carrera reclamo/liberación no produce ambas autorizaciones.
12. Una orden financiera con timeout queda `RESULT_UNKNOWN` y se consulta antes de reintentar.
13. Una resolución incompleta, con marcadores pendientes o que excede saldo no puede confirmarse.
14. Un cambio de política no modifica un `frozen_policy_snapshot` histórico; una cotización previa no se confunde con snapshot.
15. Un estado de email no cambia el estado de la operación.
16. Eventos internos pueden repetirse sin duplicar efectos y permiten detectar huecos de versión.
17. Las proyecciones de dashboard y reputación se reconstruyen desde fuentes propietarias.
18. Datos borrados lógicamente dejan de exponerse públicamente sin eliminar registros bajo retención válida.
19. Ningún ejemplo, migración o valor predeterminado habilita una decisión `DP-*` aún abierta.
20. Ninguna capacidad de Mercado Pago se considera disponible sin matriz aprobada y prueba contractual contra documentación/entorno válidos.
21. Webhook autenticado o consulta autoritativa reconciliada pueden acreditar; el retorno del navegador nunca.
22. Un `journal_entry` no pasa a `POSTED` sin dos o más postings balanceados atómicamente.
23. La deduplicación de webhook incluye provider, environment, account scope e ID; el fallback no mueve dinero sin consulta.
24. La segunda aceptación de settlement registra aceptación mutua y pasa directamente a `SUBMITTED_FOR_REVIEW`, sin movimiento financiero.
25. Una resolución omite cero componentes aplicables y no admite `UNRESOLVED` ni marcadores.
26. GET del magic link no consume y la descarga sensible identifica/audita al actor en el gateway.
27. Un retry financiero sin motivo, versión, idempotencia, recent auth o en `RESULT_UNKNOWN` se rechaza.

## 24. Entregables derivados

- Especificación OpenAPI 3.1 de `/v1` con esquemas, ejemplos y seguridad.
- Catálogo AsyncAPI o equivalente para eventos internos y webhooks salientes si se habilitan.
- Migraciones físicas y restricciones de la base elegida en el documento 05.
- Pruebas de contrato proveedor/consumidor y fixtures sin PII.
- Matriz de autorización por endpoint y pruebas de acceso cruzado.
- Catálogo de retención y clasificación de datos aprobado por Legal/Seguridad.

---

### Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.1 | 2026-08-07 | Alineación de precedencia, enums, ledger doble entrada, pagos, webhooks, snapshots, evidencia, identidad administrativa, notas y settlement bilateral |
| 0.1.0 | 2026-08-07 | Primera versión del modelo lógico y contratos HTTP/eventos, derivada de PRD, FSD y modelo de dominio 0.1.0 |
