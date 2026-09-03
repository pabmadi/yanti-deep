# 02 — FSD: Especificación funcional de compra segura entre particulares

**Estado:** Borrador funcional para revisión  
**Versión:** 0.1.1  
**Última actualización:** 2026-08-07  
**Documento padre:** `01_PRD.md`, versión 0.1.1  
**Audiencia:** Producto, Diseño, Ingeniería, QA, Operaciones, Riesgo, Legal y Soporte  
**Carácter:** Fuente de verdad funcional subordinada al PRD  

> Este documento define cómo debe comportarse el MVP. No reemplaza el PRD ni resuelve sus decisiones pendientes. Cuando una conducta dependa de una decisión `DP-*`, se indica expresamente. Codex no debe convertir ejemplos, valores propuestos o notas abiertas en reglas definitivas.

## 1. Propósito

Especificar de manera implementable y verificable:

- actores, permisos y responsabilidades;
- flujos principales y alternativos;
- estados funcionales visibles y transiciones permitidas;
- validaciones, vencimientos y automatizaciones;
- manejo de errores, reintentos y concurrencia;
- comportamiento de dashboards, perfiles, reputación, notificaciones y administración;
- condiciones de liberación, reembolso, disputa y devolución;
- criterios de aceptación funcional trazables al PRD.

El modelo de dominio formal, invariantes técnicas y máquinas de estados exhaustivas se definirán en `03_DOMAIN_AND_STATE_MACHINES.md`. Si ese documento introduce nombres técnicos distintos, deberá mantener una tabla de correspondencia con los estados funcionales aquí definidos.

## 2. Fuentes, precedencia y convenciones

### 2.1 Precedencia

1. Ley, regulación y contrato vigente aplicables.
2. `01_PRD.md` aprobado.
3. Este `02_FSD.md`.
4. Documentos técnicos derivados.
5. Tickets, diseños y conversaciones.

Una contradicción no se resuelve silenciosamente: se registra, se detiene solo la parte afectada y se solicita decisión.

### 2.2 Palabras normativas

- **DEBE / NO DEBE:** comportamiento obligatorio del MVP.
- **DEBERÍA:** prioridad alta que solo puede posponerse de forma documentada.
- **PUEDE:** comportamiento permitido u opcional.
- **Propuesto:** valor útil para diseño y pruebas, no aprobado para producción.

### 2.3 Identificadores

- `FL-*`: flujo funcional.
- `VF-*`: validación funcional.
- `PE-*`: permiso.
- `AU-*`: automatización.
- `ER-*`: condición de error o recuperación.
- `CA-*`: criterio de aceptación funcional.
- Se conservan referencias `RF-*`, `RN-*`, `RNF-*` y `DP-*` del PRD.

### 2.4 Términos

| Término | Definición funcional |
|---|---|
| Solicitud | Propuesta de compraventa creada por el vendedor, todavía no pagada |
| Operación | Registro completo que conserva acuerdo, pago, envío, disputa y cierre |
| Acuerdo | Instantánea inmutable de condiciones aceptadas por comprador y vendedor |
| Acreditación | Confirmación reconciliada del proveedor de que el pago está disponible conforme al modelo aprobado |
| Liberación | Instrucción de transferir o poner a disposición del vendedor el importe correspondiente |
| Reembolso | Instrucción de devolver al comprador un importe pagado |
| Reclamo | Manifestación formal del comprador que suspende la liberación y abre una disputa |
| Disputa | Proceso de evidencia, análisis y resolución de un reclamo |
| Evidencia | Archivo, texto, tracking o evento preservado y atribuible utilizado para evaluar una operación |
| Política efectiva | Configuración versionada que aplica a una operación según ámbito y vigencia |
| Retención | Bloqueo funcional que impide liberar mientras exista una condición válida |
| Estado terminal | Estado que no admite transiciones ordinarias posteriores |

## 3. Supuestos y decisiones sin resolver

### 3.1 Supuestos de trabajo

- El MVP opera con bienes físicos y una sola unidad lógica por operación.
- El vendedor conoce el correo del comprador.
- Cada operación tiene un comprador, un vendedor, un país operativo, una moneda y un monto base.
- Español y portugués brasileño son los idiomas iniciales propuestos.
- Los valores 1% para cada parte, 3% por reclamo, máximo de entrega de 10 días corridos y tres recordatorios diarios son propuestas configurables.
- Las disputas requieren resolución humana.
- La aplicación no instruye el despacho hasta confirmar el pago por una fuente confiable.

### 3.2 Decisiones que permanecen abiertas

Las decisiones `DP-001` a `DP-021` del PRD siguen vigentes. Afectan especialmente:

- modelo legal y capacidades reales de Mercado Pago (`DP-002`, `DP-003`);
- operaciones transfronterizas (`DP-004`);
- momento de congelación y tratamiento de comisiones (`DP-005` a `DP-007`);
- plazos y consecuencias de despacho/entrega (`DP-008` a `DP-010`);
- KYC, riesgo y contracargos (`DP-011` a `DP-013`);
- SLA, devolución y apelación (`DP-014` a `DP-016`);
- reputación y moderación (`DP-017`, `DP-018`).
- requisito de notificación efectiva, rebotes y fallback antes de autoliberación (`DP-021`).

Cuando este documento necesita una conducta para describir el flujo, utiliza una **política configurable** y no decide el valor productivo.

## 4. Roles y permisos

### 4.1 Principios

- Toda autorización se evalúa en servidor y sobre el recurso concreto.
- Tener acceso a una URL no concede permiso.
- Un usuario puede actuar como comprador en una operación y vendedor en otra.
- Los roles administrativos son independientes de los roles transaccionales.
- Las acciones financieras y de disputa requieren autenticación reciente cuando la política de seguridad lo indique.

### 4.2 Matriz funcional

| Acción | Vendedor de la operación | Comprador de la operación | Soporte/auditor | Admin. operaciones | Admin. sistema |
|---|---:|---:|---:|---:|---:|
| Ver acuerdo propio | Sí | Sí | Lectura autorizada | Sí | Según permiso |
| Crear solicitud | Sí | No | No | No | No |
| Cancelar solicitud no pagada | Sí | No | No | Excepcional | No |
| Aceptar y pagar | No | Sí | No | No | No |
| Declarar despacho | Sí | No | No | Corrección excepcional | No |
| Confirmar recepción | No | Sí | No | No | No |
| Abrir reclamo | No | Sí | No | No | No |
| Aportar evidencia | Sí | Sí | No | Solicitar/adjuntar nota interna | No |
| Emitir fallo | No | No | No | Sí | Solo con permiso específico |
| Ejecutar ajuste manual | No | No | No | Según umbral | Según permiso financiero |
| Calificar contraparte | Sí | Sí | No | No | No |
| Moderar comentario | No | No | Lectura | Según permiso | Según permiso |
| Cambiar políticas | No | No | No | No | Sí |
| Ver auditoría | No | No | Lectura limitada | Sí | Sí |

### 4.3 Restricciones expresas

- **PE-001.** Ningún usuario puede actuar por la contraparte.
- **PE-002.** Soporte no puede mover dinero ni cambiar estados financieros.
- **PE-003.** Un administrador involucrado o con conflicto declarado no puede fallar la disputa.
- **PE-004.** Una acción manual sensible requiere motivo y queda auditada.
- **PE-005.** Los umbrales de doble aprobación se evalúan en la moneda normalizada definida por Finanzas.
- **PE-006.** La evidencia privada solo es accesible por participantes y personal autorizado con necesidad operativa.

## 5. Modelo funcional de estados

Los nombres son visibles o conceptuales; no prescriben la representación de base de datos.

### 5.1 Estado principal de la operación

| Estado funcional | Significado | Actor esperado |
|---|---|---|
| Borrador | El vendedor edita; no se notificó al comprador | Vendedor |
| Pendiente de aceptación/pago | Solicitud enviada y vigente | Comprador |
| Pago en proceso | Existe intento no terminal | Comprador/sistema |
| Pagada; pendiente de envío | Pago acreditado; vendedor habilitado a enviar | Vendedor |
| Enviada; pendiente de recepción | Despacho completo informado | Comprador/sistema |
| Confirmación vencida | Llegó el hito de confirmación; corren recordatorios/gracia | Comprador/sistema |
| En disputa | Reclamo abierto; liberación suspendida | Ambas partes/operaciones |
| Devolución requerida | Fallo condicionado a devolución | Comprador/vendedor |
| Liberación en proceso | Se inició el movimiento al vendedor | Sistema |
| Reembolso en proceso | Se inició devolución de fondos al comprador | Sistema |
| Completada | Liberación confirmada y cierre registrado | Ninguno |
| Reembolsada | Reembolso final confirmado y cierre registrado | Ninguno |
| Cancelada | Finalizó antes de pago acreditado | Ninguno |
| Expirada | Venció antes de pago válido | Ninguno |
| Revisión excepcional | Anomalía que impide automatización | Operaciones |

### 5.2 Principios de transición

- El estado mostrado DEBE derivarse de hechos y subestados, no de texto libre.
- Una transición DEBE registrar estado anterior, nuevo estado, actor, causa, instante y correlación.
- Un estado financiero “en proceso” no puede mostrarse como completado.
- Los estados terminales no cambian por flujos ordinarios.
- Reclamo, riesgo, contracargo, conciliación o fallo técnico pueden crear retenciones sin perder el historial anterior.
- La máquina de estados formal definirá transiciones imposibles y recuperación.

## 6. Flujo FL-01 — Acceso por magic link

**Trazabilidad:** `RF-AUT-001` a `RF-AUT-006`, `RNF-006`, `RNF-012`.

### 6.1 Precondiciones

- El correo tiene formato válido.
- El origen y la ruta de retorno pertenecen a una lista permitida.
- No se superaron límites de frecuencia.

### 6.2 Flujo principal

1. El usuario ingresa su correo.
2. El sistema responde con un mensaje neutral, exista o no una cuenta.
3. El sistema genera un token aleatorio de un solo uso, guarda solo una representación segura, propósito, expiración y ruta de retorno validada.
4. Resend envía el enlace en el idioma determinado por contexto o preferencia.
5. El usuario abre el enlace mediante `GET`. El sistema muestra una página de continuación segura, pero NO consume el token ni crea una sesión.
6. Tras una interacción explícita, el cliente envía el token mediante `POST`, sin cargar antes recursos externos capaces de recibir la URL o el referrer.
7. El sistema valida integridad, propósito, expiración, consumo y política de seguridad.
8. Si es un usuario nuevo, se crea el perfil mínimo y se solicita aceptar consentimientos vigentes.
9. Se crea una sesión y se consume el token de forma atómica.
10. El usuario vuelve a la ruta segura que originó el flujo o a su dashboard.

### 6.3 Alternativas y errores

- **ER-AUT-001:** enlace vencido → explicar y permitir solicitar otro sin conservar el token anterior.
- **ER-AUT-002:** enlace ya usado → no iniciar una segunda sesión; ofrecer nuevo enlace.
- **ER-AUT-003:** enlace inválido → mensaje genérico y registro de seguridad.
- **ER-AUT-004:** Resend demora o falla → mantener solicitud trazada, reintentar según política y ofrecer reenvío limitado.
- **ER-AUT-005:** cuenta restringida → autenticar solo lo necesario para mostrar el estado y canal de soporte permitido.
- **ER-AUT-006:** ruta de retorno externa o manipulada → ignorarla y enviar al dashboard.

### 6.4 Validaciones

- **VF-AUT-001:** normalizar correo sin alterar semántica específica del proveedor.
- **VF-AUT-002:** el token no aparece en logs ni analítica.
- **VF-AUT-003:** el consumo simultáneo solo permite una sesión exitosa.
- **VF-AUT-004:** consentimientos guardan versión, país, idioma, fecha y sujeto.
- **VF-AUT-005:** solicitudes `GET`, prefetch y scanners no consumen el desafío; solo un `POST` válido tras interacción puede hacerlo.
- **VF-AUT-006:** token y URL completa no aparecen en logs, analítica, referrer ni requests a recursos externos.

## 7. Flujo FL-02 — Crear y enviar solicitud

**Trazabilidad:** `RF-OPS-001` a `RF-OPS-011`, `RN-001` a `RN-012`.

### 7.1 Precondiciones

- Vendedor autenticado, activo y elegible.
- País, moneda y categoría habilitados.
- Perfil mínimo y verificaciones exigibles completados.

### 7.2 Campos

| Campo | Obligatorio | Regla funcional |
|---|---:|---|
| Correo del comprador | Sí | Válido, distinto al del vendedor y no bloqueado |
| País operativo | Sí | Catálogo habilitado; no se infiere solo por IP |
| Moneda | Sí | Permitida para país/proveedor |
| Monto base | Sí | Unidad menor, dentro de límites efectivos |
| Categoría | Sí | Permitida y compatible con modalidad |
| Título | Sí | Longitud configurable; texto significativo |
| Descripción/condición | Sí | Debe permitir defectos, accesorios y condiciones materiales |
| Enlace de publicación | Según política | HTTPS válido; se trata como referencia no confiable |
| Imágenes de referencia | Según política | Formato, cantidad y tamaño permitidos |
| Modalidad de entrega | Sí | Entre opciones habilitadas |

### 7.3 Flujo principal

1. El vendedor crea un borrador.
2. El sistema resuelve la política efectiva y valida cada campo.
3. El sistema calcula una vista previa con monto base, comisión del comprador, total, comisión del vendedor y neto estimado.
4. El vendedor revisa una pantalla resumen.
5. Al confirmar, el sistema revalida elegibilidad y política para evitar datos obsoletos.
6. Se crea una versión del acuerdo y se registra la política aplicable según el hito aprobado en `DP-005`.
7. La solicitud pasa a pendiente y se programa su expiración.
8. Se envía notificación al comprador.
9. El vendedor ve estado, vencimiento y opción de reenvío/cancelación si corresponde.

### 7.4 Alternativas

- El correo corresponde a una cuenta existente: se vincula como destinatario sin revelar datos adicionales.
- El correo no tiene cuenta: se invita a crearla al consumir el magic link.
- Cambia una política mientras el borrador está abierto: al confirmar se recalcula y se exige revisar cualquier diferencia material.
- El enlace externo no está disponible: la solicitud puede continuar solo si la política no lo exige; nunca se copia contenido sin consentimiento y controles.

### 7.5 Errores

- **ER-OPS-001:** combinación país/moneda no habilitada → impedir envío y explicar opciones válidas.
- **ER-OPS-002:** monto fuera de rango → indicar mínimo/máximo en la moneda seleccionada.
- **ER-OPS-003:** comprador igual o relacionado → bloquear o enviar a revisión según política.
- **ER-OPS-004:** falla al notificar → la solicitud sigue válida, se muestra estado de notificación y se reintenta; no se duplica.
- **ER-OPS-005:** doble confirmación → devuelve la misma solicitud, no crea otra.

### 7.6 Cancelación y expiración

- El vendedor puede cancelar mientras no haya pago en proceso/acreditado.
- Una solicitud vencida no admite aceptación ni nuevos pagos.
- Si pago y cancelación/expiración compiten, el sistema serializa la decisión, consulta al proveedor y envía el caso ambiguo a revisión.
- Reenviar una invitación no extiende el vencimiento salvo política explícita.

## 8. Flujo FL-03 — Revisar, aceptar y pagar

**Trazabilidad:** `RF-OPS-004` a `RF-OPS-009`, `RF-PAG-001` a `RF-PAG-007`.

### 8.1 Precondiciones

- Solicitud vigente y elegible.
- Usuario autenticado con el correo invitado o mediante vinculación segura aprobada.
- Política y textos legales disponibles en idioma válido.

### 8.2 Flujo principal

1. El comprador abre la solicitud.
2. La vista muestra vendedor y reputación, acuerdo completo, evidencia de referencia, monto base, comisiones, total, moneda y plazos.
3. El comprador confirma que entiende las condiciones y acepta versiones legales aplicables.
4. El servidor vuelve a validar vigencia, identidad, política, importes y elegibilidad.
5. Se crea un intento de pago idempotente y se redirige o abre el flujo autorizado de Mercado Pago.
6. El regreso del navegador se muestra como informativo, nunca como acreditación definitiva.
7. El sistema recibe un webhook autenticado o realiza una consulta autoritativa al proveedor; en ambos casos correlaciona y concilia monto, moneda, cuenta y referencia.
8. Al acreditarse exactamente una vez, la operación queda pendiente de envío.
9. Se notifica a ambas partes; solo el vendedor recibe la instrucción de despachar.

### 8.3 Estados del intento de pago

- Creado.
- Pendiente de usuario/proveedor.
- En revisión.
- Acreditado.
- Rechazado.
- Cancelado.
- Expirado.
- Inconsistente/en revisión manual.

Los códigos externos se mapean de forma explícita y se conserva el valor original.

### 8.4 Casos alternativos

- Pago rechazado: permitir nuevo intento mientras la solicitud siga vigente y no exista otro acreditado.
- Pago pendiente: bloquear intentos incompatibles y mostrar que aún no debe enviarse.
- Usuario abandona el proveedor: conservar intento y permitir retomar o iniciar otro según estado real.
- Webhook llega antes que el retorno: acreditar normalmente.
- Retorno llega antes que una confirmación autoritativa por webhook o consulta: mostrar “verificando pago”.
- Webhook duplicado o fuera de orden: procesar idempotentemente y no degradar un estado confirmado sin regla expresa.
- Monto, moneda o cuenta no coinciden: no acreditar la operación; crear alerta de conciliación.
- Pago acreditado después de expiración: no habilitar automáticamente el envío; revisión y eventual reembolso según política.

## 9. Flujo FL-04 — Preparar y declarar envío

**Trazabilidad:** `RF-ENV-001` a `RF-ENV-007`, `RN-013` a `RN-017`.

### 9.1 Precondiciones

- Pago acreditado y conciliado.
- Sin retención que prohíba despacho.
- Vendedor autenticado y autorizado.

### 9.2 Flujo principal

1. El vendedor ve instrucciones, fecha máxima de despacho y evidencia requerida.
2. Carga evidencia del producto y empaquetado.
3. Selecciona transportista o modalidad habilitada.
4. Ingresa tracking, URL si corresponde, fecha de despacho y entrega estimada.
5. El sistema valida archivos, plazo, coherencia y campos obligatorios.
6. El vendedor revisa y confirma que entregó el paquete al transportista o contraparte.
7. El sistema conserva originales, hashes, metadatos, versiones y autoría.
8. La operación pasa a enviada y se calculan hitos de entrega/confirmación con la política congelada.
9. El comprador recibe notificación y ve tracking, evidencia compartible y fecha límite.

### 9.3 Evidencia

- La carga incompleta puede guardarse como borrador, pero no declara el despacho.
- Un archivo rechazado por formato, tamaño o análisis de seguridad no cuenta como evidencia válida.
- Los metadatos no son prueba concluyente y no deben presentarse como garantía de autenticidad.
- La eliminación lógica por privacidad no destruye el original mientras exista obligación de retención.
- Una corrección agrega una nueva versión; no sobrescribe la anterior.

### 9.4 Plazos

- El plazo de despacho y su consecuencia dependen de `DP-008`.
- El máximo de entrega propuesto es 10 días corridos desde el despacho, sujeto a `DP-009` y `DP-010`.
- Si el vendedor propone una fecha inválida, el sistema muestra la fecha máxima permitida.
- Una extensión requiere regla explícita o acción administrativa motivada y notificada.

### 9.5 Excepciones

- Transportista no listado: opción “otro” solo si está habilitada.
- Tracking duplicado entre operaciones: alertar o revisar según riesgo.
- Entrega presencial: utilizar comprobante equivalente definido por política; no simular tracking.
- Falla al subir archivo: conservar los archivos confirmados y permitir reintento sin declarar envío.

## 10. Flujo FL-05 — Seguimiento, confirmación y liberación

**Trazabilidad:** `RF-CON-001` a `RF-CON-007`, `RN-018` a `RN-022`.

### 10.1 Vista del comprador

Debe mostrar:

- artículo y acuerdo resumido;
- vendedor y reputación;
- tracking y evidencia disponible;
- estado de envío;
- fecha y hora límite con zona;
- acciones “Confirmar recepción conforme” y “Abrir reclamo”; 
- consecuencia precisa de no actuar.

### 10.2 Confirmación conforme

1. El comprador selecciona confirmar.
2. El sistema muestra una advertencia clara sobre la liberación.
3. El comprador confirma explícitamente; se puede exigir autenticación reciente.
4. El servidor revalida que la operación está enviada, el comprador es correcto y no existe reclamo ni retención.
5. Se registra la confirmación inmutable.
6. El sistema determina elegibilidad de liberación.
7. Si es elegible, inicia una orden idempotente de liberación.
8. La operación muestra “liberación en proceso” hasta confirmación del proveedor.
9. Al confirmarse, pasa a completada y habilita calificaciones.

La calificación jamás es precondición de liberación, reembolso o cierre. Solo se habilita después de que el movimiento requerido esté confirmado y la operación alcance un estado terminal elegible.

### 10.3 Recordatorios e inacción

- En el hito definido por la política, el sistema genera el primer pedido de confirmación.
- Se envía como máximo un recordatorio por intervalo configurado y destinatario.
- Valor propuesto: uno por día durante tres días consecutivos.
- Cada recordatorio muestra la fecha/hora exacta de liberación prevista.
- La falla del email no determina por sí sola si el plazo se extiende: el tratamiento depende de la política aprobada bajo `DP-021`.
- Al finalizar la gracia, una tarea evalúa elegibilidad; no asume que el estado no cambió.
- La tarea de autoliberación DEBE evaluar la política de notificación efectiva aprobada por país/canal (`DP-021`), incluidos estados suficientes, rebotes y fallback. Si no existe una regla aplicable o no se satisface, debe denegar la autoliberación y escalar a revisión; no adoptar el envío, aceptación o entrega del email como suficiencia implícita.

### 10.4 Evaluación de liberación

La liberación solo procede si simultáneamente:

- el pago está acreditado y conciliado;
- el envío fue declarado válidamente;
- existe confirmación o venció el periodo completo;
- no existe reclamo abierto;
- no existe contracargo, devolución, revisión de riesgo, inconsistencia ni retención administrativa;
- no existe otra orden de liberación activa o completada;
- la política y el proveedor permiten el movimiento.

Si falla una condición, se registra la causa y se reprograma o escala según corresponda.

### 10.5 Concurrencia reclamo/liberación

- La apertura de reclamo y la autorización de liberación deben competir sobre el mismo control transaccional.
- Un reclamo aceptado antes del instante límite bloquea la liberación.
- Si el proveedor ya hizo irreversible la liberación, el sistema no debe representar el reclamo como cubierto; deriva al flujo excepcional definido por Legal/Operaciones.
- Un evento tardío nunca revierte por sí mismo un movimiento confirmado.

## 11. Flujo FL-06 — Abrir reclamo

**Trazabilidad:** `RF-DIS-001` a `RF-DIS-007`, `RN-023` a `RN-030`.

### 11.1 Elegibilidad

- Solo el comprador de la operación.
- Pago acreditado.
- Antes de liberación irreversible y dentro de la ventana aplicable.
- Sin reclamo activo duplicado.
- Motivo habilitado para el estado y modalidad.

### 11.2 Flujo principal

1. El comprador selecciona “Abrir reclamo”.
2. El sistema explica que la operación se pausará, el proceso, los plazos y cualquier costo.
3. El comprador elige motivo y completa preguntas guiadas.
4. Aporta descripción y evidencia mínima según motivo.
5. Se muestra el costo y tratamiento conocido. El 3% es solo valor propuesto, dependiente de `DP-006`.
6. El comprador revisa y confirma.
7. El servidor revalida elegibilidad y obtiene control exclusivo sobre la transición.
8. Se crea el reclamo, se aplica retención y se suspende cualquier automatización de liberación aún reversible.
9. Se congelan plazos y políticas pertinentes.
10. Se notifica al vendedor, comprador y cola de operaciones.

### 11.3 Formularios por motivo

| Motivo | Datos mínimos sugeridos |
|---|---|
| No recibido | Estado de tracking, fecha esperada, contacto con transportista si existió |
| Artículo distinto | Diferencias concretas, fotos/video, referencia al acuerdo |
| Daño | Área dañada, embalaje, fotos/video de apertura cuando exista |
| Faltantes | Elementos pactados y faltantes, evidencia de contenido |
| Condición no declarada | Defecto, impacto y referencia al texto aceptado |
| Otro | Descripción estructurada y evidencia relevante |

### 11.4 Errores

- Ventana vencida: explicar que no puede abrirse por el flujo ordinario y ofrecer soporte si existe excepción.
- Evidencia mínima insuficiente: conservar borrador y mostrar qué falta.
- Archivo inseguro: rechazar solo el archivo y permitir reemplazo.
- Pago de costo de reclamo incierto: no crear cargos duplicados ni declarar abierto hasta resolver el modelo aprobado.
- Liberación simultánea: aplicar la regla de concurrencia del apartado 10.5.

## 12. Flujo FL-07 — Responder y aportar evidencia

**Trazabilidad:** `RF-DIS-005` a `RF-DIS-009`, `RF-ENV-004`.

### 12.1 Flujo del vendedor

1. Recibe motivo, alegación, evidencia compartible y fecha límite.
2. Puede responder, pedir aclaración o proponer aceptar la pretensión. Esta última acción solo crea una propuesta de acuerdo versionada; no resuelve la disputa ni mueve dinero.
3. Aporta texto, fotos, video, documentos y tracking.
4. Revisa qué será visible para la contraparte.
5. Envía; el sistema preserva versión y fecha.

### 12.2 Flujo del comprador

- Puede aportar información adicional mientras la ventana esté abierta o en respuesta a una solicitud administrativa.
- No puede modificar silenciosamente la alegación original.

### 12.3 Solicitud administrativa

- El administrador elige destinatario, pregunta, evidencia requerida y fecha límite.
- La solicitud es visible en la línea de tiempo de disputa.
- La respuesta se vincula a la solicitud.
- Una extensión exige motivo y notificación a ambas partes cuando afecte el SLA.

### 12.4 Visibilidad

Cada elemento se clasifica como:

- compartido con ambas partes;
- visible solo para operaciones por contener datos protegidos;
- nota interna administrativa;
- restringido por seguridad o requerimiento legal.

La clasificación no permite ocultar a una parte la razón sustancial del fallo.

### 12.5 Propuesta de acuerdo entre partes

- Una parte autorizada puede crear una propuesta versionada con resultado, asignación de importes, requisitos y vencimiento completos.
- Crear o aceptar una propuesta no mueve dinero, no levanta retenciones y no modifica silenciosamente la alegación o el fallo.
- La contraparte debe aceptar exactamente la misma versión de forma explícita; cualquier cambio invalida aceptaciones anteriores.
- La doble aceptación convierte la propuesta en un acuerdo verificable, pero la resolución/confirmación autorizada aún debe validar saldo, capacidades, políticas, aprobaciones e invariantes antes de crear una orden financiera.
- Rechazo, expiración o retiro conserva el historial y devuelve la disputa al estado compatible de revisión/evidencia.
- Si no existe contrato implementado para doble aceptación, la acción de “aceptar la pretensión” no debe mostrarse ni habilitarse.

## 13. Flujo FL-08 — Revisar y resolver disputa

**Trazabilidad:** `RF-DIS-008` a `RF-DIS-015`, `RN-024` a `RN-030`.

### 13.1 Bandeja operativa

Debe permitir ordenar por:

- acción vencida o próxima;
- antigüedad y SLA;
- país, moneda, monto y motivo;
- estado de evidencia y respuesta;
- riesgo y necesidad de doble aprobación;
- administrador asignado.

### 13.2 Vista de revisión

Debe presentar sin alteración:

- acuerdo aceptado y política congelada;
- identidad/rol y señales permitidas de ambas partes;
- cronología completa;
- libro financiero y estado del proveedor;
- despacho, tracking y eventos de entrega;
- alegaciones y evidencia bilateral;
- solicitudes de información y vencimientos;
- notas internas claramente diferenciadas;
- conflictos de interés y acciones previas.

### 13.3 Preparar resolución

1. El administrador declara ausencia de conflicto.
2. Selecciona un resultado admitido.
3. Completa motivo estructurado y explicación comprensible.
4. El sistema calcula un desglose preliminar de todos los importes.
5. Se indican requisitos pendientes, como devolución.
6. El sistema valida que la suma no exceda el saldo disponible y que la acción sea compatible con proveedor/política.
7. Si supera el umbral, pasa a segunda aprobación sin ejecutar.
8. El administrador revisa una pantalla final que distingue decisión de movimiento irreversible.
9. Confirma; se registra el fallo inmutable.
10. Se notifican ambas partes y se ejecuta o espera el hito indicado.

### 13.4 Resultados del MVP

#### A. Liberar al vendedor

- Se explicitan monto base y comisiones.
- Se crea orden idempotente de liberación.
- La operación queda “liberación en proceso” hasta confirmación.

#### B. Reembolsar sin devolución

- Solo cuando la resolución lo autoriza.
- Se explicita tratamiento de cada comisión.
- Se crea orden idempotente de reembolso.

#### C. Exigir devolución

- No se ejecuta aún el reembolso.
- Se abre el subflujo de devolución con artículo, destino, responsable del costo, método, evidencia, plazo e hito de reembolso.

#### D. Acuerdo entre partes

- Debe constar aceptación verificable de ambos sobre la misma propuesta versionada.
- El resultado financiero debe poder expresarse mediante movimientos soportados. Los reembolsos parciales quedan fuera salvo aprobación explícita en documentos posteriores.
- La doble aceptación no tiene efecto financiero por sí sola: una resolución/confirmación autorizada aplica todas las guardas antes de crear órdenes.

### 13.5 Corrección excepcional

- No se edita ni elimina el fallo anterior.
- Se crea un evento correctivo con autor, motivo, autorización y efecto.
- Si el dinero ya se movió de forma irreversible, la interfaz distingue una compensación de una reversión.
- La apelación ordinaria permanece pendiente de `DP-014`.

## 14. Flujo FL-09 — Devolución

**Trazabilidad:** `RF-DEV-001` a `RF-DEV-008`, `DP-015`, `DP-016`.

### 14.1 Creación

La resolución debe fijar:

- qué bien y accesorios se devuelven;
- destino validado sin exponerlo más de lo necesario;
- quién paga el transporte;
- transportista/modalidad aceptable;
- fecha límite;
- evidencia requerida;
- hito que autoriza el reembolso;
- regla ante inacción o incidencia.

### 14.2 Despacho de devolución

1. El comprador ve instrucciones y fecha límite.
2. Carga evidencia del artículo y empaquetado.
3. Informa transportista, tracking y fecha.
4. El sistema valida y registra el despacho.
5. El vendedor recibe notificación y seguimiento.

### 14.3 Recepción

1. El vendedor confirma recepción y estado dentro del plazo.
2. Si informa un problema, aporta evidencia y se reabre revisión operativa sin ejecutar automáticamente una consecuencia no definida.
3. Si no responde, se aplican recordatorios y la regla de inacción fijada en la resolución.
4. Al cumplirse el hito aprobado en `DP-016`, se inicia el reembolso.

### 14.4 Excepciones

- Tracking inválido o sin movimiento: revisión antes de vencer fondos.
- Paquete rechazado o domicilio incorrecto: operaciones determina responsabilidad con trazabilidad.
- Devolución parcial o artículo distinto: se pausa el movimiento y se solicita evidencia.
- Comprador no despacha: se aplica la consecuencia explícita del fallo; no se infiere.
- Pérdida durante devolución: depende de responsable logístico y política aún por definir.

## 15. Flujo FL-10 — Liberación y reembolso

**Trazabilidad:** `RF-PAG-008` a `RF-PAG-012`.

### 15.1 Orden financiera

Toda orden debe contener:

- operación y tipo de movimiento;
- importe y moneda en unidades menores;
- destinatario funcional;
- causa: confirmación, vencimiento o resolución;
- versión de política y fallo cuando aplique;
- clave de idempotencia estable;
- estado interno, referencia externa e intentos;
- timestamps y conciliación.

### 15.2 Ejecución

1. Una causa válida solicita la orden.
2. El sistema comprueba saldo, retenciones, duplicados y compatibilidad.
3. Registra la intención antes de llamar al proveedor.
4. Envía la instrucción idempotente.
5. Procesa respuesta inmediata como provisional cuando corresponda.
6. Confirma mediante webhook autenticado o consulta autoritativa, siempre correlacionados y reconciliados.
7. Registra asientos y cambia al estado terminal solo al confirmarse.
8. Notifica resultado.

### 15.3 Fallas y recuperación

- Timeout con resultado desconocido: consultar antes de reintentar.
- Respuesta rechazada: conservar causa, alertar y permitir corrección controlada.
- Webhook ausente: reconciliación programada.
- Webhook duplicado: mismo efecto una sola vez.
- Monto inconsistente: bloquear cierre y escalar.
- Reintentos agotados: revisión excepcional; nunca marcar éxito por conveniencia.

## 16. Flujo FL-11 — Calificaciones y reputación

**Trazabilidad:** `RF-REP-001` a `RF-REP-012`, `RN-031` a `RN-034`.

### 16.1 Elegibilidad

- La operación alcanzó un estado terminal elegible.
- El usuario fue comprador o vendedor de esa operación.
- No existe calificación previa del mismo rol.
- La ventana no venció, si se define una.

### 16.2 Formulario

- Escala propuesta de 1 a 5 estrellas, pendiente de `DP-017`.
- Criterios del vendedor: precisión de descripción, preparación/envío y comunicación operacional.
- Criterios del comprador: cumplimiento de pasos, devolución cuando aplique y conducta transaccional.
- Comentario obligatorio con mínimo propuesto de 20 caracteres significativos.
- Vista previa y explicación de publicación.

### 16.3 Validación de calidad

- **VF-REP-001:** no vacío ni solo espacios.
- **VF-REP-002:** no solo emojis, símbolos o caracteres repetidos.
- **VF-REP-003:** cumple longitud significativa configurable.
- **VF-REP-004:** no contiene datos personales detectables ni enlaces prohibidos.
- **VF-REP-005:** no contiene amenazas, discriminación, spam o contenido ilegal según política.
- **VF-REP-006:** el rechazo explica el tipo de problema y permite corregir; no fuerza positividad.

### 16.4 Publicación

- Modelo propuesto: ventana ciega; se publica cuando califican ambos o al vencer el plazo.
- Antes de publicar, la contraparte no ve puntuación ni comentario.
- Moderar oculta el contenido público pero conserva original y decisión.
- Las métricas se recalculan de forma reproducible y separadas por rol.
- Los perfiles con bajo volumen aplican umbrales de privacidad.

## 17. Flujo FL-12 — Dashboards y detalle

**Trazabilidad:** `RF-DAS-001` a `RF-DAS-006`, `RF-PER-003`.

### 17.1 Inicio autenticado

Debe priorizar:

1. acciones vencidas;
2. acciones próximas con fecha;
3. operaciones activas informativas;
4. accesos a compras, ventas y reclamos;
5. actividad completada reciente.

### 17.2 Compras y ventas

Cada fila/tarjeta muestra:

- identificador, título y contraparte;
- rol del usuario;
- monto base y moneda;
- estado legible;
- acción esperada y responsable;
- fecha límite exacta o relativa con acceso a la exacta;
- indicador de reclamo o falla, si aplica.

Filtros: estado, fecha, moneda y rol; búsqueda por identificador o contraparte. La paginación debe ser estable.

### 17.3 Reclamos

Muestra estado, motivo, importe, contraparte, administrador/cola cuando sea publicable, última actividad, fecha límite y acción requerida.

### 17.4 Detalle canónico

Secciones mínimas:

- resumen y acción principal;
- acuerdo original;
- desglose financiero;
- pago y estado de conciliación expresado en lenguaje simple;
- envío/tracking;
- evidencia autorizada;
- disputa/devolución cuando exista;
- línea de tiempo;
- calificación cuando corresponda.

### 17.5 Estados vacíos y privacidad

- Los estados vacíos explican cómo iniciar o esperar una operación.
- No se muestra información de operaciones ajenas ni por enumeración de identificadores.
- El perfil público es una vista separada y minimizada, no una versión parcial del dashboard privado.

## 18. Flujo FL-13 — Administración de políticas

**Trazabilidad:** `RF-ADM-001` a `RF-ADM-005`.

### 18.1 Ciclo de política

1. Administrador autorizado crea borrador.
2. Define ámbito: global, país, moneda, categoría o combinación soportada.
3. Define valores, vigencia y motivo.
4. El sistema valida solapamientos, rangos y precedencia.
5. Se ejecutan ejemplos de simulación.
6. Se revisa el impacto para nuevas operaciones.
7. Se publica con confirmación y, cuando aplique, segunda aprobación.
8. La política se activa en su fecha, sin alterar operaciones congeladas.
9. Retirar una política impide su uso futuro, pero conserva referencias históricas.

### 18.2 Validaciones

- Fecha final posterior a inicial.
- No existen dos políticas activas indistinguibles para el mismo ámbito/hito.
- Porcentajes, fijos, mínimos y máximos producen resultados válidos.
- Moneda de un cargo fijo coincide con el ámbito.
- Los plazos no pueden ser negativos ni generar liberación anterior al aviso.
- País/moneda/categoría referenciados están definidos.
- Todo cambio muestra diff y autor.

### 18.3 Vista efectiva

El administrador debe poder introducir un caso de ejemplo y ver:

- políticas candidatas;
- regla ganadora y precedencia;
- desglose monetario redondeado;
- plazos resultantes;
- textos/plantillas aplicables;
- advertencias o combinaciones no soportadas.

## 19. Flujo FL-14 — Consola de operaciones y auditoría

**Trazabilidad:** `RF-ADM-006` a `RF-ADM-010`.

### 19.1 Búsqueda

Por identificador, referencia externa permitida, correo exacto con permiso, estado, país, moneda, fecha y cola. Los resultados respetan rol y minimización.

### 19.2 Acciones manuales

Cada acción debe:

- comprobar permiso y, si corresponde, autenticación reciente;
- presentar impacto antes de confirmar;
- exigir motivo estructurado y nota;
- pedir doble aprobación sobre umbral;
- utilizar la misma lógica e invariantes que la automatización;
- generar auditoría y notificación cuando corresponda.

No se permite editar directamente un estado, saldo, asiento o evidencia.

### 19.3 Registro de auditoría

Incluye al menos:

- actor humano o sistema y rol efectivo;
- acción, recurso y resultado;
- fecha UTC y correlación;
- antes/después para configuración;
- motivo y aprobaciones;
- origen técnico relevante sin secretos;
- accesos a evidencia sensible.

## 20. Automatizaciones y vencimientos

### 20.1 Reglas generales

- Cada automatización se identifica por operación, tipo e hito para evitar duplicados.
- La ejecución relee estado, política congelada y retenciones.
- Los timestamps se guardan en UTC; el calendario aplicable proviene de política.
- Una tarea fallida se reintenta con backoff y límite; luego alerta.
- Una tarea tardía no ejecuta una acción sin reevaluar condiciones.

### 20.2 Catálogo inicial

| ID | Automatización | Disparador | Resultado esperado |
|---|---|---|---|
| AU-001 | Expirar magic link | Vencimiento | Inutilizar token |
| AU-002 | Expirar solicitud | Fecha límite sin pago válido | Marcar expirada |
| AU-003 | Recordar solicitud | Política | Email/in-app sin extender vigencia |
| AU-004 | Vigilar pago pendiente | Intervalo/timeout | Consultar y conciliar |
| AU-005 | Recordar despacho | Próximo vencimiento | Avisar vendedor |
| AU-006 | Escalar despacho vencido | Vencimiento | Consecuencia definida en `DP-008` |
| AU-007 | Pedir confirmación | Hito de entrega | Avisar comprador |
| AU-008 | Repetir confirmación | Intervalo diario configurable | Máximo configurado |
| AU-009 | Evaluar liberación | Fin de gracia | Liberar o registrar bloqueo |
| AU-010 | Recordar evidencia | Próximo SLA | Avisar parte requerida |
| AU-011 | Escalar disputa | SLA vencido | Cola/alerta operativa |
| AU-012 | Recordar devolución | Próximo vencimiento | Avisar parte requerida |
| AU-013 | Evaluar devolución | Hito/vencimiento | Reembolsar o escalar según fallo |
| AU-014 | Reconciliar movimientos | Programado | Confirmar o alertar diferencias |
| AU-015 | Publicar calificaciones | Ambas recibidas o fin de ventana | Publicar elegibles |

### 20.3 Deduplificación

Una notificación o movimiento generado por tarea debe tener clave estable. Reejecutar la misma tarea no debe duplicar email crítico innecesariamente, asiento, liberación, reembolso ni cambio de estado.

## 21. Notificaciones funcionales

### 21.1 Contenido mínimo

- propósito y estado;
- identificador de operación;
- acción requerida y actor;
- fecha/hora límite y zona;
- enlace seguro a la aplicación;
- canal de ayuda cuando aplique.

No incluir archivos de evidencia, dirección completa, datos de pago ni información antifraude.

### 21.2 Idioma y plantillas

- Cada destinatario recibe su idioma preferido si existe plantilla aprobada.
- El idioma usado queda registrado por envío.
- Una plantilla legal sin traducción aprobada no usa fallback silencioso.
- Cambiar el idioma del usuario afecta comunicaciones futuras, no altera consentimientos históricos.
- La suficiencia de una notificación para autoliberar, el estado de entrega requerido, los rebotes y el fallback provienen exclusivamente de una política aprobada bajo `DP-021`; ausencia de política bloquea esa autoliberación.

### 21.3 Estados de entrega

Preparada, enviada al proveedor, aceptada, entregada, rebotada, queja, fallida. Estos estados no cambian el hecho de negocio; sirven para recuperación y soporte.

## 22. Internacionalización

### 22.1 País y moneda

- El país operativo se selecciona y valida; no se deduce definitivamente por geolocalización.
- La moneda se restringe a las habilitadas para ese país y modelo de pago.
- Todo importe se calcula en unidad menor entera.
- La interfaz muestra símbolo y código cuando el símbolo sea ambiguo.
- No existe conversión propia en el MVP.

### 22.2 Idioma y formato

- Texto de interfaz y emails proviene de catálogos versionados.
- Los datos escritos por usuarios se muestran en su idioma original.
- Fechas, números y moneda usan locale del visor sin cambiar el valor almacenado.
- La línea de tiempo puede mostrar tiempo relativo, pero siempre ofrece instante absoluto con zona.
- Los fallos de traducción técnica se detectan antes del despliegue; no se muestra una clave interna al usuario.

### 22.3 Política por región

La elegibilidad se evalúa con una matriz explícita de país, moneda, proveedor, categoría, límites, idioma legal y estado de lanzamiento. Una combinación incompleta está deshabilitada por defecto.

## 23. Manejo transversal de errores

### 23.1 Principios de interfaz

- Explicar qué ocurrió, qué se conservó y qué puede hacer la persona.
- No culpar al usuario por fallas de proveedor.
- No mostrar trazas, códigos internos, secretos ni estados contradictorios.
- Proporcionar identificador de soporte cuando el problema no sea recuperable en autoservicio.

### 23.2 Clases

| Clase | Comportamiento |
|---|---|
| Validación de entrada | Mantener datos, señalar campo y regla |
| Autorización | Negar sin revelar existencia de recursos ajenos |
| Concurrencia/versión | Recargar estado y explicar que cambió |
| Proveedor temporal | Estado pendiente, reintento seguro y seguimiento |
| Inconsistencia financiera | Bloquear acción, alertar y revisión |
| Archivo inseguro | Rechazar archivo específico y permitir reemplazo |
| Configuración faltante | Deshabilitar combinación; no elegir fallback financiero |
| Traducción legal faltante | Bloquear aceptación para ese idioma/país |

## 24. Reglas de presentación de dinero y plazos

### 24.1 Dinero

Toda pantalla de revisión financiera debe mostrar como mínimo:

```text
Precio del producto                 [monto base]
Comisión del comprador              [monto y criterio]
Otros cargos/impuestos conocidos    [monto o “incluido”]
Total a pagar                       [total comprador]

Comisión del vendedor               [monto y criterio]
Neto estimado a recibir             [neto vendedor]
Moneda                              [código ISO]
```

Si un valor es estimado, debe decir por qué y cuándo se confirmará. No se mezclan monedas en un total.

### 24.2 Plazos

Toda acción crítica muestra:

- fecha y hora exactas;
- zona horaria;
- si son días corridos o hábiles;
- consecuencia del vencimiento;
- posibilidad o no de extensión.

## 25. Casos límite obligatorios

QA y diseño deben contemplar al menos:

1. Comprador y vendedor usan idiomas y zonas horarias diferentes.
2. Solicitud expira mientras el comprador está en Mercado Pago.
3. Pago acreditado llega después de un rechazo o expiración previa.
4. Dos webhooks iguales y otros fuera de orden.
5. Retorno del navegador indica éxito pero el proveedor no acredita.
6. Vendedor intenta enviar antes de acreditación.
7. Evidencia carga parcialmente o contiene malware.
8. Tracking se corrige después de declarar despacho.
9. Reclamo y liberación automática ocurren al mismo tiempo.
10. Comprador confirma dos veces desde dos dispositivos.
11. Administrador falla mientras llega evidencia nueva.
12. Resolución supera saldo disponible o umbral de doble control.
13. Proveedor acepta movimiento pero la respuesta se pierde.
14. Devolución se despacha al límite del plazo.
15. Vendedor no confirma recepción de devolución.
16. Usuario intenta acceder a evidencia de operación ajena.
17. Cambia una comisión después de creada una operación.
18. Se retira una política usada por operaciones activas.
19. Resend rebota un recordatorio crítico.
20. Comentario válido negativo es rechazado indebidamente por moderación.
21. Cuenta se suspende durante una operación activa.
22. Contracargo o revisión de riesgo aparece antes de liberar.
23. Moneda sin decimales o con regla particular de unidad menor.
24. Cierre de operación ocurre antes de publicar calificaciones.

## 26. Criterios de aceptación funcional

### 26.1 Identidad

- **CA-AUT-001:** dado un enlace válido, al consumirlo se crea una sola sesión y un segundo consumo falla de forma segura.
- **CA-AUT-002:** una ruta de retorno externa nunca redirige fuera de dominios permitidos.
- **CA-AUT-003:** el mensaje de solicitud no revela si el correo existe.
- **CA-AUT-004:** abrir o prefetchear el enlace por `GET` no consume el token; solo un `POST` tras interacción crea una sesión.
- **CA-AUT-005:** el token no aparece en logs, analítica, referrers ni requests externos.

### 26.2 Solicitud

- **CA-OPS-001:** una combinación deshabilitada no puede enviarse mediante interfaz ni API.
- **CA-OPS-002:** comprador y vendedor ven el mismo acuerdo y desglose antes del pago.
- **CA-OPS-003:** un cambio de política no altera una operación ya congelada.
- **CA-OPS-004:** doble confirmación crea una sola solicitud enviada.

### 26.3 Pago

- **CA-PAG-001:** el retorno del navegador por sí solo no acredita.
- **CA-PAG-001A:** un webhook autenticado o una consulta autoritativa, correlacionados y reconciliados, pueden acreditar sin exigir que ambos canales ocurran.
- **CA-PAG-002:** webhooks duplicados producen una sola acreditación.
- **CA-PAG-003:** una diferencia de monto o moneda bloquea el envío y alerta.
- **CA-PAG-004:** un pago pendiente nunca muestra al vendedor “enviar ahora”.

### 26.4 Envío y confirmación

- **CA-ENV-001:** no puede declararse envío sin evidencia/campos exigidos por la política.
- **CA-ENV-002:** una corrección de tracking conserva el valor anterior.
- **CA-CON-001:** confirmación válida crea como máximo una orden de liberación.
- **CA-CON-002:** se emite exactamente la cantidad configurada de recordatorios.
- **CA-CON-003:** toda tarea de liberación reevalúa reclamos y retenciones.
- **CA-CON-004:** sin política `DP-021` aprobada y satisfecha para la combinación aplicable, la autoliberación se bloquea y escala.

### 26.5 Disputa y devolución

- **CA-DIS-001:** un reclamo válido antes del límite bloquea la liberación.
- **CA-DIS-002:** ambas partes pueden aportar evidencia y ven la parte compartible de la contraparte.
- **CA-DIS-003:** ningún fallo se confirma sin desglose de todos los importes.
- **CA-DIS-004:** un conflicto declarado impide al administrador fallar.
- **CA-DEV-001:** si el fallo requiere devolución, no se reembolsa antes del hito configurado.
- **CA-DEV-002:** inacción aplica solo la consecuencia escrita en el fallo.

### 26.6 Finanzas

- **CA-FIN-001:** reintentar una liberación o reembolso con resultado desconocido no duplica dinero.
- **CA-FIN-002:** el libro interno reconcilia exactamente monto base, cargos, comisiones y movimientos.
- **CA-FIN-003:** una falla mantiene estado no terminal y genera alerta.

### 26.7 Reputación y administración

- **CA-REP-001:** una operación inelegible no permite calificar.
- **CA-REP-002:** el comentario significativo es obligatorio y la crítica negativa válida puede publicarse.
- **CA-REP-003:** no se revelan calificaciones durante la ventana ciega.
- **CA-REP-004:** una calificación ausente nunca bloquea liberación, reembolso ni cierre, y solo se habilita tras un terminal elegible.
- **CA-ADM-001:** una política nueva afecta solo operaciones dentro de su vigencia.
- **CA-ADM-002:** una acción manual sensible registra actor, motivo, antes/después y aprobaciones.

### 26.8 Internacionalización

- **CA-I18N-001:** el flujo principal funciona completamente en español y portugués brasileño.
- **CA-I18N-002:** montos y fechas se muestran según locale sin cambiar valores contables.
- **CA-I18N-003:** falta de texto legal aprobado bloquea aceptación; no usa fallback silencioso.

### 26.9 Accesibilidad

- **CA-A11Y-001:** todas las páginas críticas de FL-01 a FL-11 y las acciones críticas administrativas de FL-13/14 cumplen WCAG 2.2 AA mediante auditoría automática y revisión manual de teclado, lector de pantalla, foco, reflow y contraste.

## 27. Trazabilidad resumida al PRD

| Área FSD | Requisitos PRD principales |
|---|---|
| FL-01 Acceso | RF-AUT-001..006, RF-PER-001..004 |
| FL-02 Solicitud | RF-OPS-001..011 |
| FL-03 Pago | RF-PAG-001..007 |
| FL-04 Envío | RF-ENV-001..007 |
| FL-05 Confirmación/liberación | RF-CON-001..007, RF-PAG-008..012 |
| FL-06..08 Disputa | RF-DIS-001..015 |
| FL-09 Devolución | RF-DEV-001..008 |
| FL-10 Movimientos | RF-PAG-008..012 |
| FL-11 Reputación | RF-REP-001..012 |
| FL-12 Dashboards | RF-DAS-001..006 |
| FL-13..14 Administración | RF-ADM-001..010 |
| Secciones 20..23 | RF de notificaciones y RNF-004..012 |

## 28. Condiciones para pasar al diseño técnico

Antes de considerar estable este FSD deben resolverse, como mínimo:

1. país y moneda piloto;
2. modelo legal y capacidades verificadas de Mercado Pago;
3. evento de congelación y tratamiento de comisiones;
4. plazos y consecuencias de despacho, confirmación y devolución;
5. reglas KYC/riesgo/contracargo;
6. resultados financieros admitidos, incluidos parciales o no;
7. fórmula y ventana de reputación;
8. SLA operativo y esquema de aprobación de disputas.

El diseño técnico puede avanzar en componentes neutrales —identidad, internacionalización, auditoría, almacenamiento seguro y abstracciones—, pero no debe cerrar estas decisiones mediante código.

## 29. Guía de implementación para Codex

- Citar el identificador funcional correspondiente en pruebas y cambios.
- Implementar permisos en servidor y probar acceso cruzado entre usuarios.
- Modelar tiempo, dinero, políticas y efectos externos como conceptos explícitos.
- No representar un resultado financiero provisional como terminal.
- No usar el retorno del navegador como fuente de verdad de Mercado Pago.
- No sobrescribir acuerdos, evidencia, fallos, políticas ni eventos históricos.
- No crear automatizaciones sin idempotencia y reevaluación de condiciones.
- No inferir valores para `DP-*`; usar configuración o bloquear la ruta hasta que exista aprobación.
- Mantener textos de interfaz y notificaciones fuera de la lógica y listos para localización.
- Diseñar estados de carga, vacío, error, reintento, demora y revisión, además del flujo feliz.

---

### Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.0 | 2026-08-07 | Primera especificación funcional derivada del PRD 0.1.0 |
| 0.1.1 | 2026-08-07 | Coherencia de acreditación, magic link seguro, acuerdos bilaterales, calificación post-cierre, accesibilidad y `DP-021` |
