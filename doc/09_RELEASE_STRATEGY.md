# 09 — Estrategia de releases y promoción

**Estado:** Borrador operativo para revisión  
**Versión:** 0.1.2  
**Última actualización:** 2026-08-07  
**Responsable:** Producto / Ingeniería / Release Management  
**Audiencia:** Producto, Ingeniería, QA, Diseño, Seguridad, Operaciones, Pagos, Finanzas, Legal y Privacidad  
**Carácter:** Fuente de verdad para secuenciar implementación, validación y despliegues; subordinada a `01_PRD.md`–`08_SECURITY_AUDIT_ACCEPTANCE.md`

> Este documento define **cuándo** puede construirse, integrarse, desplegarse y habilitarse cada capacidad. No aprueba decisiones `DP-*`, `DTA-*`, `DTA-SEC-*`, `DPF-*`, ADR, capacidades de Mercado Pago, países, políticas ni go-live. Ante una decisión pendiente se implementa un puerto, configuración o bloqueo seguro; nunca se convierte un valor propuesto en conducta productiva.

## 1. Propósito

Dividir el MVP en releases verificables que permitan desarrollar y probar la mayor parte del producto antes de incurrir en costos, esperas o riesgos de infraestructura y proveedores externos.

La secuencia es:

```text
R00 base local
  → R01 operación principal local
  → R02 disputas y administración local
  → R03 integraciones sandbox
  → R04 Google Cloud staging
  → R05A verificación productiva cerrada
  → R05B apertura del piloto controlado
```

El avance es acumulativo. Un release posterior hereda todos los gates y evidencias de los anteriores. Una funcionalidad puede prepararse antes solo si es neutral, reversible, no produce efectos externos y permanece deshabilitada.

## 2. Fuentes y precedencia

La precedencia normativa continúa siendo la definida en `AGENTS.md`:

1. decisión formalmente aprobada y registrada por su responsable;
2. `01_PRD.md`;
3. `02_FSD.md`;
4. `03_DOMAIN_AND_STATE_MACHINES.md`;
5. `04`–`08` dentro de su especialidad;
6. este documento para secuencia, gates y promoción;
7. archivo del release activo;
8. `RELEASE_STATUS.yaml` como registro operativo, sin capacidad de modificar requisitos;
9. tickets, conversaciones y código.

Un release no modifica el significado de `RF-*`, `RN-*`, `FL-*`, `INV-*`, `TR-*`, `VC-*`, `CUX-*`, `PF-INV-*`, `TST-*`, `CA-*` o `EXIT-*`. Solo asigna capacidades y evidencia a una etapa.

## 3. Conceptos que no deben confundirse

| Concepto | Definición | Ejemplo |
|---|---|---|
| **Release** | Incremento funcional y verificable con alcance, gates y evidencia propios | `R02` incluye disputas y administración con proveedores simulados |
| **Entorno** | Conjunto aislado de runtime, configuración, datos, secretos y cuentas | `local`, `sandbox`, `staging`, `production` |
| **Build** | Artefacto inmutable identificado por versión, commit y digest | Imagen o paquete producido una vez |
| **Despliegue** | Instalación de un build en un entorno; no implica habilitarlo a usuarios | Publicar una revisión sin tráfico |
| **Promoción** | Uso del mismo build validado en un entorno posterior | Promover digest de staging al piloto |
| **Habilitación** | Activación de capacidad, país, proveedor o tráfico mediante política/flag autorizado | Permitir nuevos pagos para el país piloto |
| **Piloto** | Operación productiva limitada, monitoreada y reversible en alcance | Usuarios, país, moneda e importes aprobados |

Completar `R03` no autoriza desplegar en Google Cloud. Desplegar `R04` en staging no autoriza producción. Completar código de pagos no autoriza dinero real.

## 4. Objetivos de la estrategia

- Desarrollar localmente dominio, UX, contratos, persistencia, seguridad e idempotencia.
- Sustituir proveedores mediante adaptadores sin modificar reglas del dominio (`RNF-010`, `AR-REC-008`).
- Detectar contradicciones, decisiones abiertas y riesgos antes de generar costos de nube.
- Hacer cada promoción auditable, repetible y recuperable.
- Separar autorización técnica, legal, financiera, operativa y de costo.
- Evitar que “compila”, “está desplegado” o “funciona en sandbox” se interprete como release completado.

## 5. Estados de release

Estados canónicos:

| Estado | Significado |
|---|---|
| `planned` | Alcance definido; todavía no comenzó implementación formal |
| `in_progress` | Existe trabajo activo dentro del alcance autorizado |
| `blocked` | Un impedimento explícito detiene el gate de salida; debe indicar IDs y responsable |
| `ready_for_review` | Implementación y evidencia reunidas; falta revisión/aprobación de salida |
| `completed` | Todos los criterios de salida fueron verificados y aprobados |

Transiciones permitidas:

```text
planned → in_progress → ready_for_review → completed
                 ↘ blocked ↗
ready_for_review → in_progress   (hallazgo o evidencia insuficiente)
completed → in_progress          (solo reapertura formal por regresión o invalidez de evidencia)
```

No se salta directamente de `planned` a `completed`. `blocked` no autoriza reducir alcance ni omitir el gate. Toda reapertura conserva el historial y explica causa, impacto y nueva evidencia exigida.

## 6. Registro operativo y autoridad

`releases/RELEASE_STATUS.yaml` registra el release activo, su estado y las autorizaciones explícitas. Es deliberadamente pequeño para que personas, CI y Codex lo lean antes de actuar.

Reglas:

- La ausencia de una autorización equivale a `false`.
- Cambiar una autorización a `true` requiere aprobación humana atribuible fuera del YAML y referencia a su evidencia.
- Una bandera `true` permite intentar el gate correspondiente; no demuestra que el gate esté cumplido.
- `completed_releases` solo contiene releases con checklist y evidencia aprobados.
- Solo puede existir un `current_release` operativo.
- El archivo no registra secretos, tokens, cuentas, emails, URLs firmadas ni PII.
- Fechas usan RFC 3339. Cada cambio actualiza `updated_at`.

## 7. Autorizaciones independientes

Las siguientes autorizaciones son independientes y denegadas por defecto:

| Autorización | Permite | No permite por sí sola |
|---|---|---|
| Sandbox de pagos | Usar cuenta/datos sintéticos en sandbox de Mercado Pago | Dinero real, capacidad `VERIFIED`, producción |
| Email externo de prueba | Enviar únicamente a destinatarios y dominios de prueba allowlisted en R03/R04 | Email productivo, usuarios reales o notificación efectiva según `DP-021` |
| Despliegue cloud | Crear o modificar recursos GCP dentro del presupuesto/entorno aprobado | Staging, producción o facturación ilimitada |
| Staging | Desplegar el build en el entorno staging aprobado | Producción o tráfico público no controlado |
| Proveedor real de pagos | Configurar la cuenta/capacidades productivas aprobadas | Ejecutar dinero real sin autorización de transacción controlada, piloto abierto o volumen no limitado |
| Producción | Desplegar en el proyecto productivo aprobado | Habilitar usuarios/país/dinero sin go-live |
| Transacción real controlada | Ejecutar en R05A un harness excepcional no público para obtener la evidencia productiva faltante de una capacidad `UNVERIFIED` | Ruta financiera ordinaria, cohorte, piloto, repetición fuera del plan o promoción automática a `VERIFIED` |
| Email productivo | Enviar en R05B plantillas/eventos aprobados a la cohorte autorizada | Sustituir `DP-021`, probar notificación efectiva por sí solo o enviar fuera del piloto |
| Piloto | Abrir el alcance productivo expresamente firmado | Expansión regional, FX o disponibilidad general |

Ninguna autorización cierra `DP-002/003`, `DPF-*`, `DTA-*` o `EXIT-*`. La matriz de capacidades de `07` §20 inicia `UNVERIFIED` y se actualiza únicamente con evidencia contractual, técnica y aprobación correspondiente.

## 8. Política de costos y nube

Antes de cualquier recurso facturable deben existir:

1. autorización `cloud_deployment_authorized: true`;
2. entorno y proyecto exactos aprobados;
3. presupuesto máximo, alertas y responsables de costo;
4. inventario de recursos a crear y estimación documentada;
5. estrategia de apagado o scale-to-zero cuando sea segura;
6. etiquetas de ownership, entorno y release;
7. plan de destrucción de recursos efímeros que no afecte datos o evidencia necesarios;
8. región/residencia aprobada cuando el recurso almacene datos (`DTA-001`).

Codex no debe ejecutar `terraform apply`, desplegar a Cloud Run, crear Cloud SQL/Storage/Tasks/Scheduler, habilitar APIs facturables ni configurar dominios/proveedores mientras la autorización correspondiente sea `false`.

R00–R02 no requieren servicios externos. PostgreSQL puede ejecutarse localmente; correo, pagos, archivos, reloj, tareas y webhooks usan dobles deterministas. Si una herramienta local supone costo o cuenta externa, requiere autorización separada.

## 9. Adaptadores, dobles y paridad

Los puertos mínimos son pagos, email, almacenamiento, análisis de evidencia, tareas/reloj y observabilidad. Deben ofrecer implementaciones intercambiables:

- `fake/local`: determinista, configurable, sin red ni credenciales;
- `sandbox`: integración externa limitada y explícitamente autorizada;
- `production`: capacidad aprobada por combinación país/moneda/cuenta/entorno.

Obligaciones:

- El dominio no importa SDKs de Mercado Pago, Resend o Google Cloud.
- El fake permite simular éxito, rechazo, timeout, resultado desconocido, duplicado, evento tardío y fuera de orden.
- Los mismos contratos y fixtures se ejecutan contra fake y sandbox cuando exista autorización.
- Diferencias de sandbox se documentan; sandbox no prueba paridad productiva.
- Una capacidad desconocida falla `CAPABILITY_NOT_ENABLED` o `DECISION_PENDING`.
- Cambiar de adaptador no cambia estados canónicos, ledger, autorización ni invariantes.

## 10. Feature flags, capacidades y políticas

Son mecanismos distintos:

- **Feature flag:** controla exposición o activación técnica reversible.
- **Matriz de capacidades:** indica qué puede hacer un proveedor en una cuenta/país/moneda/entorno con evidencia.
- **Política versionada:** define reglas de negocio aprobadas y congeladas por operación.
- **Autorización de release:** permite trabajar o promover dentro de un alcance.

Una feature flag nunca sustituye una decisión, capacidad, política, permiso o gate. Para una acción sensible deben cumplirse todas las capas aplicables.

Flags mínimos recomendados, inicialmente apagados fuera de pruebas locales:

- `external_test_email_enabled`;
- `production_email_enabled`;
- `payment_sandbox_enabled`;
- `real_payment_enabled`;
- `controlled_real_transaction_enabled`;
- `auto_release_enabled`;
- `evidence_upload_enabled`;
- `admin_console_enabled`;
- `country_<code>_enabled`;
- `pilot_access_enabled`.

Los flags sensibles tienen owner, motivo, entorno, fecha, expiración/revisión y auditoría. Un kill switch impide nuevas acciones sin reescribir operaciones existentes.

## 11. Estrategia de versionado

- Releases de desarrollo: `R00` a `R05` son hitos, no versiones comerciales.
- Aplicación: SemVer una vez creado el artefacto distribuible; antes puede usarse `0.x.y`.
- API: versión mayor en ruta (`/v1`) según `06` §6.1.
- Eventos: `schema_version` obligatorio; consumidores no soportados envían a dead-letter sin perder el evento.
- Base de datos: migraciones ordenadas, con ID/checksum, expand/contract, verificación y forward-fix.
- Políticas: versión inmutable y vigencia; nunca se editan snapshots históricos.
- Infraestructura: módulos/versiones y plan aprobado por entorno.
- Build: se construye una vez y se identifica por commit y digest; no se recompila silenciosamente al promover.

Un cambio incompatible exige versión mayor o plan explícito de coexistencia/migración. Rollback de código no revierte movimientos financieros ni políticas históricas.

## 12. Evidencia de finalización

Cada release mantiene evidencia reproducible, sin secretos ni PII real. Como mínimo:

- commit/build/digest evaluado;
- checklist de criterios con resultado y fecha;
- comandos o pipeline reproducibles y sus reportes;
- pruebas vinculadas a IDs normativos;
- migraciones y verificación de invariantes cuando apliquen;
- cobertura de permisos negativos, fallos, retries y concurrencia proporcional al riesgo;
- hallazgos abiertos con severidad, owner, fecha y compensación;
- decisiones/capacidades que continúan bloqueadas;
- procedimiento de rollback/forward-fix probado;
- aprobadores requeridos para el gate.

R04 y las fases R05A/R05B además requieren la evidencia de auditoría de `08` §19 y los `EXIT-*` aplicables a cada fase. Una captura manual aislada no sustituye pruebas o registros reproducibles.

## 13. Cambio de estado y revisión

Para pasar a `ready_for_review`:

1. completar alcance y criterios del archivo `RXX_*.md`;
2. ejecutar pruebas obligatorias;
3. registrar evidencia y hallazgos;
4. confirmar que no se cerró ninguna decisión implícitamente;
5. demostrar recuperación apropiada al release.

Para pasar a `completed`:

1. revisión humana del alcance y evidencia;
2. cero críticos abiertos y tratamiento de altos conforme a `08` §20.2;
3. aprobación de owners requeridos;
4. actualización atómica del archivo del release y `RELEASE_STATUS.yaml`;
5. definición del próximo release sin habilitar autorizaciones nuevas implícitamente.

Codex puede preparar el cambio de estado y la evidencia, pero no autoaprobar una firma humana, decisión legal/financiera, capacidad de proveedor, gasto, despliegue o go-live.

## 14. Rollback y suspensión

Todo release define rollback proporcional:

- **Código:** volver a build compatible previamente verificado.
- **Datos:** expand/contract y forward-fix; no borrar/recrear para corregir historia.
- **Políticas:** retirar o reemplazar para nuevas operaciones; snapshots permanecen.
- **Flags:** apagar nuevas acciones mediante kill switch; no alterar estados previos.
- **Proveedores:** pausar nuevas intenciones; reconciliar resultados desconocidos antes de reintentar.
- **Dinero:** una compensación es una orden nueva, autorizada, auditada y conciliada; nunca un rollback técnico.
- **Restauración:** bloquear efectos externos, restaurar, validar ledger/constraints, reconciliar y recién entonces reanudar.

La suspensión de un release o entorno preserva evidencia, auditoría, operaciones existentes y responsables de resolución.

## 15. Releases

### R00 — Base local

**Objetivo:** establecer una base ejecutable y verificable sin nube ni proveedores externos.

Incluye:

- estructura del repositorio y límites modulares recomendados;
- stack local reversible sujeto a `DP-019`/ADR;
- PostgreSQL local, migraciones iniciales, constraints, outbox/inbox e idempotencia base;
- catálogos ES/pt-BR, formateo central de dinero/fecha/zona y componentes accesibles;
- identidad/magic link local simulado y sesiones sin privilegios administrativos;
- puertos y fakes de pagos, email, storage/scanner, tareas/reloj y observabilidad;
- configuración tipada, secretos ausentes del repositorio y datos sintéticos;
- format, lint, typecheck, unitarias, integración con PostgreSQL real y escaneo básico;
- documentación de arranque, prueba y recuperación local.

Fuera de alcance: red externa, cuentas reales, Google Cloud, Mercado Pago/Resend sandbox, dinero, consola administrativa privilegiada y valores productivos de decisiones abiertas.

Gate de salida: entorno local reproducible; fakes cubren fallos/reintentos; migraciones verificadas; límites de dominio sin SDK externo; pruebas base y recuperación local pasan.

### R01 — Operación principal local

**Objetivo:** completar el flujo vertical participante de punta a punta con efectos simulados.

Incluye:

- FL-01 a FL-05, FL-10 a FL-12 en variantes habilitadas por política de prueba;
- solicitud, acuerdo inmutable, pago simulado, envío/evidencia simulada, confirmación, liberación/reembolso simulado y calificación posterior al cierre;
- dashboards de compras/ventas, detalle canónico y perfil público minimizado;
- recordatorios/tareas locales deterministas y carrera reclamo/liberación;
- estados de carga, vacío, error, pendiente y revisión; ES/pt-BR y accesibilidad;
- ledger local de doble entrada, órdenes durables e idempotencia sin postings productivos.

Las cifras propuestas se usan solo como fixtures etiquetados de prueba. Autoliberación falla cerrado si falta la política requerida por `DP-021`.

Gate de salida: flujo principal E2E local, invariantes y contratos cubiertos; duplicados/out-of-order/timeouts no crean doble efecto; autorización por objeto negativa; UI crítica accesible y localizada.

### R02 — Disputas y administración local

**Objetivo:** completar el dominio del MVP y su operación humana con proveedores simulados.

Incluye:

- FL-06 a FL-09, FL-13 y FL-14;
- evidencia bilateral, expediente, propuestas bilaterales versionadas, resolución, devolución y movimientos simulados;
- reputación/moderación configurables, auditoría append-only y proyecciones reconstruibles;
- consola funcional con identidades/roles locales de prueba, nunca autenticación administrativa productiva;
- políticas versionadas, diffs, snapshots y bloqueos `DECISION_PENDING`;
- runbooks locales, concurrencia, compensaciones simuladas y casos adversos;
- matrices de permisos y aceptación funcional completas en local.

Gate de salida: dominio del MVP demostrable localmente; ninguna aceptación parcial mueve dinero; resolución asigna componentes; devolución respeta hito; auditoría y acceso sensible probados; `DP-*`, `DTA-*`, `DTA-SEC-001` y `DPF-*` permanecen explícitos.

### R03 — Integraciones sandbox

**Objetivo:** validar adaptadores y contratos externos sin desplegar producción ni declarar capacidades reales.

Condición de entrada para pasar a `in_progress`: R00–R02 completos. Cada integración mantiene el fake y permanece bloqueada hasta que su gate individual esté en `true`: `payment_provider_sandbox_authorized` antes de Mercado Pago sandbox y `external_test_email_authorized` antes de Resend de prueba.

Incluye:

- spike y pruebas contractuales de Mercado Pago por país/moneda/cuenta de prueba;
- Resend limitado a dominio/destinatarios de prueba aprobados;
- autenticidad, deduplicación y orden de webhooks; polling/reconciliación;
- timeouts, rate limits, reintentos, eventos tardíos y resultado desconocido;
- comparación fake/sandbox y registro de diferencias;
- registro de observaciones sandbox como evidencia separada; la capacidad de la matriz de `07` §20 permanece `UNVERIFIED` y no se crean estados intermedios habilitantes;
- fixtures redactados/versionados, sin dinero ni PII real.

Gate para `ready_for_review`/`completed`: suites de contrato reproducibles; adaptadores no penetran el dominio; credenciales segregadas; observaciones y limitaciones documentadas; ninguna capacidad productiva habilitada; ambos gates de integración estuvieron autorizados y fueron probados. Si uno se excluye, se requiere un ajuste de alcance formal, aprobado y trazable que identifique el gate downstream que seguirá bloqueado; la mera ausencia de autorización no reduce el alcance silenciosamente.

### R04 — Google Cloud staging

**Objetivo:** validar topología, seguridad, migración, operación y costos en un entorno cloud no productivo equivalente.

Condición de entrada: R03 completo; `cloud_deployment_authorized` y `staging_deployment_authorized` en `true`; presupuesto/región/IAM aprobados para staging. Esto no resuelve residencia productiva ni `DTA-001` fuera de ese alcance.

Incluye:

- Cloud Run web/API/worker/jobs, Cloud SQL, Storage, Tasks/Scheduler, Secret Manager, observabilidad e IaC en staging;
- separación de identidades, red, secretos, cuentas y datos sintéticos;
- build por digest, SBOM, escaneos, promoción gradual y rollback;
- migración/forward-fix, restore, replay, DLQ, kill switches y conciliación sin dinero real;
- E2E FL-01..14, DAST, accesibilidad, i18n, carga y resiliencia;
- medición de costos y ajuste de límites/scale-to-zero.

Gate de salida: infraestructura reproducible; staging no contiene secretos/datos productivos; restore/replay no duplica efectos; IAM y seguridad revisados; rendimiento medido; runbooks/tabletop ejecutados; hallazgos gestionados.

### R05 — Producción controlada en dos fases

R05 conserva un único `current_release` y un único archivo operativo, pero se ejecuta en dos fases secuenciales. R05A obtiene la evidencia productiva que exigen `EXIT-003`, `EXIT-003A` y `EXIT-003B`; R05B usa esa evidencia junto con todos los demás `EXIT-*` para autorizar la cohorte. Completar R05A no equivale a completar R05.

#### R05A — Verificación productiva cerrada

**Objetivo:** ejecutar una verificación real estrictamente cerrada para probar capacidades productivas, postings, conciliación y controles sin abrir una cohorte ni iniciar el piloto.

Condición de entrada: R04 completo; `cloud_deployment_authorized`, `production_deployment_authorized`, `real_payment_provider_authorized` y `controlled_real_transaction_authorized` en `true`; decisiones legales, financieras, fiscales, de seguridad y operación necesarias para la verificación resueltas; y plan de verificación firmado por humanos. La capacidad puede seguir `UNVERIFIED` únicamente cuando la evidencia pendiente sea la operación productiva controlada que R05A está autorizada a obtener.

Reglas obligatorias:

- `production_pilot_authorized` y `production_email_authorized` permanecen `false`;
- no existe cohorte, autoservicio, tráfico público ni invitación de usuarios;
- se usa un harness excepcional, no público y separado de la ruta financiera ordinaria; no invoca `TR-FIN-002` como transición ordinaria ni queda accesible desde UI/API de participantes;
- el plan firmado identifica capacidad y propósito, entidad/cuenta/país/moneda, actores controlados, monto máximo, cantidad máxima de intentos, ventana temporal, aprobadores, owner operativo, kill switch, comportamiento esperado de ledger/auditoría y procedimiento de consulta/reconciliación;
- cada intento está preautorizado individualmente dentro del plan; cualquier intento adicional requiere un plan y aprobación nuevos;
- no se usa email productivo; las comunicaciones de control siguen el canal operativo aprobado;
- una capacidad `UNVERIFIED` permanece `UNVERIFIED` durante toda la ejecución y no habilita rutas ordinarias; fuera del harness R05A, toda acción productiva ordinaria sigue exigiendo `VERIFIED`;
- se reconcilian pago, acreditación, ledger, settlement/banco cuando aplique y liberación/reembolso permitido antes de cerrar la evidencia;
- un timeout, diferencia o resultado desconocido detiene nuevas transacciones y activa reconciliación/runbook.

Gate de salida de R05A: evidencia suficiente y firmada para evaluar `EXIT-003`, `EXIT-003A` y `EXIT-003B`; cero duplicados; balance y conciliación explicables; límites respetados; transacciones cerradas o bajo owner/SLA explícito; autorizaciones de piloto y email productivo aún falsas. Una revisión humana separada evalúa contrato, ejecución, ledger, auditoría y conciliación: mantiene la capacidad `UNVERIFIED` y bloqueada, o la marca `VERIFIED` con scope, versión, evidencia y aprobadores. El harness nunca auto-promueve. Si la evidencia falla o queda incompleta, no se abre R05B.

#### R05B — Apertura del piloto controlado

**Objetivo:** abrir una cohorte productiva mínima, monitoreada y suspendible solo después de completar la verificación cerrada.

Condición de entrada: R05A cerrada con evidencia aceptada; todos los `EXIT-001..015` y subgates aplicables satisfechos y firmados, incluidos los que usan evidencia de R05A; `production_pilot_authorized` y `production_email_authorized` en `true`; identidad administrativa, soporte, on-call, políticas y límites del piloto aprobados.

Incluye exclusivamente:

- entidad, país, moneda, cuenta, categorías, límites, cohorte y duración aprobados;
- capacidades de pago `VERIFIED`, versionadas, aprobadas y limitadas por scope;
- identidad administrativa corporativa/MFA/break-glass (`DTA-SEC-001`);
- políticas legales, financieras, fiscales, privacidad, notificaciones y operación aprobadas;
- email productivo solo para plantillas, eventos y destinatarios del piloto; `production_email_authorized` no sustituye las condiciones de notificación efectiva, rebotes, fallback o escalamiento de `DP-021`;
- dinero real solo dentro de límites y controles firmados;
- soporte, on-call, conciliación, alertas, kill switches y resolución humana activos;
- promoción del build ya validado, despliegue gradual y monitoreo de salida.

Gate de salida de R05B/R05: métricas y criterios aprobados en `DP-020`; conciliación/cierre; cero hallazgos bloqueantes; revisión multidisciplinaria; decisión explícita de cerrar, extender o detener el piloto. R05 no autoriza disponibilidad general ni expansión a otro país/moneda.

## 16. Gates acumulativos resumidos

| Gate | R00 | R01 | R02 | R03 | R04 | R05A | R05B |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sin servicios externos | obligatorio | obligatorio | obligatorio | no | no | no | no |
| Dominio/contratos locales | base | principal | completo | regresión | regresión | regresión | regresión |
| Proveedores sandbox | no | no | no | por integración | autorizado según prueba | separado | separado |
| Google Cloud | no | no | no | no requerido | staging autorizado | producción autorizada | producción autorizada |
| Dinero real | no | no | no | no | no | transacción(es) preautorizada(s), sin cohorte | piloto limitado |
| Email externo | no | no | no | solo prueba | solo prueba | no productivo | productivo autorizado + `DP-021` |
| `EXIT-*` | referencia | referencia | preparación | evidencia parcial | ensayo | producir evidencia `EXIT-003/003A/003B` | todos satisfechos |
| Firmas legal/finanzas/seguridad | no implícitas | no implícitas | no implícitas | capacidad limitada | gates técnicos | scope real cerrado | go-live obligatorio |

## 17. Reglas operativas para Codex

Antes de cualquier cambio:

1. leer `AGENTS.md`, `09_RELEASE_STRATEGY.md`, `releases/RELEASE_STATUS.yaml` y el archivo `RXX_*.md` activo;
2. leer los documentos `01`–`08` exigidos por el área;
3. confirmar release, estado, autorizaciones y decisiones bloqueantes;
4. revisar trabajo existente y no pisar cambios ajenos.

Durante el trabajo:

- trabajar solo en el release activo;
- no adelantar una capacidad futura salvo componente neutral, reversible y apagado expresamente incluido;
- citar release e IDs normativos en cambios/pruebas/evidencia;
- usar fakes en R00–R02 y no introducir credenciales externas;
- no desplegar, crear recursos, enviar emails de prueba/productivos, usar proveedores ni ejecutar una transacción real controlada sin su autorización explícita y específica;
- no activar dinero, país, autoliberación o administración productiva mediante un simple flag;
- mantener `DECISION_PENDING`/`CAPABILITY_NOT_ENABLED` para rutas abiertas;
- preservar evidencia y registrar bloqueos sin inventar aprobaciones.

Al entregar:

- actualizar checklist/evidencia del release, no solo describir el código;
- declarar pruebas ejecutadas, no ejecutadas y causa;
- listar decisiones y autorizaciones que siguen pendientes;
- no marcar `completed` sin revisión de salida;
- no modificar un release futuro para ocultar deuda del actual.

## 18. Gestión de cambios de alcance

Una solicitud nueva se clasifica como:

- corrección necesaria para cumplir el release activo;
- capacidad neutral compartida;
- alcance de un release futuro;
- fuera del MVP.

Mover alcance requiere actualizar `09`, los archivos de release afectados, trazabilidad y riesgos. No se reetiqueta un requisito bloqueado como “fuera de alcance” para completar un release. Los cambios financieros, legales, de seguridad o datos personales requieren revisión de sus owners.

## 19. Decisiones pendientes preservadas

Esta estrategia no resuelve:

- `DP-001..021` del PRD;
- `DTA-001..008` y `DTA-SEC-001`;
- `DPF-001..009`;
- ADR propuestos en `05`;
- capacidades `UNVERIFIED` de Mercado Pago;
- umbrales, SLO/RTO/RPO, presupuesto, países, importes o fecha de piloto;
- firmas `EXIT-015`.

En especial, R00–R04 pueden producir software y evidencia, pero no convierten por sí mismos recomendaciones técnicas en decisiones aprobadas ni habilitan operación financiera productiva. R05A habilita únicamente la verificación real cerrada expresamente autorizada; solo R05B puede abrir una cohorte después de todos los `EXIT-*`.

---

### Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.2 | 2026-08-07 | Define harness excepcional R05A para producir evidencia de capacidades `UNVERIFIED` sin usar la ruta ordinaria ni auto-promover; R05B conserva requisito `VERIFIED` |
| 0.1.1 | 2026-08-07 | Separa email de prueba/productivo, agrega gate de transacción real controlada, divide R05 en verificación cerrada R05A y piloto R05B, y aclara progreso parcial de R03 sin inventar estados de capacidad |
| 0.1.0 | 2026-08-07 | Primera estrategia R00–R05 con progresión local, sandbox, staging y piloto; autorizaciones separadas, gates, evidencia, rollback y reglas para Codex |
