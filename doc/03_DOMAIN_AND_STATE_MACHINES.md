# 03 — Modelo de dominio y máquinas de estados

**Estado:** Borrador implementable sujeto a decisiones pendientes  
**Versión:** 0.1.1  
**Última actualización:** 2026-08-07  
**Responsable:** Arquitectura de dominio / Ingeniería  
**Audiencia:** Producto, Ingeniería, QA, Operaciones, Riesgo y Auditoría  
**Carácter:** Fuente de verdad para el modelo de dominio, invariantes y transiciones del MVP

> Este documento deriva de `01_PRD.md` 0.1.0 y `02_FSD.md` 0.1.0. Formaliza el dominio sin cerrar las decisiones `DP-001` a `DP-021`, `DTA-SEC-001` ni otras decisiones técnicas/financieras abiertas. Si una transición depende de una decisión abierta, exige una política efectiva explícita o bloquea la acción; nunca completa el valor por defecto en código. No atribuye a Mercado Pago capacidades no verificadas: toda operación financiera depende de la matriz aprobada en `DP-002` y `DP-003`.

## 1. Propósito y precedencia

Este documento define:

- lenguaje ubicuo y límites transaccionales;
- agregados, entidades y objetos de valor;
- invariantes que deben cumplirse en cualquier interfaz, tarea o integración;
- máquinas de estados exhaustivas y transiciones permitidas;
- eventos de dominio, idempotencia, concurrencia y recuperación;
- correlación con requisitos, reglas de negocio y decisiones pendientes.

Precedencia documental:

1. decisiones legales, financieras o de producto formalmente aprobadas;
2. `01_PRD.md`;
3. `02_FSD.md`;
4. este documento;
5. tickets, código y conversaciones.

Ante contradicción, se bloquea la implementación afectada y se registra la discrepancia. Un estado no definido aquí no puede introducirse en código sin actualizar esta fuente.

## 2. Convenciones

- **DEBE / NO DEBE:** obligación o prohibición del MVP.
- **PUEDE:** conducta permitida, no obligatoria.
- `AGG-*`: agregado; `ENT-*`: entidad; `VO-*`: objeto de valor.
- `INV-*`: invariante; `EVT-*`: evento de dominio; `CMD-*`: comando.
- `SM-*`: máquina de estados; `TR-*`: transición; `ERR-*`: error de dominio.
- Todos los instantes se persisten en UTC. La zona y calendario de política se conservan para explicar el cálculo.
- Todos los importes se persisten como entero en unidad menor más código ISO 4217; no se usan números de punto flotante.
- “Confirmado” para un hecho financiero significa confirmado por webhook autenticado o consulta reconciliada, no por retorno del navegador.
- Las tablas expresan una lista cerrada de transiciones ordinarias. Las correcciones excepcionales agregan hechos compensatorios; no reescriben historial.

## 3. Glosario de lenguaje ubicuo

| Término | Definición normativa |
|---|---|
| Solicitud | Propuesta creada por un vendedor y dirigida a un comprador; aún puede estar sin aceptar o sin pagar. |
| Operación | Expediente transaccional raíz que correlaciona acuerdo, pago, envío, disputa, devolución y cierre. |
| Acuerdo | Versión inmutable de las condiciones materiales aceptadas por las partes. La publicación externa es solo referencia. |
| Política efectiva | Versión publicada y aplicable según ámbito, vigencia y precedencia. |
| Instantánea de política | Copia inmutable de reglas y versiones aplicadas a una operación en el hito que resuelva `DP-005`. |
| Intento de pago | Interacción individual con un proveedor para pagar una operación. Puede haber más de uno, pero como máximo uno acreditado. |
| Acreditación | Hecho financiero confirmado y conciliado que, si no hay retenciones, habilita el despacho. |
| Retención | Bloqueo explícito con causa que impide una acción, especialmente liberar fondos. |
| Evidencia | Texto, archivo, tracking o hecho preservado, atribuible, fechado y sujeto a reglas de visibilidad. |
| Declaración de despacho | Afirmación confirmada por el vendedor con los datos y evidencia exigidos por la política. |
| Reclamo | Acto válido del comprador que abre una disputa y bloquea liberación ordinaria. |
| Disputa | Expediente de alegaciones, evidencia, revisión humana y resolución. |
| Resolución | Fallo inmutable y fundado que asigna importes y, si corresponde, impone una devolución. |
| Devolución | Subproceso autorizado por una resolución o acuerdo aprobado para retornar el bien. |
| Orden financiera | Intención durable e idempotente de liberar o reembolsar un importe. |
| Liberación | Movimiento confirmado que pone el importe definido a disposición del vendedor según el modelo aprobado. |
| Reembolso | Movimiento confirmado que devuelve al comprador el importe definido. |
| Cierre financiero | Hecho que constata que las órdenes requeridas están confirmadas y el libro interno reconcilia. |
| Calificación | Evaluación única de una parte a la contraparte, ligada a una operación elegible y a su rol. |
| Estado terminal | Estado sin transición ordinaria saliente. No impide eventos de auditoría, moderación ni compensación excepcional. |
| Correlación | Identificador que une comando, eventos, tareas, webhook, orden y auditoría de una misma causalidad. |

## 4. Contextos delimitados y dependencias

| Contexto | Responsabilidad | Agregados principales | No decide |
|---|---|---|---|
| Identidad y acceso | Cuenta, correo verificado, sesión, magic link, consentimiento y restricciones | `AGG-CUENTA`, `AGG-DESAFIO-ACCESO` | Riesgo financiero o resultado de disputas |
| Operaciones y acuerdo | Solicitud, participantes, acuerdo, política congelada y estado coordinador | `AGG-OPERACION` | Estado autoritativo del proveedor |
| Políticas y elegibilidad | Versionado, precedencia, vigencia, matriz país/moneda/categoría | `AGG-POLITICA`, `AGG-MATRIZ-LANZAMIENTO` | Capacidades externas no verificadas |
| Pagos y libro | Intentos, conciliación, retenciones, órdenes financieras y asientos | `AGG-PAGO`, `AGG-ORDEN-FINANCIERA`, `AGG-LIBRO-OPERACION` | Veredicto de disputa |
| Cumplimiento logístico | Despacho, tracking, evidencias y fechas de entrega | `AGG-ENVIO` | Autenticidad definitiva de evidencia |
| Disputas | Reclamo, evidencia bilateral, revisión, aprobación y resolución | `AGG-DISPUTA` | Ejecución física del movimiento financiero |
| Devoluciones | Instrucciones, despacho de retorno, recepción e incidencias | `AGG-DEVOLUCION` | Regla de consecuencia no escrita en el fallo |
| Reputación | Elegibilidad, calificaciones, publicación, moderación y proyección pública | `AGG-CALIFICACION`, `AGG-REPUTACION` | Resultado financiero |
| Notificaciones | Preparación, entrega, deduplicación y preferencia de idioma | `AGG-NOTIFICACION` | Hechos de negocio por entrega de email |
| Auditoría | Registro inmutable de accesos y acciones sensibles | Registro append-only | Modificar el estado de otro contexto |

### 4.1 Reglas entre contextos

- `AGG-OPERACION` coordina el estado visible, pero no copia como verdad estados financieros o logísticos: los proyecta desde eventos confirmados.
- Los contextos se integran mediante identificadores y eventos; no modifican directamente tablas internas ajenas.
- Pagos traduce códigos del proveedor mediante una capa anticorrupción y conserva el código original.
- Una notificación fallida no revierte un hecho de negocio ni extiende un plazo, salvo política legal aprobada que diga lo contrario.
- Auditoría recibe eventos; nunca es una vía para editar estados.

## 5. Agregados, entidades y objetos de valor

### 5.1 `AGG-OPERACION` — Operación

**Raíz:** `Operacion`.

**Contiene:** participantes comprador/vendedor, país operativo, moneda, monto base, categoría, solicitud, versiones del acuerdo, referencia de instantánea de política, estado coordinador, hitos, retenciones proyectadas y referencias a subprocesos.

**Responsabilidades:** crear/enviar/cancelar/expirar solicitud; aceptar acuerdo; habilitar pago; coordinar envío, confirmación, disputa y cierre; impedir combinaciones imposibles.

**Límite:** no confirma pagos ni movimientos por sí mismo.

### 5.2 `AGG-PAGO` — Pago de operación

**Raíz:** `PagoOperacion`. **Entidades:** `IntentoPago`, `ObservacionProveedor`, `Conciliacion`. Mantiene como máximo un intento acreditado, monto/moneda esperados y estado de conciliación.

### 5.3 `AGG-ENVIO` — Envío

**Raíz:** `Envio`. **Entidades:** `VersionTracking`, `AdjuntoEvidencia`, `HitoLogistico`. Conserva borrador y declaración confirmada; una corrección agrega versión.

### 5.4 `AGG-DISPUTA` — Disputa

**Raíz:** `Disputa`. **Entidades:** `Alegacion`, `PresentacionEvidencia`, `SolicitudInformacion`, `AsignacionRevisor`, `SettlementProposal`, `SettlementAcceptance`, `PropuestaResolucion`, `Aprobacion`, `Resolucion`. El fallo confirmado es inmutable. Un `SettlementProposal` es versionado y ortogonal al estado principal de disputa hasta que ambas partes aceptan exactamente la misma versión.

### 5.5 `AGG-DEVOLUCION` — Devolución

**Raíz:** `Devolucion`. **Entidades:** `InstruccionesDevolucion`, `DespachoDevolucion`, `ConfirmacionRecepcion`, `IncidenciaDevolucion`. Solo nace de una resolución vigente o acuerdo aprobado.

### 5.6 `AGG-ORDEN-FINANCIERA` y `AGG-LIBRO-OPERACION`

`OrdenFinanciera` controla una intención externa. `LibroOperacion` contiene asientos inmutables y saldo atribuible. Un webhook confirma una orden solo tras correlación, validación de importe/moneda/destino y reconciliación.

### 5.7 `AGG-CALIFICACION` y `AGG-REPUTACION`

`Calificacion` controla una evaluación por `(operacion, autor, rol_evaluado)`. `Reputacion` es una proyección reproducible; no es editable manualmente.

### 5.8 `AGG-POLITICA`

**Raíz:** `PoliticaVersionada`. Mantiene ámbito, valores, vigencia, estado, autor, motivo y regla de precedencia. Publicar una nueva versión nunca muta una versión previa ni una instantánea congelada.

### 5.9 `AGG-REVISION-FINANCIERA-EXCEPCIONAL`

**Raíz:** `RevisionFinancieraExcepcional`. Registra una observación financiera posterior o incompatible con el ciclo de la operación —incluido un pago tardío sobre `CANCELADA` o `EXPIRADA`—, su hold, conciliaciones, decisión autorizada y órdenes compensatorias si correspondieran. Es un subproceso ortogonal: no reabre ni cambia el estado terminal de la operación.

### 5.10 Objetos de valor obligatorios

| ID | Objeto | Reglas |
|---|---|---|
| `VO-DINERO` | `Dinero(unidadesMenores, moneda)` | Entero; moneda ISO; operaciones solo con la misma moneda; sin flotantes. |
| `VO-DESGLOSE` | Monto base, comisiones, impuestos/cargos, total y neto | Debe reconciliar según política y redondeo; cada componente conserva causa y versión. |
| `VO-CORREO` | Dirección normalizada y original | Comparación canónica definida; nunca se expone en perfil público. |
| `VO-PARTICIPANTE` | Cuenta, rol transaccional | Exactamente un comprador y un vendedor, distintos y autorizados. |
| `VO-PAIS-MONEDA` | País operativo + moneda | Debe estar habilitado en matriz efectiva; no implica operación transfronteriza. |
| `VO-PLAZO` | Inicio, vencimiento, zona, calendario, regla | Conserva fórmula y resultado; no usa hora local ambigua sin zona. |
| `VO-IDEMPOTENCIA` | Ámbito + clave estable | Única por tipo de comando y agregado; misma clave con payload distinto es conflicto. |
| `VO-HASH-EVIDENCIA` | Algoritmo + digest + tamaño | Se calcula sobre original; una nueva versión obtiene nuevo hash. |
| `VO-TRACKING` | Transportista, código/URL, versión | Validación sintáctica no equivale a prueba de entrega. |
| `VO-REFERENCIA-PROVEEDOR` | Proveedor, cuenta/país y referencia | Opaca; no se reutiliza entre operaciones incompatibles. |
| `VO-CAUSA-RETENCION` | Tipo, origen, inicio, vigencia | La retención se elimina solo por evento explícito y auditable. |
| `VO-AMBITO-POLITICA` | Global/país/moneda/categoría/combinación aprobada | Precedencia determinista y ausencia de empate. |

## 6. Invariantes

### 6.1 Operación y acuerdo

- **INV-OPS-001:** una operación tiene exactamente un vendedor, un comprador, una moneda y un monto base positivo. (`RN-001`)
- **INV-OPS-002:** comprador y vendedor no son la misma cuenta; controles de riesgo pueden rechazar identidades relacionadas. (`RN-002`)
- **INV-OPS-003:** solo una combinación habilitada de país, moneda, categoría, monto, textos legales y capacidad de pago puede enviarse o pagarse. (`RF-OPS-003`, `RF-PAG-001`, `DP-003`, `DP-011`)
- **INV-OPS-004:** el acuerdo aceptado es inmutable. Una modificación material requiere nueva operación. (`RF-OPS-005`, `RN-003`, `RN-004`)
- **INV-OPS-005:** una operación conserva la versión de política aplicable cuando se alcance el hito resuelto por `DP-005`; hasta entonces la ruta que dependa de ello debe bloquearse.
- **INV-OPS-006:** cancelada o expirada no habilita despacho aunque llegue un pago tardío. (`RN-005`)
- **INV-OPS-007:** toda transición registra anterior, nuevo, actor, causa, instante, versión y correlación.

### 6.2 Dinero y proveedor

- **INV-FIN-001:** “iniciado”, “pendiente” o retorno exitoso del navegador nunca equivalen a acreditado. (`RN-013`, `RN-014`)
- **INV-FIN-002:** como máximo un intento de pago puede quedar acreditado por operación.
- **INV-FIN-003:** una acreditación requiere coincidencia de operación, cuenta del proveedor, monto, moneda y referencia, más reconciliación.
- **INV-FIN-004:** la suma de liberaciones, reembolsos y ajustes confirmados no supera el saldo atribuible. (`RF-PAG-012`)
- **INV-FIN-005:** cada orden financiera tiene clave de idempotencia estable; resultado desconocido se consulta antes de reintentar. (`RF-PAG-003`)
- **INV-FIN-006:** una orden no alcanza `CONFIRMADA` por respuesta provisional; requiere confirmación reconciliada.
- **INV-FIN-007:** los asientos son append-only y el desglose reconcilia exactamente en unidades menores. (`RF-PAG-011`, `RN-011`)
- **INV-FIN-008:** comisiones de comprador, vendedor y reclamo son componentes independientes y versionados; su tratamiento no se infiere (`DP-006`, `DP-007`).
- **INV-FIN-009:** ninguna liberación se autoriza con reclamo abierto, retención, anomalía, contracargo, revisión o orden incompatible. (`RN-020`, `RN-023`)
- **INV-FIN-010:** un pago tardío observado o acreditado sobre una operación `CANCELADA` o `EXPIRADA` no cambia ese estado terminal, no habilita despacho y abre como máximo una `RevisionFinancieraExcepcional` idempotente con hold `LATE_PAYMENT_REVIEW`.

### 6.3 Envío, evidencia y tiempo

- **INV-ENV-001:** solo un pago acreditado y conciliado, sin retención de despacho, permite declarar envío. (`RF-PAG-007`)
- **INV-ENV-002:** declarar despacho exige los campos y evidencias de la política; borradores incompletos no cambian el estado. (`RF-ENV-001..003`, `RN-017`)
- **INV-ENV-003:** evidencia y tracking no se sobrescriben; se versionan con autor, instante y hash/original cuando aplique. (`RF-ENV-004`, `RF-ENV-006`)
- **INV-ENV-004:** una tarea vencida relee estado, retenciones y política congelada en la misma decisión transaccional. (`RF-CON-007`, `RN-021`)
- **INV-ENV-005:** las propuestas de 10 días y tres recordatorios no son constantes; provienen de política aprobada (`DP-009`, `DP-010`).

### 6.4 Disputa y devolución

- **INV-DIS-001:** una apertura válida aceptada antes del límite crea exactamente una disputa activa y una retención de liberación. (`RF-DIS-004`, `RN-023`)
- **INV-DIS-002:** existe como máximo una disputa ordinaria activa por operación.
- **INV-DIS-003:** solo un revisor sin conflicto y con permiso puede confirmar resolución. (`RN-030`)
- **INV-DIS-004:** la resolución identifica el destino de cada componente monetario y no excede saldo. (`RN-028`)
- **INV-DIS-005:** si requiere doble control, ninguna orden financiera nace antes de la aprobación exigida. (`RF-DIS-012`)
- **INV-DIS-006:** fallo y evidencia original son inmutables; moderación o corrección agrega hechos. (`RN-029`, `RF-DIS-015`)
- **INV-DIS-007:** toda propuesta de acuerdo bilateral identifica versión, autor, asignación financiera completa, condiciones, vencimiento y política; modificarla invalida aceptaciones anteriores y crea una versión nueva.
- **INV-DIS-008:** comprador y vendedor aceptan por separado la misma versión vigente. Ninguna aceptación individual —incluida la del vendedor— resuelve la disputa, crea una orden financiera ni mueve dinero.
- **INV-DIS-009:** la segunda aceptación válida congela la propuesta y, en la misma transacción, la envía a revisión/crea un candidato de resolución `ACUERDO`; todavía requiere controles administrativos, financieros y de proveedor antes del fallo.
- **INV-DEV-001:** una devolución protegida solo existe por resolución o acuerdo aprobado. (`RF-DEV-001`)
- **INV-DEV-002:** la resolución fija destino, responsable de costo, plazo, evidencia, hito de reembolso e inacción; cualquier elemento regido por `DP-014..016` debe estar explícito.
- **INV-DEV-003:** el reembolso espera el hito escrito; no se infiere de tracking ni silencio. (`RF-DEV-004`, `RN-027`)

### 6.5 Reputación y políticas

- **INV-REP-001:** solo una operación terminal elegible permite calificar; cancelada antes del pago no es elegible. (`RN-031`, `RN-032`)
- **INV-REP-002:** una parte califica una vez por rol y operación, nunca a sí misma. (`RF-REP-011`)
- **INV-REP-003:** comentario obligatorio pasa controles objetivos; opinión negativa válida no se rechaza por ser negativa. (`RN-033`)
- **INV-REP-004:** publicación, escala, ventana y fórmula dependen de `DP-017`; sin política aprobada no se publica ni computa.
- **INV-POL-001:** una versión publicada no se edita; se reemplaza por otra versión con vigencia. (`RF-ADM-002`)
- **INV-POL-002:** no puede haber dos reglas efectivas indistinguibles para el mismo caso e instante. (`RF-ADM-003`)
- **INV-POL-003:** retirar una política no altera instantáneas históricas. (`RF-ADM-005`)

## 7. Catálogo de eventos de dominio

Todo evento incluye `event_id`, `event_type`, `aggregate_id`, `aggregate_version`, `occurred_at_utc`, `actor`, `correlation_id`, `causation_id`, `idempotency_key` cuando aplique, y referencias sin datos sensibles innecesarios.

| Evento | Productor | Consumidores / efecto |
|---|---|---|
| `EVT-OPS-001 OperacionCreada` | Operaciones | Auditoría, dashboard |
| `EVT-OPS-002 SolicitudEnviada` | Operaciones | Notificación, expiración programada |
| `EVT-OPS-003 AcuerdoAceptado` | Operaciones | Pagos; congelación si `DP-005` lo define |
| `EVT-OPS-004 SolicitudCancelada` | Operaciones | Notificación, cancelar tareas compatibles |
| `EVT-OPS-005 SolicitudExpirada` | Operaciones | Notificación, bloquear nuevos pagos |
| `EVT-PAG-001 IntentoPagoCreado` | Pagos | Operación muestra verificación |
| `EVT-PAG-002 PagoAcreditado` | Pagos | Operación habilita envío si es elegible |
| `EVT-PAG-003 PagoInconsistente` | Pagos | Retención, alerta, revisión excepcional |
| `EVT-ENV-001 EnvioDeclarado` | Logística | Operación, notificación, programar hitos |
| `EVT-ENV-002 TrackingVersionado` | Logística | Timeline, notificación material |
| `EVT-CON-001 RecepcionConformeConfirmada` | Operaciones | Evaluar liberación |
| `EVT-CON-002 GraciaConfirmacionIniciada` | Operaciones | Recordatorios |
| `EVT-DIS-001 ReclamoAbierto` | Disputas | Retención sincrónica, operación en disputa |
| `EVT-DIS-002 EvidenciaPresentada` | Disputas | Timeline, aviso según visibilidad |
| `EVT-DIS-003 ResolucionConfirmada` | Disputas | Finanzas o devolución |
| `EVT-DIS-004 AcuerdoPropuesto` | Disputas | Notificar partes; abrir aceptación de una versión |
| `EVT-DIS-005 AcuerdoAceptadoPorParte` | Disputas | Registrar aceptación sin efecto financiero |
| `EVT-DIS-006 AcuerdoAceptadoMutuamente` | Disputas | Congelar versión y pasar atómicamente a revisión/candidato de resolución |
| `EVT-DIS-007 AcuerdoRevocado` | Disputas | Cerrar versión no aceptada bilateralmente |
| `EVT-DIS-008 AcuerdoExpirado` | Disputas | Cerrar versión por vencimiento sin fallo ni dinero |
| `EVT-DEV-001 DevolucionOrdenada` | Devoluciones | Notificación, plazo de retorno |
| `EVT-DEV-002 DevolucionDespachada` | Devoluciones | Seguimiento, evaluar hito aprobado |
| `EVT-DEV-003 DevolucionRecibida` | Devoluciones | Evaluar reembolso según fallo |
| `EVT-FIN-001 OrdenFinancieraCreada` | Finanzas | Adaptador de proveedor |
| `EVT-FIN-002 OrdenFinancieraConfirmada` | Finanzas | Asientos, cierre de operación |
| `EVT-FIN-003 OrdenFinancieraFallida` | Finanzas | Alerta, reintento/revisión |
| `EVT-FIN-004 PagoTardioDetectado` | Finanzas | Crear revisión financiera ortogonal y hold; operación terminal no cambia |
| `EVT-FIN-005 RevisionFinancieraExcepcionalCerrada` | Finanzas | Registrar decisión/compensación; no reabrir operación terminal |
| `EVT-REP-001 CalificacionPresentada` | Reputación | Publicación diferida |
| `EVT-REP-002 CalificacionPublicada` | Reputación | Recalcular reputación |
| `EVT-POL-001 PoliticaPublicada` | Políticas | Resolver nuevas instantáneas; nunca retroactividad |
| `EVT-RET-001 RetencionAgregada` | Contexto competente | Bloquear acciones definidas |
| `EVT-RET-002 RetencionLevantada` | Contexto competente | Reevaluar, no ejecutar automáticamente sin guarda |

Los eventos se publican mediante patrón outbox dentro de la misma transacción que actualiza el agregado. El consumidor registra `event_id` antes de aplicar efectos para entrega al menos una vez sin duplicación funcional.

### 7.1 Catálogo canónico de estados de operación

Esta tabla es normativa. El estado de dominio es la fuente semántica; el enum API es su representación contractual estable; la UX usa una clave localizable y nunca el enum crudo. Cuando un estado funcional FSD agrupa más de un hecho, se descompone en filas distintas. `06_DATA_AND_API_CONTRACTS.md` DEBE implementar exactamente los valores de la columna API o versionar expresamente el contrato.

| Estado funcional FSD | Estado de dominio `SM-OPS` | Enum API esperado | Clave/etiqueta UX ES de referencia |
|---|---|---|---|
| Borrador | `BORRADOR` | `DRAFT` | `operation.state.draft` — Borrador |
| Pendiente de aceptación/pago | `PENDIENTE_ACEPTACION` | `AWAITING_ACCEPTANCE` | `operation.state.awaiting_acceptance` — Pendiente de aceptación |
| Pendiente de aceptación/pago | `ACEPTADA_PENDIENTE_PAGO` | `ACCEPTED_AWAITING_PAYMENT` | `operation.state.awaiting_payment` — Pendiente de pago |
| Pago en proceso | `PAGO_EN_PROCESO` | `PAYMENT_IN_PROGRESS` | `operation.state.payment_in_progress` — Verificando pago |
| Pagada; pendiente de envío | `PAGADA_PENDIENTE_ENVIO` | `PAID_AWAITING_SHIPMENT` | `operation.state.awaiting_shipment` — Pago confirmado; pendiente de envío |
| Enviada; pendiente de recepción | `ENVIADA_PENDIENTE_RECEPCION` | `SHIPPED_AWAITING_RECEIPT` | `operation.state.awaiting_receipt` — Enviada; pendiente de recepción |
| Confirmación vencida | `CONFIRMACION_VENCIDA` | `CONFIRMATION_OVERDUE` | `operation.state.confirmation_overdue` — Confirmación pendiente |
| En disputa | `EN_DISPUTA` | `IN_DISPUTE` | `operation.state.in_dispute` — En reclamo |
| Devolución requerida | `DEVOLUCION_REQUERIDA` | `RETURN_REQUIRED` | `operation.state.return_required` — Devolución requerida |
| Liberación en proceso | `LIBERACION_EN_PROCESO` | `RELEASE_IN_PROGRESS` | `operation.state.release_in_progress` — Liberación en proceso |
| Reembolso en proceso | `REEMBOLSO_EN_PROCESO` | `REFUND_IN_PROGRESS` | `operation.state.refund_in_progress` — Reembolso en proceso |
| Completada | `COMPLETADA` | `COMPLETED` | `operation.state.completed` — Completada |
| Reembolsada | `REEMBOLSADA` | `REFUNDED` | `operation.state.refunded` — Reembolsada |
| Cancelada | `CANCELADA` | `CANCELLED` | `operation.state.cancelled` — Cancelada |
| Expirada | `EXPIRADA` | `EXPIRED` | `operation.state.expired` — Expirada |
| Revisión excepcional | `REVISION_EXCEPCIONAL` | `EXCEPTION_REVIEW` | `operation.state.exception_review` — En revisión |

Un `LATE_PAYMENT_REVIEW` no reemplaza `CANCELLED`/`EXPIRED`: se muestra como alerta/subproceso adicional. La etiqueta definitiva depende de catálogos ES/pt-BR y validación UX/legal.

### 7.2 Catálogos canónicos de pago y orden financiera

| Concepto | Estado/tipo de dominio | Enum API esperado | Evento canónico cuando aplica |
|---|---|---|---|
| Intento creado | `CREADO` | `CREATED` | `payment.attempt_created.v1` (`EVT-PAG-001`) |
| Espera usuario/proveedor | `PENDIENTE_USUARIO_PROVEEDOR` | `PENDING_USER_PROVIDER` | — |
| Revisión proveedor | `EN_REVISION` | `UNDER_REVIEW` | — |
| Acreditado por conciliar | `ACREDITADO_PENDIENTE_CONCILIACION` | `ACCREDITED_PENDING_RECONCILIATION` | — |
| Acreditado y conciliado | `ACREDITADO` | `ACCREDITED` | `payment.accredited.v1` (`EVT-PAG-002`) |
| Rechazado | `RECHAZADO` | `REJECTED` | — |
| Cancelado | `CANCELADO` | `CANCELLED` | — |
| Expirado | `EXPIRADO` | `EXPIRED` | — |
| Inconsistente | `INCONSISTENTE` | `INCONSISTENT` | `payment.inconsistent.v1` (`EVT-PAG-003`) |
| Tipo liberación | `LIBERACION` | `RELEASE` | `financial_order.created.v1` (`EVT-FIN-001`) |
| Tipo reembolso | `REEMBOLSO` | `REFUND` | `financial_order.created.v1` (`EVT-FIN-001`) |
| Tipo ajuste | `AJUSTE_AUTORIZADO` | `AUTHORIZED_ADJUSTMENT` | `financial_order.created.v1` (`EVT-FIN-001`) |

### 7.3 Catálogo canónico de retenciones

| Tipo de dominio | Enum API esperado | Semántica mínima |
|---|---|---|
| `DISPUTA_ABIERTA` | `DISPUTE_OPEN` | Bloquea liberación ordinaria |
| `RIESGO` | `RISK_REVIEW` | Bloquea acciones declaradas por la retención |
| `CONTRACARGO` | `CHARGEBACK` | Bloquea liberación/cierre según política aprobada |
| `PAGO_INCONSISTENTE` | `PAYMENT_INCONSISTENCY` | Bloquea despacho y movimientos |
| `ORDEN_FINANCIERA_INCIERTA` | `FINANCIAL_ORDER_UNKNOWN` | Bloquea reintento ciego y cierre |
| `INCIDENCIA_ENVIO` | `SHIPMENT_INCIDENT` | Bloquea acciones declaradas |
| `INCIDENCIA_DEVOLUCION` | `RETURN_INCIDENT` | Bloquea ejecución de consecuencia/reembolso |
| `ADMINISTRATIVA` | `ADMINISTRATIVE` | Alcance explícito y motivo obligatorio |
| `CAPACIDAD_PROVEEDOR_NO_VERIFICADA` | `PROVIDER_CAPABILITY_UNVERIFIED` | Bloquea efecto externo no probado |
| `REVISION_PAGO_TARDIO` | `LATE_PAYMENT_REVIEW` | Marca subproceso financiero sin alterar terminalidad |

### 7.4 Correspondencia de eventos

Los IDs `EVT-*` son referencias documentales; `event_type` es el valor técnico. `06` debe implementar estos valores, o introducir una nueva versión contractual explícita sin traducciones implícitas:

| ID documental | `event_type` técnico |
|---|---|
| `EVT-OPS-001` | `operation.created.v1` |
| `EVT-OPS-002` | `operation.request_sent.v1` |
| `EVT-OPS-003` | `operation.agreement_accepted.v1` |
| `EVT-OPS-004` | `operation.cancelled.v1` |
| `EVT-OPS-005` | `operation.expired.v1` |
| `EVT-PAG-001` | `payment.attempt_created.v1` |
| `EVT-PAG-002` | `payment.accredited.v1` |
| `EVT-PAG-003` | `payment.inconsistent.v1` |
| `EVT-ENV-001` | `shipment.declared.v1` |
| `EVT-ENV-002` | `shipment.tracking_versioned.v1` |
| `EVT-CON-001` | `operation.receipt_confirmed.v1` |
| `EVT-CON-002` | `operation.confirmation_grace_started.v1` |
| `EVT-DIS-001` | `dispute.opened.v1` |
| `EVT-DIS-002` | `dispute.evidence_submitted.v1` |
| `EVT-DIS-003` | `dispute.resolution_confirmed.v1` |
| `EVT-DIS-004` | `dispute.settlement_proposed.v1` |
| `EVT-DIS-005` | `dispute.settlement_accepted_by_party.v1` |
| `EVT-DIS-006` | `dispute.settlement_mutually_accepted.v1` |
| `EVT-DIS-007` | `dispute.settlement_revoked.v1` |
| `EVT-DIS-008` | `dispute.settlement_expired.v1` |
| `EVT-DEV-001` | `return.ordered.v1` |
| `EVT-DEV-002` | `return.dispatched.v1` |
| `EVT-DEV-003` | `return.received.v1` |
| `EVT-FIN-001` | `financial_order.created.v1` |
| `EVT-FIN-002` | `financial_order.confirmed.v1` |
| `EVT-FIN-003` | `financial_order.failed.v1` |
| `EVT-FIN-004` | `financial_review.late_payment_detected.v1` |
| `EVT-FIN-005` | `financial_review.exception_closed.v1` |
| `EVT-REP-001` | `rating.submitted.v1` |
| `EVT-REP-002` | `rating.published.v1` |
| `EVT-POL-001` | `policy.published.v1` |
| `EVT-RET-001` | `hold.added.v1` |
| `EVT-RET-002` | `hold.released.v1` |

## 8. Composición de estado de una operación

Para evitar una máquina cartesiana imposible de mantener, el estado visible se deriva de máquinas ortogonales:

- ciclo de solicitud/operación (`SM-OPS`);
- pago (`SM-PAG`);
- envío (`SM-ENV`);
- disputa (`SM-DIS`);
- propuesta de acuerdo bilateral (`SM-SET`);
- devolución (`SM-DEV`);
- orden financiera (`SM-FIN`);
- revisión financiera excepcional (`SM-FRE`);
- calificación (`SM-REP`);
- política (`SM-POL`).

La proyección `estado_visible` no es una segunda verdad. Para operaciones no terminales, prioridad de proyección:

1. `REVISIÓN_EXCEPCIONAL` si existe anomalía bloqueante no resuelta;
2. `EN_DISPUTA` o `DEVOLUCIÓN_REQUERIDA` si esos subprocesos están activos;
3. `LIBERACIÓN_EN_PROCESO` / `REEMBOLSO_EN_PROCESO` si existe orden activa;
4. terminal financiero confirmado (`COMPLETADA` / `REEMBOLSADA`);
5. ciclo operativo vigente.

Si `SM-OPS` ya está en `CANCELADA` o `EXPIRADA`, un `SM-FRE` activo no sustituye el terminal: la API/UX expone el estado terminal más `financial_exception_review.status` y una alerta/acción administrativa separada. `COMPLETADA` y `REEMBOLSADA` tampoco se reabren; cualquier corrección es compensatoria.

## 9. `SM-OPS` — Solicitud y operación

### 9.1 Estados

`BORRADOR`, `PENDIENTE_ACEPTACION`, `ACEPTADA_PENDIENTE_PAGO`, `PAGO_EN_PROCESO`, `PAGADA_PENDIENTE_ENVIO`, `ENVIADA_PENDIENTE_RECEPCION`, `CONFIRMACION_VENCIDA`, `EN_DISPUTA`, `DEVOLUCION_REQUERIDA`, `LIBERACION_EN_PROCESO`, `REEMBOLSO_EN_PROCESO`, `COMPLETADA`, `REEMBOLSADA`, `CANCELADA`, `EXPIRADA`, `REVISION_EXCEPCIONAL`.

Terminales ordinarios: `COMPLETADA`, `REEMBOLSADA`, `CANCELADA`, `EXPIRADA`. `REVISION_EXCEPCIONAL` no es terminal: exige resolución operativa explícita.

### 9.2 Transiciones

| ID | Desde → hacia | Actor / comando | Guardas | Efectos atómicos | Error principal |
|---|---|---|---|---|---|
| `TR-OPS-001` | ∅ → `BORRADOR` | Vendedor / crear | Participantes distintos; país/moneda y monto sintácticamente válidos | Crear ID interno y legible; versión 1; evento | `ERR-OPS-001 DATOS_INVALIDOS` |
| `TR-OPS-002` | `BORRADOR` → `PENDIENTE_ACEPTACION` | Vendedor / enviar | Elegibilidad completa; desglose válido; textos legales; política resoluble | Sellar versión de solicitud, programar expiración, notificar | `ERR-OPS-002 COMBINACION_NO_HABILITADA` |
| `TR-OPS-003` | `PENDIENTE_ACEPTACION` → `ACEPTADA_PENDIENTE_PAGO` | Comprador / aceptar | Invitado correcto; vigente; consentimientos; versión coincide | Registrar aceptación y política según `DP-005` | `ERR-OPS-003 SOLICITUD_NO_VIGENTE` |
| `TR-OPS-004` | `ACEPTADA_PENDIENTE_PAGO` → `PAGO_EN_PROCESO` | Comprador/sistema / iniciar intento | Sin pago acreditado ni intento incompatible | Referenciar intento idempotente | `ERR-PAG-001 INTENTO_INCOMPATIBLE` |
| `TR-OPS-005` | `PAGO_EN_PROCESO` → `ACEPTADA_PENDIENTE_PAGO` | Sistema / intento terminal no acreditado | No hay otro intento pendiente/acreditado | Proyectar resultado, permitir reintento si vigente | `ERR-OPS-004 ESTADO_DESACTUALIZADO` |
| `TR-OPS-006` | `PAGO_EN_PROCESO` o `ACEPTADA_PENDIENTE_PAGO` → `PAGADA_PENDIENTE_ENVIO` | Sistema / aplicar pago acreditado | `EVT-PAG-002`; conciliado; coincidencias; no expirada/cancelada | Congelar política si aplica; notificar vendedor | `ERR-PAG-002 PAGO_NO_CONCILIADO` |
| `TR-OPS-007` | `PENDIENTE_ACEPTACION` → `CANCELADA` | Vendedor/admin excepcional / cancelar | Sin pago en proceso o acreditado; admin con motivo | Cancelar tareas; auditoría; notificar | `ERR-OPS-005 CANCELACION_NO_PERMITIDA` |
| `TR-OPS-008` | `PENDIENTE_ACEPTACION` o `ACEPTADA_PENDIENTE_PAGO` → `EXPIRADA` | Sistema / vencer | Reloj ≥ vencimiento; sin pago válido; reevaluación con bloqueo | Evento y bloqueo de nuevos intentos | `ERR-OPS-006 AUN_VIGENTE` |
| `TR-OPS-009` | `PAGADA_PENDIENTE_ENVIO` → `ENVIADA_PENDIENTE_RECEPCION` | Vendedor / declarar despacho | `SM-ENV=DECLARADO`; sin retención; plazo/política válidos | Calcular hitos; notificar; programar | `ERR-ENV-001 ENVIO_INCOMPLETO` |
| `TR-OPS-010` | `ENVIADA_PENDIENTE_RECEPCION` → `CONFIRMACION_VENCIDA` | Sistema / iniciar gracia | Hito alcanzado; sin confirmación/reclamo/retención bloqueante | Registrar hito y programar recordatorios | `ERR-CON-001 HITO_NO_ALCANZADO` |
| `TR-OPS-011` | `ENVIADA_PENDIENTE_RECEPCION` o `CONFIRMACION_VENCIDA` → `LIBERACION_EN_PROCESO` | Comprador/sistema / confirmar o vencer | Guardas completas de liberación; mismo control que reclamo | Registrar causa; crear una orden `LIBERACION` | `ERR-FIN-001 LIBERACION_BLOQUEADA` |
| `TR-OPS-012` | Estados preliberación válidos → `EN_DISPUTA` | Comprador / abrir reclamo | Elegible y antes del límite; ninguna liberación irreversible | Crear disputa + retención en una transacción | `ERR-DIS-001 RECLAMO_NO_ELEGIBLE` |
| `TR-OPS-013` | `EN_DISPUTA` → `LIBERACION_EN_PROCESO` | Sistema / aplicar resolución | Fallo confirmado “liberar”; aprobaciones completas | Cerrar retención pertinente; crear orden única | `ERR-DIS-002 RESOLUCION_INCOMPLETA` |
| `TR-OPS-014` | `EN_DISPUTA` → `REEMBOLSO_EN_PROCESO` | Sistema / aplicar resolución | Fallo confirmado “reembolsar sin devolución” | Crear orden única conforme desglose | `ERR-FIN-002 DESGLOSE_NO_RESUELTO` |
| `TR-OPS-015` | `EN_DISPUTA` → `DEVOLUCION_REQUERIDA` | Sistema / aplicar resolución | Fallo confirmado con instrucciones completas | Crear `AGG-DEVOLUCION`; mantener retención | `ERR-DEV-001 INSTRUCCIONES_INCOMPLETAS` |
| `TR-OPS-016` | `DEVOLUCION_REQUERIDA` → `REEMBOLSO_EN_PROCESO` | Sistema/admin / cumplir fallo | Hito escrito cumplido; sin incidencia/retención | Crear orden conforme resolución | `ERR-DEV-002 HITO_NO_CUMPLIDO` |
| `TR-OPS-017` | `DEVOLUCION_REQUERIDA` → `LIBERACION_EN_PROCESO` | Sistema/admin / consecuencia escrita | Incumplimiento y consecuencia expresamente autorizada | Crear orden; no inferir consecuencia | `ERR-DEV-003 CONSECUENCIA_NO_DEFINIDA` |
| `TR-OPS-018` | `LIBERACION_EN_PROCESO` → `COMPLETADA` | Sistema / confirmar orden | Orden reconciliada `CONFIRMADA`; libro balanceado | Cierre financiero; habilitar reputación según política | `ERR-FIN-003 MOVIMIENTO_NO_CONFIRMADO` |
| `TR-OPS-019` | `REEMBOLSO_EN_PROCESO` → `REEMBOLSADA` | Sistema / confirmar orden | Orden reconciliada `CONFIRMADA`; libro balanceado | Cierre financiero; elegibilidad reputación según política | `ERR-FIN-003 MOVIMIENTO_NO_CONFIRMADO` |
| `TR-OPS-020` | Estado no terminal → `REVISION_EXCEPCIONAL` | Sistema/admin / bloquear anomalía | Causa estructurada y retención; motivo para admin | Preservar subestado previo, alertar, auditar | `ERR-OPS-007 CAUSA_EXCEPCIONAL_INVALIDA` |
| `TR-OPS-021` | `REVISION_EXCEPCIONAL` → estado previo compatible | Admin/sistema / resolver anomalía | Evidencia de resolución; retenciones reevaluadas | Evento correctivo, nunca borrar historial | `ERR-OPS-008 ANOMALIA_NO_RESUELTA` |

`TR-OPS-020/021` solo aplican mientras `SM-OPS` no sea terminal. Un pago tardío sobre `CANCELADA` o `EXPIRADA` no ejecuta ninguna `TR-OPS-*`: conserva el terminal y activa `SM-FRE` según §17.1. No habilita despacho ni altera la elegibilidad histórica.

## 10. `SM-PAG` — Intento de pago

Estados: `CREADO`, `PENDIENTE_USUARIO_PROVEEDOR`, `EN_REVISION`, `ACREDITADO_PENDIENTE_CONCILIACION`, `ACREDITADO`, `RECHAZADO`, `CANCELADO`, `EXPIRADO`, `INCONSISTENTE`. Terminales del intento: `ACREDITADO`, `RECHAZADO`, `CANCELADO`, `EXPIRADO`, `INCONSISTENTE`; una conciliación puede corregir mediante evento explícito, nunca degradar silenciosamente.

| ID | Desde → hacia | Actor / entrada | Guardas y efectos | Error |
|---|---|---|---|---|
| `TR-PAG-001` | ∅ → `CREADO` | Sistema / crear intento | Solicitud aceptada/vigente; idempotencia; proveedor habilitado; registrar intención antes de llamada | `ERR-PAG-003 CAPACIDAD_NO_VERIFICADA` |
| `TR-PAG-002` | `CREADO` → `PENDIENTE_USUARIO_PROVEEDOR` | Adaptador / creación aceptada | Referencia externa única; respuesta no acredita | `ERR-PAG-004 REFERENCIA_INVALIDA` |
| `TR-PAG-003` | `PENDIENTE_*` → `EN_REVISION` | Webhook/consulta | Evento auténtico mapeado a revisión; conservar original | `ERR-PAG-005 WEBHOOK_NO_AUTENTICO` |
| `TR-PAG-004` | `PENDIENTE_*` o `EN_REVISION` → `ACREDITADO_PENDIENTE_CONCILIACION` | Webhook/consulta | Señal auténtica de aprobación; no basta retorno | `ERR-PAG-006 EVENTO_NO_CONFIABLE` |
| `TR-PAG-005` | `ACREDITADO_PENDIENTE_CONCILIACION` → `ACREDITADO` | Conciliador | Monto, moneda, operación, cuenta y unicidad coinciden; asientos registrados | `ERR-PAG-007 CONCILIACION_DIFIERE` |
| `TR-PAG-006` | Estado no terminal → `RECHAZADO` | Webhook/consulta | Estado externo terminal verificado; no hay acreditación posterior confirmada | `ERR-PAG-008 EVENTO_REGRESIVO` |
| `TR-PAG-007` | Estado no terminal → `CANCELADO` | Webhook/consulta/comando permitido | Cancelación real confirmada; conservar origen | `ERR-PAG-009 CANCELACION_NO_CONFIRMADA` |
| `TR-PAG-008` | Estado no terminal → `EXPIRADO` | Sistema/proveedor | Vencimiento y consulta sin acreditación | `ERR-PAG-010 INTENTO_AUN_ACTIVO` |
| `TR-PAG-009` | Cualquier no terminal → `INCONSISTENTE` | Conciliador | Diferencia, duplicado acreditado o evento imposible; retención + alerta | `ERR-PAG-011 INCONSISTENCIA` |

Webhooks duplicados devuelven éxito técnico sin repetir efectos. Eventos fuera de orden se conservan y se ignoran si implican degradar un hecho confirmado sin regla expresa.

## 11. `SM-ENV` — Envío

Estados: `NO_INICIADO`, `BORRADOR`, `DECLARADO`, `EN_SEGUIMIENTO`, `ENTREGA_REPORTADA`, `INCIDENCIA`, `CERRADO`. `CERRADO` es terminal del subproceso, no de la operación.

| ID | Desde → hacia | Actor | Guardas | Efectos / error |
|---|---|---|---|---|
| `TR-ENV-001` | `NO_INICIADO` → `BORRADOR` | Vendedor | Pago acreditado y conciliado; autorizado | Guardar campos/adjuntos parciales / `ERR-ENV-002 PAGO_NO_HABILITA` |
| `TR-ENV-002` | `BORRADOR` o `NO_INICIADO` → `DECLARADO` | Vendedor | Evidencia segura; datos obligatorios; plazo válido; modalidad habilitada | Sellar declaración, hashes y versiones / `ERR-ENV-001 ENVIO_INCOMPLETO` |
| `TR-ENV-003` | `DECLARADO` → `EN_SEGUIMIENTO` | Sistema | Declaración aplicada a operación; hitos calculados | Programar seguimiento / `ERR-ENV-003 HITOS_NO_RESUELTOS` |
| `TR-ENV-004` | `DECLARADO` o `EN_SEGUIMIENTO` → mismo estado | Vendedor/admin autorizado | Corrección permitida y material identificada | Agregar versión, auditar y notificar / `ERR-ENV-004 CORRECCION_NO_PERMITIDA` |
| `TR-ENV-005` | `EN_SEGUIMIENTO` → `ENTREGA_REPORTADA` | Proveedor logístico/sistema | Señal atribuible; no se trata como confirmación del comprador | Registrar evento original / `ERR-ENV-005 SENAL_NO_CONFIABLE` |
| `TR-ENV-006` | Estado activo → `INCIDENCIA` | Parte/sistema/admin | Causa estructurada | Retención si corresponde y revisión / `ERR-ENV-006 INCIDENCIA_INVALIDA` |
| `TR-ENV-007` | `INCIDENCIA` → estado previo compatible | Admin/sistema | Incidencia resuelta con evidencia | Evento correctivo / `ERR-ENV-007 INCIDENCIA_ABIERTA` |
| `TR-ENV-008` | Estado declarado/seguimiento/entrega → `CERRADO` | Sistema | Operación terminal y sin tareas logísticas pendientes | Cancelar tareas compatibles / `ERR-ENV-008 OPERACION_NO_TERMINAL` |

El vencimiento de despacho y su consecuencia no se modelan como transición automática hasta resolver `DP-008`; el motor solo emite `DespachoVencido` y bloquea/escala según política aprobada.

## 12. `SM-DIS` — Disputa

Estados: `NO_EXISTE`, `ABIERTA`, `ESPERANDO_RESPUESTA`, `RECOPILANDO_EVIDENCIA`, `EN_REVISION`, `ESPERANDO_INFORMACION`, `PROPUESTA_RESOLUCION`, `PENDIENTE_SEGUNDA_APROBACION`, `RESUELTA_LIBERAR`, `RESUELTA_REEMBOLSAR`, `RESUELTA_DEVOLVER`, `RESUELTA_ACUERDO`, `CORRECCION_EXCEPCIONAL`. Los cuatro `RESUELTA_*` son terminales ordinarios; la corrección excepcional referencia el fallo anterior.

| ID | Desde → hacia | Actor / comando | Guardas | Efectos / error |
|---|---|---|---|---|
| `TR-DIS-001` | `NO_EXISTE` → `ABIERTA` | Comprador / abrir | Motivo; evidencia mínima; aceptación de costo si aplica; elegibilidad temporal y financiera | Crear disputa y retención atómicamente / `ERR-DIS-001 RECLAMO_NO_ELEGIBLE` |
| `TR-DIS-002` | `ABIERTA` → `ESPERANDO_RESPUESTA` | Sistema | Notificación preparada; plazo proviene de política | Registrar vencimiento / `ERR-DIS-003 PLAZO_NO_CONFIGURADO` |
| `TR-DIS-003` | `ESPERANDO_RESPUESTA` → `RECOPILANDO_EVIDENCIA` | Vendedor | Respuesta válida dentro de reglas | Preservar alegación y adjuntos / `ERR-DIS-004 RESPUESTA_INVALIDA` |
| `TR-DIS-004` | Estados de evidencia → mismo/`RECOPILANDO_EVIDENCIA` | Parte autorizada | Ventana abierta; archivo seguro; visibilidad definida | Agregar evidencia, nunca reemplazar / `ERR-DIS-005 VENTANA_CERRADA` |
| `TR-DIS-005` | `RECOPILANDO_EVIDENCIA` o espera vencida → `EN_REVISION` | Admin/sistema | Expediente asignable; revisor autorizado | Asignar y registrar conflicto declarado / `ERR-DIS-006 REVISOR_NO_ELEGIBLE` |
| `TR-DIS-006` | `EN_REVISION` → `ESPERANDO_INFORMACION` | Admin | Solicitud fundada, destinatario y vencimiento | Notificar y pausar decisión según política / `ERR-DIS-007 SOLICITUD_INCOMPLETA` |
| `TR-DIS-007` | `ESPERANDO_INFORMACION` → `EN_REVISION` | Parte/sistema | Respuesta recibida o plazo vencido; consecuencia explícita | Cerrar solicitud, conservar silencio como hecho / `ERR-DIS-008 SOLICITUD_AUN_ABIERTA` |
| `TR-DIS-008` | `EN_REVISION` → `PROPUESTA_RESOLUCION` | Admin revisor | Sin conflicto; expediente revisado; resultado permitido; desglose completo | Crear propuesta inmutable versionada / `ERR-DIS-002 RESOLUCION_INCOMPLETA` |
| `TR-DIS-009` | `PROPUESTA_RESOLUCION` → `PENDIENTE_SEGUNDA_APROBACION` | Admin | Umbral/regla exige doble control | Bloquear ejecución / `ERR-DIS-009 APROBACION_REQUERIDA` |
| `TR-DIS-010` | `PROPUESTA_RESOLUCION` → `RESUELTA_*` | Admin | No requiere segunda aprobación; confirmación reciente; compatibilidad financiera/proveedor | Sellar fallo y emitir evento / `ERR-DIS-010 MOVIMIENTO_NO_SOPORTADO` |
| `TR-DIS-011` | `PENDIENTE_SEGUNDA_APROBACION` → `RESUELTA_*` | Segundo admin | Persona distinta, sin conflicto, permiso y propuesta intacta | Registrar aprobación y sellar / `ERR-DIS-011 APROBADOR_INVALIDO` |
| `TR-DIS-012` | `PENDIENTE_SEGUNDA_APROBACION` → `EN_REVISION` | Segundo admin | Rechazo motivado | Nueva versión; no editar propuesta / `ERR-DIS-012 RECHAZO_SIN_MOTIVO` |
| `TR-DIS-013` | `RESUELTA_*` → `CORRECCION_EXCEPCIONAL` | Admin autorizado | Base jurídica/operativa y autorización; `DP-014` no habilita apelación por omisión | Evento compensatorio, conserva fallo / `ERR-DIS-013 CORRECCION_NO_AUTORIZADA` |
| `TR-DIS-014` | Estado activo pre-resolución → `EN_REVISION` | Sistema / aplicar aceptación bilateral | Segunda aceptación válida del mismo `proposal_id/version/hash`; no revocada/expirada | En la misma transacción de la segunda aceptación congelar propuesta, crear candidato de resolución `ACUERDO`, registrar revisión requerida; no crear orden financiera / `ERR-DIS-014 ACUERDO_NO_ACEPTADO_BILATERALMENTE` |

Resultados admitidos no implican que el proveedor soporte todos los movimientos. Si la capacidad no está verificada, la resolución no se confirma como ejecutable; queda en propuesta/revisión.

### 12.1 `SM-SET` — Propuesta de acuerdo bilateral (`settlement_proposal`)

`SettlementProposal` pertenece a una disputa y contiene `proposal_id`, `version`, autor, explicación compartible, asignación completa de componentes financieros, requisitos no financieros, `expires_at`, política y hash canónico. Estados persistentes: `BORRADOR`, `ABIERTA`, `ACEPTADA_PARCIALMENTE`, `ENVIADA_A_REVISION`, `INCORPORADA_EN_RESOLUCION`, `REVOCADA`, `EXPIRADA`. `INCORPORADA_EN_RESOLUCION`, `REVOCADA` y `EXPIRADA` son terminales de esa versión. `AcuerdoAceptadoMutuamente` es un hecho/evento registrado dentro de la transición atómica a `ENVIADA_A_REVISION`, no un estado estable que pueda quedar sin revisión.

| ID | Desde → hacia | Actor / comando | Guardas | Efectos / error |
|---|---|---|---|---|
| `TR-SET-001` | ∅ → `BORRADOR` | Comprador, vendedor o admin facilitador / crear | Disputa activa; actor autorizado; no existe otra propuesta abierta incompatible | Crear versión con asignación explícita / `ERR-SET-001 PROPUESTA_INVALIDA` |
| `TR-SET-002` | `BORRADOR` → `ABIERTA` | Autor / publicar | Desglose completo; fecha futura; política; versión/hash sellados | Notificar partes; abrir aceptaciones / `ERR-SET-002 PROPUESTA_INCOMPLETA` |
| `TR-SET-003` | `ABIERTA` → `ACEPTADA_PARCIALMENTE` | Comprador o vendedor / aceptar | Parte de la disputa; versión/hash vigentes; autenticación e idempotencia; no expiró | Crear `SettlementAcceptance` inmutable para esa parte; ningún efecto financiero / `ERR-SET-003 VERSION_NO_VIGENTE` |
| `TR-SET-004` | `ACEPTADA_PARCIALMENTE` → `ENVIADA_A_REVISION` | La otra parte / aceptar | Exactamente la misma versión/hash; aceptación previa de la contraparte; no revocada/expirada | En una transacción registrar segunda aceptación, emitir `EVT-DIS-006`, congelar propuesta, ejecutar `TR-DIS-014` y crear candidato de resolución; no mover dinero / `ERR-SET-004 ACEPTACION_INCOMPATIBLE` |
| `TR-SET-005` | `ABIERTA` o `ACEPTADA_PARCIALMENTE` → `REVOCADA` | Autor o parte facultada por política / revocar | Aún no hay doble aceptación; motivo; versión coincide | Invalidar ventana; conservar aceptación parcial / `ERR-SET-005 YA_ACEPTADA_MUTUAMENTE` |
| `TR-SET-006` | `ABIERTA` o `ACEPTADA_PARCIALMENTE` → `EXPIRADA` | Sistema / vencer | Reloj del servidor ≥ `expires_at`; no doble aceptación | Cerrar versión sin resolver ni mover dinero / `ERR-SET-006 AUN_VIGENTE` |
| `TR-SET-008` | `ENVIADA_A_REVISION` → `INCORPORADA_EN_RESOLUCION` | Admin autorizado | Controles, saldo, capacidades, conflicto, aprobaciones y desglose válidos | Confirmar `RESUELTA_ACUERDO` mediante `TR-DIS-010/011`; luego el flujo financiero ordinario / `ERR-SET-008 ACUERDO_NO_EJECUTABLE` |

Editar cualquier campo material crea una nueva versión `BORRADOR`; ninguna aceptación se arrastra. Aceptar la pretensión del comprador por parte del vendedor se modela como aceptación de una versión de `SettlementProposal`, no como resolución ni reembolso unilateral. Si la propuesta bilateral no puede expresarse mediante resultados/movimientos soportados, permanece en revisión.

## 13. `SM-DEV` — Devolución

Estados: `INSTRUCCIONES_EMITIDAS`, `PREPARACION`, `DESPACHADA`, `EN_TRANSITO`, `RECIBIDA_PENDIENTE_CONFIRMACION`, `RECIBIDA_CONFORME`, `INCIDENCIA`, `INCUMPLIDA_COMPRADOR`, `CERRADA_REEMBOLSO`, `CERRADA_CONSECUENCIA`. Los dos `CERRADA_*` son terminales.

| ID | Desde → hacia | Actor | Guardas | Efectos / error |
|---|---|---|---|---|
| `TR-DEV-001` | ∅ → `INSTRUCCIONES_EMITIDAS` | Sistema | Resolución `RESUELTA_DEVOLVER`; todos los elementos obligatorios escritos | Crear plazo e instrucciones / `ERR-DEV-001 INSTRUCCIONES_INCOMPLETAS` |
| `TR-DEV-002` | `INSTRUCCIONES_EMITIDAS` → `PREPARACION` | Comprador | Acepta/verifica instrucciones | Permitir borrador de evidencia / `ERR-DEV-004 DEVOLUCION_NO_AUTORIZADA` |
| `TR-DEV-003` | `PREPARACION` o instrucciones → `DESPACHADA` | Comprador | En plazo; tracking/evidencia/modalidad válidos | Sellar despacho y notificar / `ERR-DEV-005 DESPACHO_INCOMPLETO` |
| `TR-DEV-004` | `DESPACHADA` → `EN_TRANSITO` | Sistema | Seguimiento iniciado | Programar hitos / `ERR-DEV-006 SEGUIMIENTO_NO_DISPONIBLE` |
| `TR-DEV-005` | `DESPACHADA` o `EN_TRANSITO` → `RECIBIDA_PENDIENTE_CONFIRMACION` | Sistema/vendedor | Señal de recepción atribuible | Abrir ventana al vendedor; no reembolsar salvo hito escrito / `ERR-DEV-007 RECEPCION_NO_VERIFICABLE` |
| `TR-DEV-006` | `RECIBIDA_PENDIENTE_CONFIRMACION` → `RECIBIDA_CONFORME` | Vendedor | Confirmación autorizada y en plazo | Emitir hito; evaluar fallo / `ERR-DEV-008 CONFIRMACION_INVALIDA` |
| `TR-DEV-007` | Estado activo → `INCIDENCIA` | Parte/admin/sistema | Motivo + evidencia requerida | Pausar ejecución y retener / `ERR-DEV-009 INCIDENCIA_INCOMPLETA` |
| `TR-DEV-008` | `INCIDENCIA` → estado compatible | Admin | Decisión motivada dentro del fallo/política | Levantar retención y evento / `ERR-DEV-010 INCIDENCIA_NO_RESUELTA` |
| `TR-DEV-009` | Instrucciones/preparación → `INCUMPLIDA_COMPRADOR` | Sistema/admin | Plazo vencido; sin despacho válido; reevaluación | Aplicar solo consecuencia escrita / `ERR-DEV-003 CONSECUENCIA_NO_DEFINIDA` |
| `TR-DEV-010` | Estado cuyo hito autoriza reembolso → `CERRADA_REEMBOLSO` | Sistema | Hito `DP-016` explicitado y cumplido; orden creada | Vincular orden / `ERR-DEV-002 HITO_NO_CUMPLIDO` |
| `TR-DEV-011` | `INCUMPLIDA_COMPRADOR` → `CERRADA_CONSECUENCIA` | Sistema/admin | Consecuencia del fallo ejecutada/confirmada | Cerrar / `ERR-DEV-003 CONSECUENCIA_NO_DEFINIDA` |

El silencio del vendedor solo produce el efecto congelado en la resolución; no equivale universalmente a recepción conforme.

## 14. `SM-FIN` — Liberación y reembolso

Cada orden tiene `tipo ∈ {LIBERACION, REEMBOLSO, AJUSTE_AUTORIZADO}`. Estados: `INTENCION_REGISTRADA`, `LISTA_PARA_ENVIAR`, `ENVIADA`, `RESULTADO_DESCONOCIDO`, `PENDIENTE_CONFIRMACION`, `CONFIRMADA`, `RECHAZADA`, `FALLIDA_REINTENTABLE`, `REVISION_MANUAL`, `CANCELADA_ANTES_ENVIO`. Terminales: `CONFIRMADA`, `RECHAZADA`, `CANCELADA_ANTES_ENVIO`; `REVISION_MANUAL` no es éxito ni terminal financiero.

| ID | Desde → hacia | Actor | Guardas | Efectos / error |
|---|---|---|---|---|
| `TR-FIN-001` | ∅ → `INTENCION_REGISTRADA` | Sistema | Causa válida; saldo; desglose; retenciones; unicidad | Reservar saldo lógico e idempotencia / `ERR-FIN-004 ORDEN_DUPLICADA` |
| `TR-FIN-002` | `INTENCION_REGISTRADA` → `LISTA_PARA_ENVIAR` | Sistema | Capacidad verificada; aprobaciones completas; destino funcional | Outbox / `ERR-FIN-005 CAPACIDAD_NO_VERIFICADA` |
| `TR-FIN-003` | `LISTA_PARA_ENVIAR` → `ENVIADA` | Adaptador | Solicitud idempotente aceptada técnicamente | Guardar referencia externa / `ERR-FIN-006 ENVIO_RECHAZADO` |
| `TR-FIN-004` | `ENVIADA` → `PENDIENTE_CONFIRMACION` | Adaptador/webhook | Resultado provisional conocido | Programar conciliación / `ERR-FIN-007 RESPUESTA_INVALIDA` |
| `TR-FIN-005` | `ENVIADA` → `RESULTADO_DESCONOCIDO` | Adaptador | Timeout/corte tras posible recepción | Prohibir reenvío ciego; consultar / `ERR-FIN-008 RESULTADO_DESCONOCIDO` |
| `TR-FIN-006` | `RESULTADO_DESCONOCIDO` → `PENDIENTE_CONFIRMACION` | Conciliador | Consulta correlaciona orden existente | Registrar observación / `ERR-FIN-009 NO_CORRELACIONADO` |
| `TR-FIN-007` | `PENDIENTE_CONFIRMACION` o `RESULTADO_DESCONOCIDO` → `CONFIRMADA` | Webhook/conciliador | Autenticidad; monto/moneda/destino; asiento y saldo reconciliados | Confirmar una vez, emitir cierre / `ERR-FIN-003 MOVIMIENTO_NO_CONFIRMADO` |
| `TR-FIN-008` | Estado preterminal → `RECHAZADA` | Webhook/conciliador | Rechazo terminal verificado | Liberar reserva lógica; alertar / `ERR-FIN-010 RECHAZO_NO_VERIFICADO` |
| `TR-FIN-009` | Estado enviable → `FALLIDA_REINTENTABLE` | Sistema | Error clasificado temporal y no ambiguo | Backoff con límite / `ERR-FIN-011 ERROR_NO_REINTENTABLE` |
| `TR-FIN-010` | `FALLIDA_REINTENTABLE` → `LISTA_PARA_ENVIAR` | Sistema | Ventana de retry; misma idempotencia; reevaluación completa | Incrementar intento / `ERR-FIN-012 REINTENTO_NO_ELEGIBLE` |
| `TR-FIN-011` | Estado no confirmado → `REVISION_MANUAL` | Sistema | Inconsistencia o reintentos agotados | Retención + alerta / `ERR-FIN-013 REVISION_REQUERIDA` |
| `TR-FIN-012` | `INTENCION_REGISTRADA` → `CANCELADA_ANTES_ENVIO` | Sistema/admin | No enviada; causa dejó de ser válida | Liberar reserva; auditar / `ERR-FIN-014 YA_ENVIADA` |

Una orden confirmada no se “revierte” cambiando su estado. Cualquier compensación es una nueva orden autorizada, ligada causalmente a la original.

## 15. `SM-REP` — Calificación y publicación

Estados: `NO_ELEGIBLE`, `ELEGIBLE`, `BORRADOR`, `PRESENTADA_OCULTA`, `PUBLICABLE`, `PUBLICADA`, `RECHAZADA_CALIDAD`, `VENTANA_VENCIDA`, `OCULTA_MODERACION`, `CORREGIDA_EXCEPCIONAL`. Terminales funcionales: `PUBLICADA`, `VENTANA_VENCIDA`; moderación puede ocultar una publicada sin borrar original.

| ID | Desde → hacia | Actor | Guardas | Efectos / error |
|---|---|---|---|---|
| `TR-REP-001` | `NO_ELEGIBLE` → `ELEGIBLE` | Sistema | Operación terminal incluida por política `DP-017`; autor participante | Abrir ventana / `ERR-REP-001 OPERACION_NO_ELEGIBLE` |
| `TR-REP-002` | `ELEGIBLE` → `BORRADOR` | Parte | No existe calificación previa del mismo rol | Guardar local/servidor según diseño / `ERR-REP-002 CALIFICACION_DUPLICADA` |
| `TR-REP-003` | `ELEGIBLE` o `BORRADOR` → `RECHAZADA_CALIDAD` | Parte/sistema | Falla control objetivo | Explicar regla y permitir corregir / `ERR-REP-003 COMENTARIO_INVALIDO` |
| `TR-REP-004` | Estado editable → `PRESENTADA_OCULTA` | Parte | Escala aprobada; comentario válido; dentro de ventana; no autocalificación | Sellar evaluación / `ERR-REP-004 POLITICA_NO_APROBADA` |
| `TR-REP-005` | `PRESENTADA_OCULTA` → `PUBLICABLE` | Sistema | Ambas partes presentaron o venció ventana ciega conforme `DP-017` | Evitar revelación prematura / `ERR-REP-005 VENTANA_CIEGA_ACTIVA` |
| `TR-REP-006` | `PUBLICABLE` → `PUBLICADA` | Sistema | Moderación automática/operativa permite; umbrales de privacidad | Publicar y recalcular proyección / `ERR-REP-006 PUBLICACION_BLOQUEADA` |
| `TR-REP-007` | `ELEGIBLE`/borrador → `VENTANA_VENCIDA` | Sistema | Vencimiento aprobado; no presentada | Cerrar derecho ordinario / `ERR-REP-007 VENTANA_AUN_ABIERTA` |
| `TR-REP-008` | `PUBLICADA` → `OCULTA_MODERACION` | Moderador | Motivo y permiso; `DP-018` | Ocultar público, conservar original / `ERR-REP-008 MODERACION_NO_AUTORIZADA` |
| `TR-REP-009` | `PUBLICADA` u `OCULTA_MODERACION` → `CORREGIDA_EXCEPCIONAL` | Moderador autorizado | Flujo auditado; no edición libre | Crear versión/evento; recalcular / `ERR-REP-009 CORRECCION_NO_AUTORIZADA` |

## 16. `SM-POL` — Política versionada

Estados: `BORRADOR`, `VALIDADA`, `PENDIENTE_APROBACION`, `PROGRAMADA`, `ACTIVA`, `REEMPLAZADA`, `RETIRADA`. `REEMPLAZADA` y `RETIRADA` son terminales para selección futura, no para referencias históricas.

| ID | Desde → hacia | Actor | Guardas | Efectos / error |
|---|---|---|---|---|
| `TR-POL-001` | ∅ → `BORRADOR` | Admin sistema | Ámbito permitido; autor y motivo | Crear versión / `ERR-POL-001 AMBITO_INVALIDO` |
| `TR-POL-002` | `BORRADOR` → `VALIDADA` | Admin/sistema | Rangos, moneda, fechas, precedencia, textos y ejemplos válidos; sin empate | Guardar resultado de validación / `ERR-POL-002 POLITICA_AMBIGUA` |
| `TR-POL-003` | `VALIDADA` → `PENDIENTE_APROBACION` | Admin | Regla exige doble aprobación | Bloquear publicación / `ERR-POL-003 APROBACION_REQUERIDA` |
| `TR-POL-004` | `VALIDADA` o `PENDIENTE_APROBACION` → `PROGRAMADA` | Admin(es) autorizado(s) | Aprobaciones; vigencia futura; diff visible | Evento de publicación futura / `ERR-POL-004 APROBACION_INVALIDA` |
| `TR-POL-005` | `VALIDADA` o `PENDIENTE_APROBACION` → `ACTIVA` | Admin(es) autorizado(s) | Aprobaciones; vigencia iniciada; sin conflicto | Seleccionable para operaciones nuevas / `ERR-POL-005 VIGENCIA_INVALIDA` |
| `TR-POL-006` | `PROGRAMADA` → `ACTIVA` | Sistema | Instante alcanzado y revalidación sin conflicto | Activar idempotentemente / `ERR-POL-006 CONFLICTO_AL_ACTIVAR` |
| `TR-POL-007` | `ACTIVA` → `REEMPLAZADA` | Sistema/admin | Nueva versión activa que la sustituye | Excluir selección futura; preservar instantáneas / `ERR-POL-007 REEMPLAZO_INVALIDO` |
| `TR-POL-008` | `ACTIVA` o `PROGRAMADA` → `RETIRADA` | Admin | Motivo y autorización; análisis de operaciones nuevas | Excluir selección futura / `ERR-POL-008 RETIRO_NO_AUTORIZADO` |

Editar contenido de una política fuera de `BORRADOR` está prohibido. Para cambiarlo se crea una nueva versión.

## 17. Retenciones

Una retención es un conjunto, no un booleano. Tipos iniciales: `DISPUTA_ABIERTA`, `RIESGO`, `CONTRACARGO`, `PAGO_INCONSISTENTE`, `ORDEN_FINANCIERA_INCIERTA`, `INCIDENCIA_ENVIO`, `INCIDENCIA_DEVOLUCION`, `ADMINISTRATIVA`, `CAPACIDAD_PROVEEDOR_NO_VERIFICADA`, `REVISION_PAGO_TARDIO`.

Cada retención declara acciones bloqueadas (`INICIAR_ENVIO`, `LIBERAR`, `REEMBOLSAR`, `CERRAR`) y autoridad que puede levantarla. Levantar una no elimina las demás ni ejecuta automáticamente la acción antes bloqueada; dispara una reevaluación idempotente.

### 17.1 `SM-FRE` — Revisión financiera excepcional

Estados: `ABIERTA`, `CONCILIANDO`, `PENDIENTE_DECISION`, `ORDEN_COMPENSATORIA_EN_PROCESO`, `CERRADA_SIN_MOVIMIENTO`, `CERRADA_COMPENSADA`. Las dos `CERRADA_*` son terminales del subproceso. No son estados de `SM-OPS`.

| ID | Desde → hacia | Actor | Guardas | Efectos / error |
|---|---|---|---|---|
| `TR-FRE-001` | ∅ → `ABIERTA` | Sistema / detectar pago tardío | Operación `CANCELADA` o `EXPIRADA`; evento externo auténtico/correlacionable; clave única por pago/operación | Crear revisión y hold `REVISION_PAGO_TARDIO`; emitir `EVT-FIN-004`; no cambiar operación / `ERR-FRE-001 REVISION_DUPLICADA` |
| `TR-FRE-002` | `ABIERTA` → `CONCILIANDO` | Sistema/admin | Referencia verificable; permiso | Consultar proveedor/libro; preservar observaciones / `ERR-FRE-002 REFERENCIA_NO_CONCILIABLE` |
| `TR-FRE-003` | `CONCILIANDO` → `PENDIENTE_DECISION` | Sistema | Resultado reconciliado; saldo y causa conocidos | Bloquear despacho; presentar opciones soportadas / `ERR-FRE-003 CONCILIACION_INCOMPLETA` |
| `TR-FRE-004` | `PENDIENTE_DECISION` → `ORDEN_COMPENSATORIA_EN_PROCESO` | Admin autorizado | Política/capacidad aprobadas; motivo; controles y saldo | Crear nueva orden idempotente; operación sigue terminal / `ERR-FRE-004 COMPENSACION_NO_AUTORIZADA` |
| `TR-FRE-005` | `PENDIENTE_DECISION` → `CERRADA_SIN_MOVIMIENTO` | Admin autorizado | Decisión fundada y compatible; motivo/auditoría | Levantar hold; emitir `EVT-FIN-005` / `ERR-FRE-005 DECISION_INCOMPLETA` |
| `TR-FRE-006` | `ORDEN_COMPENSATORIA_EN_PROCESO` → `CERRADA_COMPENSADA` | Sistema | Orden confirmada y reconciliada | Levantar hold; emitir `EVT-FIN-005`; operación no cambia / `ERR-FRE-006 ORDEN_NO_CONFIRMADA` |

Ninguna revisión excepcional convierte `CANCELADA`/`EXPIRADA` en `REEMBOLSADA` o `COMPLETADA`; la compensación se muestra como resultado del subproceso y en el libro/auditoría.

## 18. Concurrencia, atomicidad e idempotencia

### 18.1 Control de versión

- Cada agregado mantiene `version` monotónica; todo comando escribe con compare-and-swap.
- Un conflicto devuelve `ERR-CONC-001 VERSION_DESACTUALIZADA` y la interfaz recarga el estado.
- Las transiciones sensibles revalidan autorización y guardas dentro de la transacción, no solo antes.

### 18.2 Carreras críticas

| Carrera | Regla de serialización |
|---|---|
| Reclamo vs. liberación automática | Ambas adquieren el mismo bloqueo lógico sobre la operación/posición financiera. Reclamo válido cuyo instante de aceptación precede el límite crea la retención antes de autorizar orden. |
| Doble confirmación de recepción | Clave `(operacion, CONFIRMACION_RECEPCION)` y versión de operación producen un solo hecho y una sola orden. |
| Webhooks duplicados/fuera de orden | Scope canónico único `(provider, environment, account_scope, external_event_id)`; transición monotónica; conservar sin reaplicar efectos. |
| Dos intentos acreditados | Restricción única de acreditación por operación; segundo evento pasa a inconsistencia/revisión, no habilita saldo adicional. |
| Resolución vs. evidencia nueva | Confirmar resolución bloquea versión de disputa; evidencia concurrente válida fuerza conflicto y nueva revisión. |
| Cambio de política vs. congelación | Resolver política y guardar instantánea ocurre en una transacción lógica con instante efectivo; una política posterior no modifica la instantánea. |
| Devolución despachada al vencer | El comando se evalúa contra instante del servidor y versión; no contra hora del dispositivo. La consecuencia exacta depende de política/fallo. |

### 18.3 Claves estables

| Acción | Clave recomendada |
|---|---|
| Crear solicitud | `seller:{id}:client_request:{key}` |
| Procesar webhook con ID estable | `provider:{provider}:env:{environment}:account:{account_scope}:event:{external_event_id}` |
| Acreditar | `operation:{id}:accredit:{provider_payment_id}` |
| Declarar envío | `operation:{id}:shipment_declaration:{key}` |
| Abrir reclamo | `operation:{id}:ordinary_dispute` |
| Recordatorio | `operation:{id}:reminder:{type}:{scheduled_instant}` |
| Orden financiera | `operation:{id}:{type}:{cause_id}:{resolution_version}` |
| Publicar calificación | `rating:{id}:publish:{policy_version}` |

Reutilizar la misma clave con payload materialmente distinto devuelve `ERR-IDEM-001 CLAVE_REUTILIZADA_CON_OTRO_PAYLOAD`.

`account_scope` identifica la cuenta/tenant/credencial funcional del proveedor sin incluir secretos. Si el proveedor no entrega un `external_event_id` estable, se usa como fallback `provider + environment + account_scope + resource_reference + event_type + payload_hash_canonical`. Ese fallback solo deduplica la observación: nunca autoriza acreditación ni movimiento por sí mismo; obliga a consulta autoritativa y conciliación antes de producir un hecho financiero. `06` debe materializar el mismo scope en constraint, inbox e idempotency key.

### 18.4 Efectos externos

1. Validar comando e invariantes.
2. Persistir transición, evento outbox e intención en una transacción.
3. Ejecutar efecto externo.
4. Persistir observación externa sin asumir éxito definitivo.
5. Confirmar por reconciliación y emitir el evento final.

No se mantiene una transacción de base de datos abierta durante llamadas externas.

## 19. Errores de dominio transversales

| Código | Semántica | Respuesta funcional |
|---|---|---|
| `ERR-AUTH-001 NO_AUTORIZADO` | Actor sin permiso sobre recurso | Denegar sin revelar datos ajenos; auditar si sensible |
| `ERR-AUTH-002 AUTENTICACION_RECIENTE_REQUERIDA` | Acción sensible | Solicitar reautenticación sin perder borrador |
| `ERR-CONC-001 VERSION_DESACTUALIZADA` | Agregado cambió | Recargar y explicar cambio |
| `ERR-IDEM-001 CLAVE_REUTILIZADA_CON_OTRO_PAYLOAD` | Conflicto de idempotencia | Rechazar y alertar si financiero |
| `ERR-POL-009 DECISION_PENDIENTE` | Ruta depende de `DP-*` sin política aprobada | Bloquear; señalar DP y no usar valor propuesto |
| `ERR-RET-001 ACCION_RETENIDA` | Existe retención aplicable | Mostrar estado pendiente sin detalles antifraude sensibles |
| `ERR-TIME-001 PLAZO_INVALIDO` | Cálculo o configuración incompleta | No programar ni ejecutar consecuencia |
| `ERR-MONEY-001 MONEDA_O_MONTO_INCONSISTENTE` | Desglose/externo no coincide | Retener, conciliar y alertar |
| `ERR-EVID-001 EVIDENCIA_RECHAZADA` | Formato/tamaño/seguridad | Rechazar archivo específico; conservar otros confirmados |

Los errores técnicos nunca cambian un estado a éxito. Se traducen a un error de dominio, resultado desconocido o revisión excepcional según su naturaleza.

## 20. Trazabilidad

| Elemento de este documento | PRD/FSD relacionado | Decisiones abiertas |
|---|---|---|
| `AGG-OPERACION`, `SM-OPS` | `RF-OPS-001..011`, `RN-001..006`, FL-02 | `DP-005`, `DP-008..011` |
| `AGG-PAGO`, `SM-PAG` | `RF-PAG-001..007`, `RN-013..014`, FL-03 | `DP-002..005`, `DP-012..013` |
| `AGG-ENVIO`, `SM-ENV` | `RF-ENV-001..007`, `RN-015..017`, FL-04 | `DP-008..011` |
| Confirmación y carrera | `RF-CON-001..007`, `RN-018..022`, FL-05 | `DP-009..010`, `DP-013` |
| `AGG-DISPUTA`, `SM-DIS` | `RF-DIS-001..015`, `RN-023..030`, FL-06..08 | `DP-006..007`, `DP-014..016` |
| `SettlementProposal`, `SM-SET` | `RF-DIS-010`, FSD §13.4.D y §12.1 | `DP-006..007`, `DP-014` |
| `AGG-DEVOLUCION`, `SM-DEV` | `RF-DEV-001..008`, FL-09 | `DP-014..016` |
| `SM-FIN`, libro y retenciones | `RF-PAG-008..012`, FL-10 | `DP-002..003`, `DP-007`, `DP-013`, `DP-016` |
| `AGG-REVISION-FINANCIERA-EXCEPCIONAL`, `SM-FRE` | `RN-005`, FSD §8.4 y caso límite de pago tardío | `DP-002..003`, `DP-007`, `DP-013` |
| `SM-REP` | `RF-REP-001..011`, `RN-031..034`, FL-11 | `DP-017..018` |
| `SM-POL` | `RF-ADM-001..005`, FL-13 | `DP-005..018` según política |
| Auditoría y acciones manuales | `RF-ADM-006..010`, FL-14 | `DP-012..014`, `DP-020` |
| Tiempo, notificación e internacionalización | `RF-CON-003..005`, requisitos internacionales, FSD 20/21/22/24 | `DP-001`, `DP-004`, `DP-009..010`, `DP-021` |

### 20.1 Matriz de decisiones que no deben resolverse en código

| DP | Bloqueo de dominio |
|---|---|
| `DP-001` | Países piloto, entidad y textos/ámbitos habilitados |
| `DP-002..003` | Tipo y disponibilidad real de acreditación, retención, liberación y reembolso por Mercado Pago |
| `DP-004` | Elegibilidad transfronteriza y conversión; por omisión no se presupone soporte |
| `DP-005` | Hito exacto de congelación de política/comisiones |
| `DP-006..007` | Cobro y destino de comisiones por reclamo/resolución |
| `DP-008..010` | Plazos, calendario, cortes y consecuencias de despacho/entrega |
| `DP-011..013` | Categorías, KYC/AML, contracargos, reservas y saldos negativos |
| `DP-014..016` | SLA, apelación, costo de devolución e hito de reembolso |
| `DP-017..018` | Escala, ventana, fórmula, moderación y retención de contenido |
| `DP-019` | Persistencia y tecnología; no altera semántica del dominio |
| `DP-020` | SLO/RTO/RPO y umbrales de salida; no convertir propuestas en garantías |
| `DP-021` | Eficacia exigida de notificaciones críticas antes de automatizaciones irreversibles, tratamiento de rebotes y fallback por país/canal; el motor soporta hold/escalamiento pero no elige la política |
| `DTA-SEC-001` | Modelo de identidad administrativa: IdP corporativo/MFA, vinculación de cuenta, separación de sesiones, lifecycle y break-glass; no se implementa autenticación privilegiada implícita con magic link de participante |

## 21. Reglas de implementación y prueba

- Cada manejador de comando debe citar `TR-*` e invariantes relevantes en sus pruebas.
- Debe existir una prueba negativa por transición no listada y por cada guarda financiera.
- Deben probarse webhooks duplicados, fuera de orden, tardíos y con importe/moneda incorrectos.
- Debe probarse la carrera reclamo/liberación con ejecución concurrente real sobre la persistencia elegida.
- Debe probarse recuperación tras timeout externo sin duplicar movimientos.
- Debe probarse que un pago tardío conserva `CANCELLED`/`EXPIRED`, crea una sola revisión financiera y nunca habilita despacho.
- Deben probarse versión, aceptación parcial, doble aceptación concurrente, revocación y expiración de `SettlementProposal`; ninguna aceptación individual crea órdenes.
- Las proyecciones de dashboard y reputación deben poder reconstruirse desde eventos/hechos persistidos.
- Nunca debe exponerse una acción que el servidor no volverá a autorizar.
- Ningún job programado contiene decisiones irreversibles precalculadas: al ejecutarse relee estado, política congelada y retenciones.
- Datos sensibles, evidencia y direcciones se minimizan por rol; autorización se prueba entre operaciones de usuarios distintos.
- Una nueva capacidad del proveedor requiere evidencia documental, actualización de matriz y pruebas contractuales antes de habilitar una transición.

## 22. Criterios de aceptación del modelo

1. No es posible declarar despacho sin acreditación conciliada.
2. Un retorno exitoso del navegador no cambia `SM-PAG` a `ACREDITADO`.
3. Un reclamo válido y una liberación concurrentes producen como máximo una autorización, respetando el límite y la retención.
4. Dos webhooks idénticos generan un solo evento financiero y un solo asiento.
5. Un evento externo fuera de orden no degrada un estado financiero confirmado.
6. Un pago tardío para operación cancelada/expirada conserva el terminal, abre como máximo una revisión ortogonal y no habilita envío.
7. Una resolución que excede saldo o no asigna todos los componentes no puede confirmarse.
8. Una devolución no reembolsa antes del hito escrito en su resolución.
9. Una orden con resultado desconocido se consulta antes de reintentar.
10. Una política retirada sigue siendo resoluble para operaciones que conservan su instantánea.
11. Una calificación duplicada o propia es imposible por invariante y restricción de unicidad.
12. Un comentario negativo que cumple reglas objetivas no se rechaza por su valoración.
13. Una acción dependiente de `DP-*` sin decisión aprobada falla con `ERR-POL-009`, sin valor implícito.
14. Los estados terminales no tienen transiciones ordinarias salientes.
15. Toda corrección excepcional conserva el hecho anterior y registra causa, autorización y correlación.
16. Comprador y vendedor solo aceptan la misma versión de propuesta; la segunda aceptación pasa atómicamente a revisión y ninguna aceptación aislada mueve dinero.
17. Dos eventos con igual ID externo en cuentas o entornos distintos no colisionan; el fallback sin ID estable obliga a reconciliar antes de cualquier efecto financiero.

---

### Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.1 | 2026-08-07 | Corrige pago tardío sin romper terminalidad; agrega `SettlementProposal` bilateral, scope canónico de webhook, catálogos estado/API/UX/eventos y decisiones `DP-021`/`DTA-SEC-001` |
| 0.1.0 | 2026-08-07 | Primera versión del modelo de dominio y máquinas de estados derivada del PRD y FSD 0.1.0 |
