# 08 — Seguridad, privacidad, auditoría y aceptación del MVP

**Estado:** Borrador implementable sujeto a decisiones pendientes  
**Versión:** 0.1.1  
**Última actualización:** 2026-08-07  
**Responsable:** Seguridad de producto / Ingeniería / QA  
**Audiencia:** Ingeniería, Seguridad, QA, SRE/Plataforma, Producto, Operaciones, Riesgo, Legal, Privacidad y Auditoría  
**Fuentes:** `01_PRD.md`, `02_FSD.md` y `04_UX_UI_SPEC.md` v0.1.1; `03_DOMAIN_AND_STATE_MACHINES.md`, `05_TECHNICAL_ARCHITECTURE.md`, `06_DATA_AND_API_CONTRACTS.md` y `07_PAYMENTS_DISPUTES.md` v0.1.0  
**Carácter:** Fuente de verdad de controles y pruebas, subordinada al PRD, FSD y modelo de dominio

> Este documento define controles y evidencia de aceptación para el MVP. No determina la figura legal del servicio, países piloto, KYC/AML, residencia, plazos de retención, tratamiento de contracargos, capacidades de Mercado Pago, escala reputacional, notificación efectiva previa a autoliberación ni SLO/RTO/RPO. Esos puntos permanecen en `DP-001` a `DP-021` y decisiones técnicas pendientes. La ausencia de una decisión obligatoria bloquea la ruta afectada; no autoriza a Codex ni al equipo a elegir un valor implícito.

## 1. Propósito

Establecer un marco verificable para:

- proteger dinero, cuentas, acuerdos, evidencia y decisiones;
- impedir accesos horizontales y elevaciones de privilegio;
- autenticar magic links, sesiones, webhooks y tareas internas;
- mantener efectos financieros idempotentes, reconciliados y auditables;
- procesar archivos no confiables sin comprometer usuarios ni infraestructura;
- aplicar privacidad por diseño y ejecutar derechos compatibles con las obligaciones que se aprueben por país;
- detectar abuso, fraude e incidentes sin revelar controles sensibles;
- demostrar mediante pruebas que el MVP cumple requisitos funcionales, no funcionales y de seguridad;
- definir gates de salida del piloto sin inventar umbrales aún pendientes de `DP-020`.

## 2. Principios normativos

1. **Denegar por defecto.** Toda combinación, permiso, acceso a objeto o capacidad externa desconocida queda deshabilitada.
2. **Autorización por recurso.** Un rol global o un identificador no predecible nunca basta para acceder a una operación.
3. **Mínimo privilegio y separación de funciones.** Lectura, soporte, disputa, políticas, finanzas, aprobación y despliegue son capacidades independientes.
4. **Hechos financieros confirmados.** Retorno del navegador, respuesta provisional o email nunca acreditan, liberan ni reembolsan.
5. **Efectos a lo sumo una vez.** La infraestructura puede entregar al menos una vez; el dominio deduplica mediante idempotencia, constraints y conciliación.
6. **Inmutabilidad verificable.** Acuerdo, snapshot de política, evidencia original, resolución, ledger y auditoría no se sobrescriben.
7. **Privacidad por propósito.** Se recoge, muestra, exporta y conserva solo lo necesario para una finalidad aprobada.
8. **Falla cerrada para dinero.** Si no puede demostrarse un estado seguro, no se envía, libera, reembolsa ni cierra.
9. **Recuperación antes que conveniencia.** Un resultado desconocido se consulta; una tarea tardía reevalúa; una restauración reconcilia antes de reanudar efectos.
10. **Evidencia objetiva.** Un control no se considera implementado sin prueba, registro, configuración o informe reproducible.

## 3. Alcance y fronteras de confianza

### 3.1 En alcance

- aplicación web de participantes y consola administrativa;
- API pública, administrativa y endpoints de webhooks;
- workers, Cloud Tasks, Cloud Scheduler y Cloud Run Jobs;
- PostgreSQL/Cloud SQL, ledger, outbox, inbox y auditoría;
- Cloud Storage de cuarentena, evidencia validada, derivados y exportaciones;
- Secret Manager, IAM, Artifact Registry, CI/CD e infraestructura como código;
- Mercado Pago, Resend y sus webhooks mediante adaptadores;
- emails y magic links generados por el sistema;
- analítica minimizada y observabilidad operacional;
- estaciones y accesos humanos a administración/producción en lo que afecten al sistema.

### 3.2 Fuera de alcance directo, pero tratado como dependencia

- seguridad interna y contractual de Mercado Pago, Resend y transportistas;
- seguridad del proveedor de correo o dispositivo final del usuario;
- investigación forense física del producto;
- legislación concreta hasta aprobación por país;
- controles KYC/AML definitivos, pendientes de `DP-012`;
- recuperación de fondos ya irreversibles fuera de capacidades aprobadas.

### 3.3 Fronteras

| Frontera | Entrada no confiable | Control mínimo antes de confiar |
|---|---|---|
| Navegador → Web/API | campos, cookies, headers, archivos, URLs | sesión, CSRF, validación de esquema, autorización por recurso, límites |
| Email → Magic link | token reenviado, scanner de enlaces, usuario equivocado | token opaco, un uso, expiración, propósito, consumo atómico, retorno permitido |
| Mercado Pago → Webhook | headers/cuerpo/eventos repetidos o falsos | autenticidad según contrato, inbox, deduplicación, consulta y conciliación |
| Resend → Webhook | evento de entrega falso/repetido | autenticidad, deduplicación; nunca cambia hecho financiero |
| Cloud Tasks/Scheduler → Worker | petición reintentada o falsificada | OIDC, audience, cuenta autorizada, tarea esperada, idempotencia |
| API/Worker → PostgreSQL | comando concurrente o obsoleto | transacción, versión/bloqueo, constraints, guardas e invariantes |
| Cliente → Storage | objeto arbitrario/sobredimensionado | URL de carga limitada, cuarentena, verificación, scanner y promoción |
| Aplicación → proveedor externo | timeout/resultado ambiguo | intención durable, clave estable, registro, consulta antes de reintentar |
| Admin → producción | sesión robada/error/abuso interno | MFA en identidad corporativa, acceso temporal, RBAC, reautenticación y auditoría |
| CI/CD → runtime | dependencia/imagen/configuración alterada | revisión, escaneo, artefacto firmado, digest, WIF y aprobación |

## 4. Activos y clasificación

| ID | Activo | Sensibilidad/impacto | Propietario funcional | Controles esenciales |
|---|---|---|---|---|
| AST-01 | Fondos y órdenes financieras | Crítico | Finanzas/Pagos | invariantes, idempotencia, conciliación, doble control, alertas |
| AST-02 | Ledger y saldos atribuibles | Crítico | Finanzas | append-only, constraints, backup, reconciliación, acceso mínimo |
| AST-03 | Credenciales y secretos de proveedores | Crítico | Plataforma/Seguridad | Secret Manager, rotación, IAM, no logging |
| AST-04 | Sesiones y tokens magic link | Alto | Identidad | hash, expiración, un uso, cookies seguras, revocación |
| AST-05 | Acuerdo y snapshots de política | Alto | Producto/Legal | inmutabilidad, versión, hash/correlación, acceso por operación |
| AST-06 | Evidencia original y metadatos | Alto/sensible | Trust/Operaciones | cuarentena, acceso temporal, hash, auditoría y retención aprobada |
| AST-07 | PII de usuarios y domicilios | Alto/sensible | Privacidad | minimización, cifrado, propósito, RBAC y retención |
| AST-08 | Resoluciones y notas de disputa | Alto | Operaciones/Legal | separación de visibilidad, inmutabilidad, conflicto de interés |
| AST-09 | Políticas/comisiones/plazos | Alto | Admin. sistema | versionado, diff, vigencia, aprobación y no retroactividad |
| AST-10 | Auditoría | Alto | Auditoría/Seguridad | append-only, acceso separado, integridad, retención |
| AST-11 | Reputación/comentarios | Medio/sensible | Trust/Producto | elegibilidad, moderación auditada, privacidad por umbral |
| AST-12 | Código, IaC y artefactos | Alto | Ingeniería/Plataforma | branch protection, CI, firma, digest, SBOM y escaneo |
| AST-13 | Logs, métricas y trazas | Medio/alto | SRE/Seguridad | redacción, acceso mínimo, retención y alertas |
| AST-14 | Plantillas legales y de email | Alto | Legal/Producto | versión por país/idioma, aprobación y bloqueo sin fallback |

La clasificación final y retención deben alinearse con política aprobada por país (`DP-001`, `DP-018`, `DTA-008`).

## 5. Modelo de amenazas

### 5.1 Actores adversarios

- visitante no autenticado que enumera cuentas u operaciones;
- participante malicioso que intenta acceder o actuar sobre otra operación;
- vendedor/comprador que presenta evidencia falsa, malware o tracking reutilizado;
- atacante con acceso a un buzón, token o sesión;
- bot que abusa magic links, invitaciones, pagos, archivos o reputación;
- administrador curioso, comprometido o con conflicto de interés;
- atacante de supply chain o CI/CD;
- emisor de webhook falso o repetido;
- integración externa comprometida o que devuelve estados inconsistentes;
- operador que comete error no malicioso en una acción irreversible.

### 5.2 Escenarios y mitigaciones

| ID | Amenaza | Activo | Control preventivo | Detección/recuperación | Riesgo residual / DP |
|---|---|---|---|---|---|
| THR-001 | Enumeración de correo por login | AST-04/07 | respuesta neutral, timing homogéneo razonable, límites | métricas por IP/correo, alertas de patrón | proveedor de correo puede filtrar señales |
| THR-002 | Robo/reutilización o consumo por scanner de magic link | AST-04 | 128+ bits, hash, TTL, propósito, un uso; `GET` no consume y `POST` requiere interacción | evento de consumo/fallo, revocación sesiones | buzón comprometido; evaluar step-up según riesgo |
| THR-003 | Open redirect desde magic link | AST-04 | rutas relativas/allowlist interna | prueba automática y log de rechazo | bajo |
| THR-004 | CSRF sobre comandos | AST-01/05/08 | SameSite, token CSRF, Origin/Referer, método correcto | logs de rechazo, pruebas | flujos de terceros requieren ajuste documentado |
| THR-005 | XSS almacenado en acuerdo/comentario/evidencia | AST-05/06/11 | encoding contextual, sanitización si hay rich text, CSP | SAST/DAST, reporte CSP | evitar HTML de usuario reduce superficie |
| THR-006 | IDOR/BOLA entre operaciones | Todos | filtro de pertenencia/ABAC en cada consulta/comando | tests matriz usuario×objeto, alertas admin | crítico si falla |
| THR-007 | Elevación de soporte a finanzas | AST-01/08/09 | capacidades separadas, rutas/servicios y policy checks | auditoría, revisión periódica de acceso | aprobación organizacional |
| THR-008 | Webhook falso/replay | AST-01/02 | verificación contractual, timestamp si existe, inbox y ID único | tasa de inválidos/duplicados, consulta proveedor | depende `DP-003` |
| THR-009 | Retorno de navegador acredita pago | AST-01 | retorno solo informativo; confirmación reconciliada | prueba negativa obligatoria | ninguno aceptable |
| THR-010 | Duplicación de cobro/liberación/reembolso | AST-01/02 | claves, constraints, orden durable, ledger | reconciliación y alerta P1 | ninguno aceptable confirmado |
| THR-011 | Timeout seguido de reintento ciego | AST-01 | `RESULTADO_DESCONOCIDO`, consulta previa | cola de revisión y alertas | capacidad proveedor `DP-003` |
| THR-012 | Carrera reclamo vs. liberación | AST-01/08 | mismo bloqueo/transacción y retención atómica | prueba concurrente real | ninguno aceptable |
| THR-013 | Admin resuelve con conflicto | AST-08 | declaración + elegibilidad + separación | auditoría, revisión de asignaciones | proceso de RR.HH./operaciones |
| THR-014 | Resolución/saldo manipulado | AST-01/02/08 | desglose cerrado, saldo, doble aprobación por regla | reconciliación, diff, auditoría | umbral `DP-012/014` |
| THR-015 | Política maliciosa o errónea | AST-09 | borrador, simulación, diff, aprobación, vigencia | alertas de cambio y rollback futuro | precedencia/aprobación por definir |
| THR-016 | Malware/polyglot/bomba en archivo | AST-06 | cuarentena, MIME real, límites, scanner, render aislado | estado rejected/restricted, métricas | motor/límites `DTA-002` |
| THR-017 | URL aportada produce SSRF | Infra/secretos | no fetch por defecto; fetcher aislado, DNS/IP/redirect control | logs de egress y alertas | enlaces externos son referencia |
| THR-018 | URL bearer de evidencia compartida o reutilizada | AST-06 | descargas por gateway autenticado; URL firmada bearer reservada para upload o decisión de riesgo explícita | auditoría del gateway, revocación de acceso/sesión | una URL bearer no permite atribuir al usuario cada lectura |
| THR-019 | Exfiltración por logs/analítica | AST-03/07 | allowlist de campos, redacción, no cuerpos/tokens | scanner de secretos/PII en pipeline y muestreo | retención `DTA-008` |
| THR-020 | Borrado/alteración de auditoría | AST-10 | append-only, IAM separado, export protegido | verificación integridad y alertas | mecanismo exacto pendiente |
| THR-021 | Dependencia o imagen comprometida | AST-12 | lockfile, SCA, firma, digest, SBOM, WIF | escaneo continuo, rollback | política de severidades necesaria |
| THR-022 | Datos productivos en desarrollo | AST-06/07 | proyectos separados, prohibición, datos sintéticos | DLP/muestreo y revisión de exportaciones | ninguno salvo excepción aprobada |
| THR-023 | Abuso de reputación/spam | AST-11 | solo operación elegible, unicidad, límites, moderación objetiva | señales de velocidad/relación | `DP-017/018` |
| THR-024 | Restauración reejecuta efectos | AST-01/02 | pausa salidas, reconciliar antes de replay | runbook y ensayo DR | objetivos `DP-020` |
| THR-025 | Cuenta suspendida deja fondos sin gestionar | AST-01/07 | restricción separada de obligaciones activas; ruta operativa | cola de revisión | KYC/riesgo `DP-012/013` |

### 5.3 Riesgos que no se aceptan para el piloto

- movimiento financiero duplicado confirmado;
- acceso de participante a una operación o evidencia ajena;
- secreto productivo en repositorio, logs o cliente;
- envío habilitado por pago no acreditado/conciliado;
- liberación con reclamo o retención vigente;
- resolución incompatible con saldo o sin aprobación requerida;
- carga servida como evidencia antes de análisis/aceptación;
- edición o eliminación ordinaria de ledger, fallo, evidencia original o auditoría;
- producción habilitada con capacidad financiera o texto legal desconocidos.

## 6. Autenticación: magic link y sesión

### 6.1 Solicitud de enlace

- Validar y normalizar correo sin aplicar transformaciones específicas no aprobadas.
- Responder igual exista o no cuenta (`RF-AUT-004`, `CA-AUT-003`).
- Aplicar límites combinados por IP/prefijo, correo normalizado, sesión/dispositivo y reputación de red, sin crear un vector de bloqueo permanente.
- No incluir en analítica el correo completo ni el token.
- Registrar propósito, canal, locale, resultado de entrega y correlación.
- Reenvío no extiende automáticamente solicitudes de pago ni invalida reglas de negocio.

### 6.2 Token

- Aleatorio criptográficamente seguro con al menos 128 bits de entropía (`AR-REC-007`).
- Guardar solo hash resistente/representación no reversible; nunca token en claro.
- Ligado a propósito, cuenta/correo, ruta de retorno validada, emisión, expiración y estado.
- Un solo uso; consumo y creación de sesión en una transacción atómica (`VF-AUT-003`).
- Una solicitud `GET`, prefetch o scanner solo muestra/obtiene la página de continuación y NO consume el token. El consumo requiere interacción explícita y un `POST` válido.
- Al emitir uno nuevo, aplicar la política aprobada de invalidación; no asumir comportamiento fuera de `RF-AUT-002`.
- Evitar fuga en logs, referrer, analítica, errores, screenshots operativos o URLs de terceros.
- Antes del `POST`, la página no carga recursos externos que puedan recibir token, URL o referrer. Tras el consumo, elimina el token de URL e historial tan pronto como sea seguro.

### 6.3 Sesión

- Identificador opaco server-side; cookie `HttpOnly`, `Secure`, `SameSite=Lax` o más estricta compatible con flujo.
- Rotar identificador al autenticar, elevar privilegio y reautenticar.
- Revocación server-side por cierre, restricción, cambio sensible o incidente.
- TTL absoluto e inactividad configurables por riesgo; valores requieren aprobación de Seguridad/Producto.
- CSRF para todo comando autenticado por cookie, con validación de origen.
- No guardar credenciales o tokens de proveedor en navegador.
- Reautenticación reciente para fallo, publicación/cambio sensible de política, aprobación secundaria, ajuste y cambio de correo; la ventana es configurable.

### 6.4 Cambio de correo y recuperación

- Requiere reverificación y preserva historial (`RF-PER-002`).
- Notificar el cambio al canal anterior cuando la política lo permita y registrar auditoría.
- Una sesión con cuenta restringida solo expone estado y acciones permitidas, sin señales antifraude.
- La recuperación no permite cambiar identidad y autorizar dinero en un único paso sin control adicional aprobado.

### 6.5 Pruebas mínimas

- consumo simultáneo deja una sesión válida;
- token usado, vencido, alterado o de otro propósito falla sin filtrar datos;
- open redirect bloqueado (`CA-AUT-002`);
- cookie no accesible por JavaScript y no se envía por HTTP;
- sesión rota tras login y revoca en logout/restricción;
- CSRF falla en ausencia/token incorrecto/origen no permitido;
- límites frenan abuso sin revelar existencia de cuenta.
- GET/prefetch/scanner no consume; POST interactivo sí, una sola vez, sin leakage.

**Trazabilidad:** `RF-AUT-001..006`, `RF-PER-002..004`, `FL-01`, `VF-AUT-001..006`, `RNF-006`, `RNF-012`.

## 7. Autorización, RBAC y acceso por objeto

### 7.1 Modelo

- **RBAC administrativo:** capacidades globales explícitas.
- **ABAC transaccional:** actor + rol en la operación + estado + país/ámbito + acción + retenciones.
- **Object-level authorization:** toda carga/consulta recibe un recurso y valida relación/permiso en servidor.
- La UI puede ocultar botones, pero nunca constituye un control.

### 7.2 Capacidades administrativas mínimas separadas

| Capacidad | Soporte/auditor | Admin operaciones | Admin sistema | Aprobador financiero |
|---|---:|---:|---:|---:|
| Leer operación autorizada | Sí, minimizada | Sí | Según necesidad | Según necesidad |
| Ver evidencia sensible | Solo permiso específico | Sí, necesidad operativa | No por rol implícito | No por rol implícito |
| Solicitar evidencia | No | Sí | No | No |
| Proponer resolución | No | Sí | Solo permiso específico | No |
| Aprobar resolución sensible | No | Según regla | No por rol implícito | Sí, si distinto y elegible |
| Mover/ajustar dinero | No | Según permiso/umbral | No por rol implícito | Según permiso específico |
| Crear/publicar política | No | No | Sí | Aprobación adicional si aplica |
| Moderar comentario | Lectura | Según permiso | Según permiso | No |
| Ver auditoría | Limitada | Sí | Sí | Limitada al caso |
| Gestionar IAM/despliegue | No | No | No | No |

La matriz no amplía permisos del FSD: todo “según” requiere capacidad explícita, no herencia silenciosa.

### 7.3 Reglas por objeto

- Comprador y vendedor solo leen el acuerdo de su operación.
- Solo vendedor crea solicitud/declara envío; solo comprador acepta, paga, confirma y abre reclamo (`PE-001`).
- Cada parte solo presenta evidencia en ventanas y propósitos autorizados.
- Evidencia compartible y evidencia restringida usan autorizaciones distintas.
- Perfil público se resuelve desde una proyección minimizada, no desde la cuenta privada.
- IDs legibles nunca se usan directamente como clave de autorización.
- Listados aplican el filtro de pertenencia dentro de la consulta; no filtran después de traer datos.
- Una acción manual usa el mismo comando/invariantes que la automática; no hay endpoint “editar estado”.

### 7.4 Administración

- La identidad administrativa depende de `DTA-SEC-001`. Hasta aprobar e implementar esa decisión, la consola y todos los endpoints administrativos permanecen deshabilitados en producción.
- La decisión debe definir un IdP corporativo con MFA obligatorio, sesiones/cookies y origen separados de participantes, vinculación con la cuenta/rol interno, altas/cambios/bajas, acceso temporal, reautenticación, recuperación y break-glass.
- Una sesión de participante por magic link nunca se eleva directamente a sesión administrativa.
- Grupos administrados, acceso temporal/JIT y revisión periódica de miembros.
- Cuenta humana individual; prohibidas cuentas compartidas.
- Reautenticación para acciones sensibles; declaración de conflicto antes de fallar.
- Segundo aprobador distinto, sin conflicto y sobre propuesta inmutable cuando la regla lo exige.
- Acceso a evidencia sensible, exportaciones y búsquedas por correo quedan auditados.
- Break-glass documentado, restringido, alertado y revisado después de cada uso.

### 7.5 Pruebas de matriz

Para cada endpoint/comando/recurso probar: anónimo, participante ajeno, comprador propio, vendedor propio, soporte, admin operaciones, admin sistema, aprobador y cuenta restringida. Ejecutar tanto ID conocido como ID enumerado, consulta masiva, archivo y descarga por gateway. La respuesta no autorizada no revela existencia (`ERR-AUTH-001`).

**Trazabilidad:** FSD §4, `PE-001..006`, `RF-ADM-006..009`, `RF-DIS-006..012`, `ERR-AUTH-*`, `CUX-021..024`.

## 8. Pagos, webhooks, ledger e idempotencia

### 8.1 Invariantes de seguridad financiera

- Monto entero en unidad menor + ISO 4217; nunca float (`INV-FIN-007`).
- Una operación, moneda, comprador y vendedor; como máximo un pago acreditado.
- Acreditación exige operación, cuenta, referencia, monto y moneda coincidentes y conciliados.
- Ninguna orden supera saldo atribuible (`INV-FIN-004`).
- Retenciones son un conjunto; levantar una no ejecuta automáticamente.
- Orden confirmada no cambia de estado para “revertirse”; compensación es otra orden autorizada.
- Ledger, intención, observación y conciliación se preservan append-only.

### 8.2 Endpoint de webhook

1. Acepta método/tipo/tamaño esperados.
2. Conserva raw body solo cuando sea necesario y bajo retención/acceso aprobado.
3. Verifica autenticidad exactamente según documentación contractual de esa cuenta/país/entorno; no inventar algoritmo.
4. Valida timestamp/replay cuando el proveedor lo soporte.
5. Inserta en inbox con ID externo único o clave compuesta segura.
6. Responde rápido sin ejecutar el movimiento en la petición.
7. Worker normaliza, consulta al proveedor si corresponde, concilia y aplica transición monotónica.
8. Duplicado responde éxito técnico pero no repite efectos.

Una allowlist IP es defensa adicional solo si el proveedor mantiene rangos oficiales; nunca reemplaza autenticidad.

### 8.3 Idempotencia

- `Idempotency-Key` tiene ámbito actor + operación + comando.
- Guardar hash canónico, resultado y vigencia; mismo payload devuelve mismo resultado, payload distinto da `ERR-IDEM-001`.
- Constraints de dominio protegen aunque la clave falte o expire.
- Nombres estables para tareas y recordatorios reducen duplicados.
- El proveedor recibe clave estable cuando la capacidad verificada lo permite.
- Timeout después de posible aceptación pasa a `RESULTADO_DESCONOCIDO`; consultar antes de reintentar (`TR-FIN-005/006`).

### 8.4 Conciliación y alertas

- Conciliación programada y bajo demanda compara provider reference, monto, moneda, destino, estado y ledger.
- Diferencia bloquea cierre y crea retención/revisión.
- La acreditación puede provenir de webhook autenticado O consulta autoritativa; en ambos casos debe estar correlacionada y reconciliada. Webhook ausente se recupera por consulta; retorno del navegador no suple ninguno.
- Alertas P1: duplicado/exceso confirmado, ledger corrupto, saldo negativo no aprobado.
- Alertas P1/P2: resultado desconocido sobre umbral, conciliación atrasada, inbox/outbox estancado. Umbrales dependen de `DP-020`.

### 8.5 Pruebas adversarias

- firma/header ausente, inválido, replay y cuerpo mutado;
- evento duplicado, fuera de orden, tardío y desconocido;
- referencia válida con monto/moneda/cuenta incorrectos;
- webhook antes/después del retorno;
- pago acreditado tras expiración/cancelación;
- dos intentos supuestamente acreditados;
- timeout en cada punto antes/después de llamada externa;
- carrera reclamo/liberación con transacciones reales;
- doble confirmación desde dos dispositivos;
- restauración + replay sin llamada externa hasta conciliación.

**Trazabilidad:** `RF-PAG-001..012`, `RN-011..023`, `FL-03`, `FL-05`, `FL-10`, `INV-FIN-*`, `SM-PAG`, `SM-FIN`, `CA-PAG-*`, `CA-FIN-*`, `RNF-004/005/008/010/012`, `DP-002..007`, `DP-013`, `DP-016`.

## 9. Carga, análisis y acceso a evidencia

### 9.1 Ciclo seguro

1. API autentica y autoriza actor, operación, propósito, cantidad, tamaño y tipo permitido.
2. Emite URL de carga corta, de objeto exacto, sin capacidad de listar/leer.
3. Objeto llega a bucket de cuarentena privado.
4. Worker verifica existencia, propietario lógico, tamaño declarado/real, MIME por contenido, extensión y hash.
5. Scanner antimalware y validadores específicos procesan en entorno aislado sin salida innecesaria.
6. Generación de miniatura/transcodificación ocurre con sandbox y límites de recursos.
7. Archivo pasa a `accepted`, `rejected` o `restricted`; solo `accepted` participa como evidencia.
8. Original aceptado se protege contra sobrescritura; corrección crea versión/hash nuevo.
9. La lectura/descarga fuerte exige un gateway autenticado que revalida sesión, actor, recurso y visibilidad en cada request y registra al actor en auditoría.
10. Las URLs firmadas bearer se limitan a uploads de objeto exacto. Solo pueden usarse para lectura si una decisión de riesgo explícita documenta alcance, TTL, imposibilidad de ligar identidad y control compensatorio; por defecto están deshabilitadas.

### 9.2 Controles

- Allowlist de formatos basada en necesidad y política; límites de tamaño, cantidad, dimensiones, duración, páginas y compresión.
- Detectar archivos polyglot, extensión falsa, decompression bomb y contenido activo.
- No servir SVG/HTML/JS, macros o tipos ejecutables en origen; descargar con nombre seguro y `Content-Disposition` controlado.
- `X-Content-Type-Options: nosniff` y CSP/sandbox en previsualizadores.
- Metadatos técnicos no se presentan como prueba definitiva.
- Eliminar metadatos sensibles solo de derivados; preservar original conforme a retención.
- No incluir evidencia como adjunto de email.
- Nombre original es dato no confiable: no usar como ruta, HTML ni comando.
- Al rechazar, conservar o borrar según política aprobada, no por conveniencia técnica.

### 9.3 Privacidad y visibilidad

Cada elemento se clasifica: compartido, solo operaciones, nota interna o restringido. Un cambio de clasificación requiere permiso, motivo y auditoría; nunca altera el original. No se oculta a una parte la razón sustancial del fallo, sujeto a protección de datos/antifraude aprobada.

### 9.4 Pruebas

- carga sin autorización, URL vencida, reutilizada o para otra operación;
- cambio de objeto entre autorización y finalización;
- tamaño/MIME/extensión falsos, EICAR u otra muestra autorizada, zip bomb y archivo truncado;
- miniatura vulnerable/archivo activo;
- carga parcial y reintento sin perder válidos;
- participante ajeno/admin sin necesidad intenta leer;
- gateway rechaza sesión ausente/revocada, actor ajeno y objeto de otra operación, y audita cada descarga;
- URL de upload expira, no permite lectura/listado y no acepta otro objeto;
- corrección conserva original, hash, actor e instante.

La herramienta, límites y tratamiento de video se aprueban en `DTA-002`; retención en `DP-018/DTA-008`.

**Trazabilidad:** `RF-ENV-001..006`, `RF-DIS-005..008`, `RN-029`, `INV-ENV-002/003`, `RNF-006/007/012`, `CA-ENV-*`, `CA-DIS-002`, `CUX-007/008/023`.

## 10. Privacidad, retención y derechos

### 10.1 Principios

- Inventario de datos, finalidad, base/autoridad aprobada, origen, destinatarios, región, retención y propietario antes de producción.
- Minimización por campo, evento, log, email, perfil y exportación.
- Separación entre perfil público, cuenta privada, expediente de operación, evidencia y auditoría.
- Acceso por necesidad; no asumir que admin sistema puede ver PII/evidencia.
- Datos escritos por usuarios conservan idioma original y no se reutilizan para entrenamiento u otros fines sin decisión explícita.
- Analítica usa identificadores seudónimos y no registra texto libre, tokens, archivos, correo/domicilio ni URLs sensibles.

### 10.2 Retención y borrado

- Definir cronograma por categoría y país antes del piloto (`DTA-008`).
- Los lifecycle de DB, backups, buckets, logs, analítica y exportaciones deben coincidir con el cronograma.
- Un pedido de borrado no destruye automáticamente evidencia, ledger o auditoría bajo obligación de conservación; se restringe/seudonimiza cuando corresponda.
- Legal hold suspende borrado solo para el alcance y periodo autorizados, con auditoría.
- Derivados recreables pueden tener retención menor; originales preservan cadena de custodia aplicable.
- Backups deben tener expiración y proceso documentado para que datos borrados no reaparezcan operativamente al restaurar.

### 10.3 Derechos del titular

El procedimiento debe poder recibir, verificar, buscar, exportar, rectificar, restringir u oponerse/borrar según lo que exija cada jurisdicción aprobada. No se afirman derechos ni plazos legales concretos en este documento.

Controles mínimos:

- verificar identidad con proporcionalidad y sin recolectar más de lo necesario;
- registrar solicitud, alcance, decisiones, excepciones y cumplimiento;
- buscar en cuenta, operación, evidencia, comentarios, notificaciones, auditoría y proveedores relevantes;
- exportar en formato seguro, con autorización y expiración;
- evitar incluir datos de contraparte o notas antifraude no divulgables;
- propagar rectificación/supresión cuando corresponda y mantener trazabilidad;
- revisión humana de conflictos entre derechos y conservación financiera/legal.

### 10.4 Perfil público y reputación

- Nunca correo, documento, domicilio, pago, evidencia, monto individual o motivo privado.
- Métricas de disputas solo con umbral/contexto aprobado (`DP-017/018`).
- Moderación oculta público pero conserva original/decisión conforme retención.
- Denuncia y corrección excepcional no permiten edición silenciosa.

### 10.5 Transferencias y residencia

Región GCP, proveedores, subprocesadores y transferencias internacionales se deciden país por país (`DP-001`, `DTA-001`). La infraestructura no habilita una región por defecto. El cifrado no reemplaza aprobación de residencia/transferencia.

**Trazabilidad:** `RF-PER-003/004`, `RF-REP-006..010`, `RN-029`, PRD §11.5/14, `RNF-006..008`, `CUX-021`, `DP-001`, `DP-012`, `DP-017/018`.

## 11. Cifrado, secretos e IAM de plataforma

### 11.1 Tránsito y reposo

- TLS moderno en tráfico público y hacia proveedores; validar certificados.
- Cloud SQL por IP privada/conectividad aprobada; Storage privado.
- Cifrado administrado en reposo como mínimo. CMEK y cifrado de campos se evalúan en `DTA-006` según amenaza/requisito.
- Passwords no existen para usuario final; credenciales administrativas dependen del IdP corporativo.
- Hashes de tokens no sustituyen protección de DB, pero reducen impacto de lectura.

### 11.2 Secret Manager

- Secretos fuera de código, imagen, Terraform state no protegido, variables de build y logs.
- Cuenta de servicio solo accede a secretos que usa.
- Versiones, rotación, revocación y periodo de superposición documentados.
- Rotación probada sin downtime y con rollback seguro.
- Detección de secretos en pre-commit/CI e historial; exposición produce revocación, no solo eliminación del archivo.

### 11.3 IAM de servicios

| Identidad | Permisos máximos previstos | Prohibiciones |
|---|---|---|
| `web-runtime` | invocar API | DB, buckets, secretos financieros |
| `api-runtime` | DB y metadatos/firmas necesarias | llamar movimientos fuera del puerto autorizado |
| `worker-payments` | cola pagos, DB financiera, secreto proveedor | evidencia y Resend |
| `worker-notifications` | cola notificaciones, Resend, lectura mínima plantillas | pagos y evidencia original |
| `worker-evidence` | cuarentena/validado y metadatos | secretos de pagos, políticas financieras |
| `task-enqueuer` | crear tareas concretas | ejecutar movimientos |
| `scheduler-invoker` | invocar endpoints internos específicos | acceso a DB/secretos |
| `migration-job` | DDL/DML temporal aprobado | ejecución permanente |
| `deploy` | desplegar artefactos aprobados | credenciales runtime/datos |

- Sin roles básicos amplios ni claves descargables de service accounts.
- Cloud Tasks/Scheduler usan OIDC con audience exacta.
- Acceso humano a producción por grupos, MFA, temporal y auditable.
- Revisiones periódicas y al cambio de rol; baja inmediata al offboarding.

## 12. Logging seguro y auditoría inmutable

### 12.1 Logging operacional

Campos permitidos por allowlist: tiempo, entorno, servicio, versión, severidad, evento, resultado, latencia, `trace_id`, `request_id`, IDs internos no sensibles, task/outbox/inbox y referencia externa redactada.

No registrar:

- token/cookie/Authorization/CSRF;
- secreto, firma, URL firmada o payload completo de proveedor;
- correo/domicilio/documento completo;
- alegación, comentario, nombre/contenido de evidencia;
- cuerpo HTTP por defecto;
- datos de pago que no sean referencias minimizadas.

Redacción ocurre antes de emitir. Un filtro posterior no se considera suficiente. Los errores de terceros se normalizan y conservan detalle sensible solo en un almacén restringido si existe necesidad aprobada.

### 12.2 Auditoría de dominio

Eventos mínimos:

- autenticación administrativa, fallos y cambios sensibles;
- acceso/búsqueda/exportación de evidencia o PII;
- creación, aceptación y versión del acuerdo;
- cambios/publicación/retiro de políticas con diff;
- retenciones, movimientos, conciliación y correcciones;
- asignación, conflicto, evidencia, propuesta, aprobación y fallo de disputa;
- acción manual, motivo, antes/después y aprobación;
- moderación/corrección de reputación;
- uso de break-glass y cambios IAM relevantes.

Cada evento contiene actor humano/sistema, rol efectivo, acción, recurso, resultado, instante UTC, motivo, correlación, antes/después cuando aplique y aprobaciones. No contiene secretos ni evidencia completa.

### 12.3 Inmutabilidad e integridad

- Tabla/registro append-only; aplicación no posee permiso de `UPDATE/DELETE` ordinario.
- Corrección agrega evento compensatorio.
- Export periódico a almacenamiento con retención protegida y acceso separado, si se aprueba.
- Monitorear huecos, versiones no monotónicas, caída de ingestión y cambios de política de retención.
- Los logs de Cloud no reemplazan auditoría; analítica no reemplaza ledger.
- Restauración valida secuencia, balances y correlación.

### 12.4 Acceso

- Auditoría completa solo para funciones autorizadas.
- Buscar/exportar queda auditado.
- No permitir al actor investigado alterar el registro ni administrar su acceso.
- Retención y acceso se definen con Legal/Privacidad (`DTA-008`).

**Trazabilidad:** `RF-ADM-008/009`, `RF-PAG-011`, `RN-029/030`, `INV-OPS-007`, `INV-FIN-007`, `RNF-005/006/008`, FSD §19.3, `CUX-023/025`.

## 13. Abuso, fraude y límites

### 13.1 Superficies

- solicitud/reenvío de magic links e invitaciones;
- creación masiva de solicitudes, intentos de pago y reintentos;
- enumeración de operaciones/perfiles;
- uploads costosos o maliciosos;
- reclamos/evidencia repetitivos;
- reputación, denuncia y moderación;
- webhooks falsos y endpoints internos;
- búsquedas/exportaciones administrativas.

### 13.2 Controles

- Rate limiting por múltiples dimensiones y endpoint, con cuotas separadas por costo.
- Límites de tamaño y tiempo en proxy y aplicación.
- CAPTCHA o desafío solo como escalada basada en abuso y accesible; no control primario universal.
- Límites configurables por cuenta/país/importe/categoría según política aprobada.
- Señales de cuentas relacionadas, tracking reutilizado, velocidad, dispositivo y conducta solo si son legales y minimizadas.
- Restricción/retención explícita con causa; la interfaz no revela reglas antifraude.
- Revisión humana para consecuencias sensibles; IA no falla disputas en MVP.
- Kill switch por país/proveedor/capacidad para nuevas operaciones, preservando activas.

### 13.3 Seguridad de límites

- Un atacante no puede usar límites para bloquear indefinidamente un correo ajeno.
- Respuestas `429` incluyen recuperación razonable sin revelar umbrales sensibles.
- Eventos de rate limit no almacenan PII excesiva.
- Whitelists administrativas son excepcionales, temporales y auditadas.
- Los umbrales productivos se fijan tras prueba y riesgo; no se inventan aquí.

### 13.4 Fraude financiero

KYC/AML, categorías, reservas, contracargos y saldo negativo dependen de `DP-011..013`. La arquitectura debe admitir estados/retenciones, pero no ejecutar una política inexistente. Antes del piloto, Riesgo/Legal debe aprobar señales, decisiones, revisión y comunicación.

## 14. Seguridad de aplicación y perímetro

### 14.1 Controles web/API

- Validación por schema con rechazo de campos desconocidos en comandos sensibles.
- Encoding contextual y contenido de usuario como texto por defecto.
- CSP estricta con nonces/hashes, sin `unsafe-eval`; excepciones documentadas por Mercado Pago.
- HSTS, `nosniff`, `frame-ancestors`, Referrer-Policy y Permissions-Policy apropiadas.
- Protección CSRF; CORS por allowlist exacta, nunca wildcard con credenciales.
- Queries parametrizadas; no concatenar SQL.
- Errores sin stack, secretos ni existencia de recursos ajenos.
- Límite de body, headers, profundidad JSON y tiempo.
- Redirecciones internas/allowlist.
- API `/v1` documentada mediante OpenAPI 3.1; un cambio incompatible sin versión mayor bloquea CI.
- `Idempotency-Key` obligatorio en los POST sensibles definidos por el contrato 06; su vigencia no termina mientras una orden financiera pueda reintentarse.
- `ETag`/`If-Match` obligatorio en escrituras versionadas: ausencia responde `428`; versión obsoleta `412`, sin escritura parcial.
- Errores `application/problem+json` con código estable y `request_id`, sin stack, payload externo ni existencia de objeto ajeno.
- Campos desconocidos se rechazan en comandos financieros/sensibles.

### 14.2 SSRF y enlaces externos

- Enlace de publicación/tracking es referencia no confiable.
- Backend no lo recupera por defecto.
- Si se aprueba fetch, servicio aislado sin credenciales, con allowlist de protocolos, resolución DNS controlada, bloqueo de IP privadas/metadata, redirects limitados, tamaño/tiempo y egress explícito.
- No renderizar HTML remoto dentro del origen de la app.

### 14.3 Cloud Armor y exposición

- Exponer solo web, API pública mínima y webhooks dedicados.
- Workers/jobs son privados y requieren identidad.
- Admin puede usar rutas separadas y controles adicionales; no confiar solo en ocultamiento.
- WAF/rate limits se prueban para no romper webhooks legítimos ni accesibilidad.
- IP allowlist de administración es defensa adicional si el modelo operativo la permite.

## 15. Entornos, datos y supply chain

### 15.1 Separación

- Proyectos GCP, dominios, cuentas de proveedor, secretos, buckets, DB y service accounts separados por entorno.
- Production no usa sandbox; staging no posee secretos productivos.
- Datos productivos prohibidos en entornos inferiores salvo proceso excepcional con anonimización irreversible, autorización y auditoría.
- Local usa datos sintéticos y dobles.
- Egress y callbacks de cada entorno se validan contra su allowlist.

### 15.2 Repositorio y cambios

- Branch protection, revisión por otra persona y checks obligatorios.
- CODEOWNERS o equivalente para pagos, auth, IAM, ledger, migraciones y políticas.
- Commits/releases atribuibles; prohibir push directo a ramas protegidas.
- Cambios de emergencia se revisan retrospectivamente y quedan auditados.

### 15.3 Pipeline

1. format/lint/typecheck;
2. tests unitarios, integración y contratos;
3. SAST y detección de secretos;
4. SCA de dependencias/licencias;
5. escaneo IaC y contenedor;
6. SBOM;
7. build una vez, firma/provenance y Artifact Registry;
8. despliegue por digest con Workload Identity Federation;
9. DAST/E2E en staging;
10. aprobación y promoción gradual.

- Dependencias fijadas con lockfile; actualización controlada.
- Imágenes base mínimas, soportadas y parcheadas.
- No ejecutar scripts de instalación no revisados en contexto privilegiado.
- Vulnerabilidad crítica explotable en alcance bloquea release; criterios para otras severidades se documentan con riesgo y fecha de remediación.
- No permitir excepciones indefinidas.

### 15.4 Migración y rollback

- Migraciones expand/contract, revisión especial para ledger/estado/PII.
- Backup y comprobación de invariantes antes de migración sensible.
- Job de migración con identidad temporal; runtime no necesita DDL.
- Rollback de código no revierte dinero ni políticas históricas.
- Una migración fallida bloquea promoción; no se edita producción sin comando/evento auditable.

**Trazabilidad:** `RNF-009/011/012`, `AR-REC-006/010`, arquitectura §13–16, `DP-019/020`.

## 16. Detección, respuesta a incidentes y continuidad

### 16.1 Preparación

Antes de producción deben existir:

- responsables primario/secundario y canal on-call;
- clasificación P1–P4 aprobada y contactos Legal/Privacidad/Pagos;
- runbooks para duplicado financiero, secreto expuesto, takeover, webhook caído, evidencia maliciosa, fuga de datos, ledger inconsistente y proveedor indisponible;
- kill switches probados por país/proveedor/nuevos pagos/liberaciones automáticas;
- acceso break-glass;
- inventario de proveedores y contactos de escalamiento;
- ejercicios tabletop y restauración.

### 16.2 Ciclo

1. **Detectar y clasificar:** preservar correlación; no alterar evidencia.
2. **Contener:** pausar automatización afectada o nuevas operaciones sin cambiar estados históricos.
3. **Erradicar:** revocar secreto/sesión, parchear, bloquear indicador o corregir configuración.
4. **Recuperar:** reconciliar dinero/ledger/proveedor antes de reanudar; monitoreo reforzado.
5. **Comunicar:** según obligaciones/contratos aprobados; este documento no fija plazos legales.
6. **Aprender:** postmortem sin culpa, acciones con responsable/fecha y actualización de pruebas.

### 16.3 Evidencia forense

- Preservar logs, auditoría, raw provider event permitido, hashes, versiones y timeline con acceso restringido.
- Sin recolección indiscriminada ni alteración del original.
- Registrar quién exporta/accede y cadena de custodia cuando corresponda.
- Sin comandos ad hoc destructivos; toda corrección por evento/orden compensatoria.

### 16.4 Recuperación

- Cloud SQL HA, backups/PITR y buckets protegidos según arquitectura.
- Ensayo restaura DB, valida constraints/ledger, recupera objetos, simula replay y concilia.
- Durante restore, bloquear efectos externos.
- RTO/RPO numéricos permanecen en `DP-020`; deben medirse y aprobarse antes del go-live.

## 17. Estrategia de pruebas

### 17.1 Capas

| Capa | Objetivo | Entorno |
|---|---|---|
| Unitarias | objetos de valor, políticas, validadores, redacción | CI |
| Propiedad/modelo | dinero, estados, invariantes, secuencias aleatorias | CI |
| Integración | PostgreSQL, constraints, locks, outbox/inbox, Storage | CI aislado |
| Contrato | Mercado Pago, Resend, OIDC, schemas | CI + sandbox |
| E2E | FL-01..14 por rol/locale | staging |
| Concurrencia | carreras financieras/admin reales | PostgreSQL real |
| Seguridad | SAST/SCA/DAST, authz, CSRF/XSS/SSRF/uploads | CI + staging |
| Resiliencia | timeouts, duplicados, fallas parciales, DLQ | staging |
| Rendimiento | páginas, API, webhooks, colas, DB | staging equivalente |
| Accesibilidad | WCAG 2.2 AA manual/automática | CI + dispositivos |
| DR | restore/replay/reconciliación | entorno aislado |

### 17.2 Datos de prueba

- Sintéticos; sin PII productiva.
- Monedas con 0, 2 y reglas particulares de unidad menor.
- Zonas y locale diferentes, DST donde aplique.
- Archivos benignos, corruptos y malware de prueba autorizado.
- Fixtures externas versionadas, incluyendo eventos duplicados/fuera de orden.
- Usuarios distintos y relacionados simulados sin datos reales.

### 17.3 Reglas de automatización

- Cada test cita `TST-*` y al menos un `RF/RN/RNF/FL/INV/TR/CA/CUX`.
- Fallos intermitentes se investigan; no se silencian con reintentos ilimitados.
- Un test financiero verifica tanto estado como ledger, outbox y ausencia de duplicado.
- Pruebas negativas por transición no listada y cada permiso.
- Tests de seguridad no ejecutan acciones destructivas contra producción.

## 18. Matriz de pruebas de aceptación

### 18.1 Identidad, sesión y autorización

| ID | Caso | Resultado esperado | Trazabilidad |
|---|---|---|---|
| TST-AUT-001 | consumir mismo magic link en paralelo | una sesión; segundo falla seguro | RF-AUT-002, VF-AUT-003, CA-AUT-001 |
| TST-AUT-002 | email existente/no existente | respuesta indistinguible | RF-AUT-004, CA-AUT-003 |
| TST-AUT-003 | retorno externo/manipulado | dashboard/ruta segura; sin redirect | RF-AUT-003, CA-AUT-002 |
| TST-AUT-004 | token en logs/analítica/referrer | ausencia demostrada | VF-AUT-002, RNF-005/006 |
| TST-AUT-004A | GET/prefetch/scanner abre magic link | no consume; POST interactivo crea una sesión | RF-AUT-006, CA-AUT-004/005 |
| TST-AUT-005 | CSRF y sesión fijada | comando rechazado; sesión rota | RNF-012, AR-REC-007 |
| TST-AUT-006 | participante A lee/modifica objeto de B | 404/403 no enumerativo; auditoría si sensible | PE-001/006, ERR-AUTH-001 |
| TST-AUT-007 | soporte intenta mover dinero/fallar | denegado servidor | PE-002, RF-ADM-007 |
| TST-AUT-008 | admin con conflicto resuelve | denegado/reasignación | PE-003, RN-030, CA-DIS-004 |
| TST-AUT-009 | segundo aprobador igual al primero | denegado | RF-DIS-012, TR-DIS-011 |
| TST-AUT-010 | consola admin con `DTA-SEC-001` no resuelta o sesión participante | deshabilitada/denegada | DTA-SEC-001, EXIT-005A |

### 18.2 Operación, política y estados

| ID | Caso | Resultado esperado | Trazabilidad |
|---|---|---|---|
| TST-OPS-001 | país/moneda/categoría incompleta | no enviar por UI/API | RF-OPS-003, CA-OPS-001, INV-OPS-003 |
| TST-OPS-002 | doble creación con misma clave | una solicitud | RF-OPS-010, CA-OPS-004 |
| TST-OPS-003 | cambiar acuerdo aceptado | denegado; nueva operación | RF-OPS-005, INV-OPS-004 |
| TST-OPS-004 | política cambia tras snapshot | operación histórica sin cambio | RF-ADM-005, CA-OPS-003 |
| TST-OPS-005 | ruta depende de DP sin política | `ERR-POL-009`; sin valor propuesto | modelo CA-13, DP-* |
| TST-OPS-006 | transición no listada/estado terminal | denegada y sin side effects | modelo CA-14, SM-* |
| TST-OPS-007 | acción con versión obsoleta | conflicto y recarga | ERR-CONC-001, CUX-005 |
| TST-API-001 | POST sensible sin `Idempotency-Key` | rechazo contractual; ningún efecto | contrato 06 §7.4/§23.2 |
| TST-API-002 | escritura sin `If-Match` o con ETag viejo | `428`/`412`; sin escritura parcial | contrato 06 §7.5/§23.4 |
| TST-API-003 | cambio incompatible de OpenAPI | CI bloquea o exige versión mayor | contrato 06 §6.1/§23.1 |
| TST-API-004 | body con campo desconocido en comando financiero | validación rechaza | contrato 06 §2/§7 |

### 18.3 Pagos y concurrencia

| ID | Caso | Resultado esperado | Trazabilidad |
|---|---|---|---|
| TST-FIN-001 | retorno navegador “success” sin confirmación | pendiente; no envío | RN-014, CA-PAG-001/004 |
| TST-FIN-002 | webhook duplicado | un evento, acreditación y asiento | RF-PAG-003, CA-PAG-002 |
| TST-FIN-003 | eventos fuera de orden | no degradan estado confirmado | TR-PAG-006, modelo CA-5 |
| TST-FIN-004 | monto/moneda/cuenta difieren | inconsistente, retención, alerta | CA-PAG-003, INV-FIN-003 |
| TST-FIN-005 | pago tardío en expirada | revisión; no habilita envío | RN-005, INV-OPS-006 |
| TST-FIN-006 | confirmación doble concurrente | una confirmación/orden | CA-CON-001, carrera FSD 25.10 |
| TST-FIN-007 | reclamo vs liberación concurrentes | máximo una autorización; reclamo válido bloquea | RF-CON-006, CA-DIS-001 |
| TST-FIN-008 | timeout tras aceptar orden | consultar antes de reintentar | INV-FIN-005, CA-FIN-001 |
| TST-FIN-009 | orden excede saldo | denegada; alerta | RF-PAG-012, INV-FIN-004 |
| TST-FIN-010 | falla proveedor | estado no terminal y alerta | RF-PAG-010, CA-FIN-003 |
| TST-FIN-011 | ledger completo | desglose/asientos reconcilian exacto | RF-PAG-011, CA-FIN-002 |
| TST-FIN-012 | contracargo/retención antes de liberar | no se crea orden | RN-020, INV-FIN-009, DP-013 |
| TST-FIN-013 | journal por evento repetido | un journal, balanceado por moneda | PF-INV-002/012, CA-PD-001/002 |
| TST-FIN-014 | operación terminal con saldo residual/suspense | cierre bloqueado y alerta | RC-005, CA-PD-007 |
| TST-FIN-015 | conciliación transaccional/settlement/banco | líneas matched o excepción con owner/SLA | RC-001..010, CA-PD-017..020 |
| TST-FIN-016 | capacidad de proveedor `UNVERIFIED` | orden no pasa a envío | PF-INV-015, CA-PD-015 |

### 18.4 Envío, evidencia, disputa y devolución

| ID | Caso | Resultado esperado | Trazabilidad |
|---|---|---|---|
| TST-EVD-001 | declarar envío sin pago/evidencia | denegado | INV-ENV-001/002, CA-ENV-001 |
| TST-EVD-002 | archivo malware/tipo falso/sobredimensionado | rechazado aislado; otros conservados | RNF-007, ERR-EVID-001 |
| TST-EVD-003 | acceder evidencia ajena | denegado/no enumerativo | PE-006, CUX-022 |
| TST-EVD-004 | corregir tracking/evidencia | versión anterior preservada | RF-ENV-006, CA-ENV-002 |
| TST-DIS-001 | reclamo elegible | retención atómica y una disputa | INV-DIS-001/002 |
| TST-DIS-002 | evidencia bilateral/privada | visibilidad correcta por clase | RF-DIS-005/006, CA-DIS-002 |
| TST-DIS-003 | resolución sin asignar componente | no confirma | RN-028, CA-DIS-003 |
| TST-DIS-004 | resolución supera umbral/saldo | segunda aprobación o denegación | RF-DIS-012, INV-DIS-004/005 |
| TST-DIS-005 | vendedor propone aceptar pretensión | crea propuesta versionada; no mueve dinero/levanta hold | FSD §12.5, UX-64 |
| TST-DIS-006 | doble aceptación de propuesta | queda pendiente de resolución/validación; sin orden directa | RF-DIS-010/011, FSD §13.4.D |
| TST-DEV-001 | devolución sin resolución | imposible | RF-DEV-001, INV-DEV-001 |
| TST-DEV-002 | reembolso antes del hito | imposible | RF-DEV-004, CA-DEV-001 |
| TST-DEV-003 | silencio/incumplimiento | solo consecuencia escrita | RF-DEV-006/007, CA-DEV-002 |

### 18.5 Reputación, privacidad y UX

| ID | Caso | Resultado esperado | Trazabilidad |
|---|---|---|---|
| TST-REP-001 | calificación no elegible/propia/duplicada | denegada | RF-REP-001/011, CA-REP-001 |
| TST-REP-002 | crítica negativa válida | aceptada | RN-033, CA-REP-002 |
| TST-REP-003 | ventana ciega | no revela antes del hito | RF-REP-007, CA-REP-003, DP-017 |
| TST-PRI-001 | perfil público | sin PII/evidencia/montos | RF-PER-003, CUX-021 |
| TST-PRI-002 | export de datos | identidad, minimización, auditoría y contraparte excluida | RNF-006/008 |
| TST-PRI-003 | descarga de evidencia | gateway reautoriza y audita actor; URL bearer de lectura no existe por defecto | RNF-006/007/008, THR-018 |
| TST-I18N-001 | FL principal ES/pt-BR | sin fallback legal ni claves | CA-I18N-001/003, CUX-011 |
| TST-A11Y-001 | teclado/lector/reflow | WCAG 2.2 AA verificable | RNF-001, CUX-016..020 |
| TST-UX-001 | estado financiero pendiente | texto/semántica no terminal | RF-PAG-004, CUX-003 |
| TST-UX-002 | calificación omitida | liberación/reembolso/cierre no se bloquean; rating solo post-cierre | RF-REP-012, CUX-010B |
| TST-UX-003 | política `DP-021` ausente o notificación insuficiente | autoliberación bloqueada y revisión | CA-CON-004, CUX-005A |

### 18.6 Plataforma, resiliencia y supply chain

| ID | Caso | Resultado esperado | Trazabilidad |
|---|---|---|---|
| TST-PLT-001 | IAM por servicio | permisos mínimos; pruebas negativas | RNF-012, AR-REC-010 |
| TST-PLT-002 | secreto en repo/build/log | pipeline bloquea; runbook de revocación | RNF-005/012 |
| TST-PLT-003 | tarea duplicada/tardía | un efecto y reevaluación | RF-CON-007, FSD §20 |
| TST-PLT-004 | outbox falla tras crear tarea | replay sin efecto duplicado | RNF-004, arquitectura §7.5 |
| TST-PLT-005 | Resend caído/rebote | hecho persiste; alerta; estado in-app | FSD §21, RNF-010 |
| TST-PLT-006 | migración y rollback | compatibilidad y invariantes | RNF-009, arquitectura §14 |
| TST-PLT-007 | restore/replay | ledger válido; sin efectos antes de conciliar | RNF-011, INV técnica 15 |
| TST-PLT-008 | proveedor lento/indisponible | falla cerrada para dinero | RNF-004, arquitectura §15 |
| TST-PLT-009 | SAST/SCA/IaC/container/SBOM | gates aprobados sin crítico explotable | RNF-012 |
| TST-PLT-010 | carga y conexiones | cumple objetivo aprobado sin romper DB/proveedor | RNF-003, DP-020 |

## 19. Requisitos de evidencia para auditoría de salida

| Área | Evidencia requerida |
|---|---|
| Threat model | versión aprobada, diagrama/fronteras, riesgos y responsables |
| IAM | export de políticas, tests negativos, revisión de grupos y cuentas |
| Auth | resultados de magic link/sesión/CSRF/rate limits |
| Authz | matriz endpoint×rol×objeto ejecutada |
| Pagos | contratos/fixtures, conciliación, idempotencia y carreras |
| Ledger | reporte de invariantes/balances y restore |
| Evidencia | configuración de cuarentena/scanner/URLs y pruebas maliciosas |
| Privacidad | inventario, mapa de datos, retención aprobada y prueba de derecho/exportación |
| Auditoría | muestra completa, protección append-only y acceso separado |
| Plataforma | IaC revisada, escaneos, SBOM, firma/digest y secretos |
| Resiliencia | chaos/fallas, DLQ/replay, runbooks y tabletop |
| UX/a11y/i18n | resultados `CUX-*`, WCAG, ES/pt-BR y textos legales |
| Proveedores | matriz aprobada por país/cuenta/entorno y prueba controlada |

La evidencia contiene datos sintéticos o redactados; no se adjuntan secretos ni PII real al informe.

## 20. Criterios de salida del MVP

### 20.1 Gates obligatorios

- **EXIT-001 — Decisiones:** `DP-001`, `DP-002`, `DP-003`, `DP-011`, `DP-012`, `DP-013`, `DP-020` y `DP-021` resueltas en lo necesario para el piloto; las demás rutas dependientes quedan configuradas o bloqueadas.
- **EXIT-002 — Legal/privacidad:** país, modelo de fondos, textos, inventario, residencia/proveedores y retención aprobados por responsables; sin afirmaciones legales inventadas.
- **EXIT-003 — Proveedor:** flujo real controlado de pago, acreditación, liberación/reembolso y conciliación demostrado para la cuenta piloto.
- **EXIT-003A — Contabilidad:** plan de cuentas, reconocimiento e impuestos necesarios para el piloto (`DPF-001/002`) aprobados; journals balanceados y cierre sin principal en suspense.
- **EXIT-003B — Conciliación:** niveles transaccional, settlement y bancario disponibles probados; cualquier limitación tiene control alternativo aprobado, y `DPF-003..005` resueltas para el piloto.
- **EXIT-004 — Cero duplicados:** pruebas de retry, webhook, tarea, timeout y concurrencia no generan movimientos/asientos duplicados.
- **EXIT-005 — Acceso:** matriz object-level/RBAC completa sin hallazgos críticos/altos abiertos que permitan datos o acciones ajenas.
- **EXIT-005A — Administración:** `DTA-SEC-001` aprobada e implementada con IdP corporativo, MFA, origen/sesión separados, lifecycle y break-glass probado; hasta entonces administración deshabilitada.
- **EXIT-006 — Evidencia:** cuarentena, scanner, límites, derivados, gateway autenticado de lectura y auditoría operativos; `DTA-002` resuelta.
- **EXIT-007 — Secretos/IAM:** sin claves estáticas de service accounts, roles amplios injustificados ni secretos en artefactos/logs; rotación probada.
- **EXIT-008 — Auditoría:** eventos financieros, administrativos, disputa y acceso sensible son append-only, completos y consultables.
- **EXIT-009 — Supply chain:** artefacto firmado/identificado por digest, SBOM y escaneos; sin vulnerabilidad crítica explotable abierta.
- **EXIT-010 — Recuperación:** restore de DB/evidencia y replay controlado completados; conciliación antes de reanudar efectos.
- **EXIT-011 — Operación:** alertas, on-call, runbooks, kill switches y al menos un tabletop ejecutados.
- **EXIT-012 — Funcional:** criterios PRD §17, FSD §26 y modelo §22 pasan para la combinación piloto.
- **EXIT-013 — UX/a11y/i18n:** ES y pt-BR y conformidad WCAG 2.2 AA demostrada en todas las páginas críticas definidas por `RNF-001`/UX §14, además de estados críticos validados según `CUX-*`.
- **EXIT-014 — Rendimiento/fiabilidad:** objetivos aprobados en `DP-020` medidos en staging equivalente y aceptados.
- **EXIT-015 — Aprobación:** Seguridad, Ingeniería, Pagos, Operaciones, Legal/Privacidad y Producto firman el go-live controlado.

### 20.2 Gestión de hallazgos

- Crítico: bloquea salida.
- Alto: bloquea salvo mitigación que elimine exposición antes del go-live; la aceptación de riesgo no puede contradecir un requisito DEBE.
- Medio/bajo: responsable, fecha, alcance y compensación documentados.
- Toda excepción tiene expiración y revisión; no existen waivers indefinidos.
- La severidad considera impacto financiero, datos, alcance, explotabilidad y capacidad de detección/recuperación.

Los umbrales cuantitativos finales y tolerancia de hallazgos no críticos se aprueban con `DP-020`; este documento no inventa cifras.

## 21. Trazabilidad resumida

| Control | Requisitos/flujos | Invariantes/arquitectura | DP/DTA |
|---|---|---|---|
| Magic link/sesión | RF-AUT-001..006, FL-01, CA-AUT-* | GET no consume, POST interactivo, AR-REC-007 | seguridad de ventana a aprobar |
| RBAC/object access | RF-PER-003/004, RF-ADM-006..009, FSD §4/14 | PE-001..006, IAM §11 de arquitectura | DP-012..014 |
| Pagos/webhooks | RF-PAG-001..012, FL-03/10 | INV-FIN-*, SM-PAG/FIN, outbox/inbox | DP-002..007, DP-013/016 |
| API/datos | contrato 06 §§4–23, VC-001..016 | OpenAPI, idempotencia, ETag, constraints, problem+json | DP-005/018, DTA-008 |
| Ledger/conciliación | PF-INV-001..015, RC-001..010, CA-PD-* | doble entrada, journals, settlement y banco | DP-002..007/013, DPF-001..009 |
| Concurrencia | RF-CON-006/007, FL-05 | modelo §18, arquitectura §7 | DP-009/010/013 |
| Evidencia | RF-ENV-001..006, RF-DIS-005..009, FL-04/07 | INV-ENV-*, GCS cuarentena, gateway autenticado | DP-018, DTA-002/008 |
| Privacidad | RF-PER/REP, RN-029, RNF-006 | minimización/IAM/auditoría | DP-001/012/017/018, DTA-001/008 |
| Auditoría | RF-ADM-008/009, RNF-008 | append-only, eventos/correlación | DTA-008 |
| Abuso/fraude | RF-AUT-004, RN-002, RNF-012 | rate limits/retenciones | DP-011..013 |
| CI/CD/entornos | RNF-009/011/012 | arquitectura §13–16 | DP-019/020, DTA-003/006 |
| UX/a11y/i18n | RNF-001..003, CA-I18N-* | UX `CUX-001..028` | DP-001/020 |
| Notificación efectiva | RF-CON-003/004, FSD §10.3/21 | policy gate deny-by-default | DP-021 |

## 22. Decisiones pendientes y bloqueo seguro

| Decisión | Impacto en seguridad/QA | Conducta hasta aprobación |
|---|---|---|
| DP-001 | entidad, país, residencia, idioma legal | producción deshabilitada por combinación |
| DP-002/003 | autenticidad, custodia, liberación, refund, webhook | dobles/sandbox; no afirmar protección ni habilitar dinero real |
| DP-004 | FX/transfronterizo y exposición de datos | no soportar por omisión |
| DP-005..007 | snapshot/costos/destino de comisiones | bloquear cálculo/movimiento no resuelto |
| DP-008..010 | deadlines y carreras | motor configurable; no constantes productivas |
| DP-011..013 | categoría, KYC/AML, fraude, contracargo | hooks/retenciones; no política implícita |
| DP-014..016 | SLA, aprobación, retorno y hito refund | resolución debe expresarlo; si falta, no ejecutar |
| DP-017/018 | reputación, moderación, retención | no publicar/calcular sin política aprobada |
| DP-019 | stack | ratificar ADR; este documento sigue arquitectura propuesta |
| DP-020 | SLO/RTO/RPO/gates cuantitativos | medir y aprobar antes de go-live |
| DP-021 | notificación efectiva, rebotes y fallback previo a autoliberación | sin política aprobada se bloquea y escala |
| DTA-001/006/008 | región, cifrado avanzado, retención | provisionamiento/lifecycle productivo bloqueado |
| DTA-002 | scanner/límites/video | evidencia productiva bloqueada |
| DTA-003/007 | CI/CD/on-call | pipeline/runbooks definitivos bloqueados |
| DTA-SEC-001 | identidad admin corporativa MFA, sesiones/origen separados, lifecycle y break-glass | toda administración productiva deshabilitada |
| DPF-001/002 | plan de cuentas, reconocimiento e impuestos | postings productivos y fee policy bloqueados |
| DPF-003..005 | fuentes de settlement/banco, materialidad y suspense | cierre financiero completo bloqueado |
| DPF-006..009 | ajustes, costos no recuperables, umbrales y retención financiera | consola/aprobaciones/lifecycle afectados bloqueados |

## 23. Guía para implementación con Codex

- Citar `SEC`/`THR`/`TST`/`EXIT` y requisitos fuente en cada cambio sensible.
- No implementar un control solo en UI.
- No registrar cuerpos completos “temporalmente” para depurar producción.
- No crear bypass administrativo genérico ni endpoint de editar estado/saldo.
- No usar identificadores aleatorios como sustituto de autorización.
- No reintentar efecto financiero ambiguo sin consulta.
- No servir archivo desde cuarentena ni confiar en MIME/nombre del cliente.
- No codificar plazos, comisiones, países, límites, retención o umbrales abiertos.
- Agregar prueba negativa y auditoría junto con cada permiso/transición sensible.
- Ante contradicción o `DP-*` faltante, devolver bloqueo explícito y registrar la decisión requerida.

---

### Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.0 | 2026-08-07 | Primera especificación integral de seguridad, privacidad, auditoría y aceptación |
| 0.1.1 | 2026-08-07 | Magic link resistente a scanners, gateway de evidencia, identidad admin bloqueante, acuerdos bilaterales, WCAG AA y `DP-021` |
