# 04 — Especificación UX/UI: Compra segura entre particulares

**Estado:** Borrador para diseño e implementación del MVP  
**Versión:** 0.1.1  
**Última actualización:** 2026-08-07  
**Responsable:** Diseño de producto  
**Audiencia:** Producto, Diseño, Contenido, Ingeniería, QA, Operaciones, Riesgo, Legal y Soporte  
**Fuentes normativas:** `01_PRD.md` v0.1.1 y `02_FSD.md` v0.1.1  
**Carácter:** Fuente de verdad de experiencia e interfaz, subordinada al PRD y al FSD

> Este documento define cómo debe comprenderse y operarse el producto. La identidad Yanti está fijada por `DP-001A` y por el sistema ubicado en `brand/`; no fija valores financieros, plazos, países piloto, capacidades legales ni políticas aún abiertas. Toda cifra o conducta dependiente de decisiones pendientes debe provenir de configuración versionada. Ante contradicción prevalece el PRD; luego el FSD; después este documento.

## 1. Propósito y resultado esperado

La interfaz debe permitir que una persona sin conocimientos financieros entienda, en cualquier punto:

1. qué está ocurriendo con su compra, venta, reclamo o dinero;
2. quién debe actuar;
3. cuál es la única acción principal recomendable;
4. hasta qué fecha y hora puede actuar;
5. qué ocurrirá si actúa o si no actúa;
6. qué importes están pagados, retenidos, en proceso, liberados o reembolsados;
7. dónde obtener ayuda sin exponer datos sensibles.

La especificación cubre web responsive mobile-first para comprador, vendedor, soporte/auditor, administrador de operaciones y administrador del sistema.

## 2. Principios de experiencia

### 2.1 Simplicidad radical

- Una acción primaria por vista o bloque decisional.
- Progresión lineal en tareas críticas; la complejidad secundaria se revela cuando hace falta.
- Lenguaje cotidiano: “Pago confirmado” y “Dinero en proceso de devolución”, no estados internos ni jerga del proveedor.
- Máximo una decisión financiera irreversible por pantalla de confirmación.
- Formularios divididos por intención, no por estructura de datos.

### 2.2 Confianza verificable

- El estado nunca depende solo del color o de una animación.
- El acuerdo, el desglose financiero y la línea de tiempo son visibles desde el detalle canónico.
- Una acción irreversible muestra consecuencia, importe, destinatario y condición antes de confirmar.
- No afirmar “dinero seguro”, “escrow”, “garantizado”, “liberado” o “reembolsado” si la situación legal o el proveedor solo permiten un estado provisional (`DP-002`, `DP-003`).

### 2.3 Neutralidad entre partes

- Comprador y vendedor ven el mismo acuerdo congelado.
- Cada parte distingue evidencia compartida, privada para operaciones y solicitada.
- Los mensajes no presuponen fraude ni culpabilidad.
- Las críticas negativas válidas reciben el mismo tratamiento que las positivas.

### 2.4 Acción y vencimiento visibles

- El encabezado de toda operación muestra estado, actor esperado, acción principal y plazo.
- Un plazo relativo (“en 2 días”) siempre permite consultar fecha, hora, zona y consecuencia exactas.
- Los recordatorios no cambian silenciosamente el plazo.

### 2.5 Mobile-first e internacional desde el origen

- El flujo principal funciona a 320 CSS px de ancho sin desplazamiento horizontal.
- El diseño admite expansión de texto de al menos 30% sin truncar acciones o importes.
- Ninguna composición depende de palabras de longitud fija.
- Importe, moneda, fecha, hora y zona se formatean para el locale del visor sin alterar el valor registrado.

### 2.6 Recuperación segura

- Toda falla explica qué se guardó y cómo continuar.
- Reintentar nunca debe sugerir que se duplicará un pago, envío de formulario o movimiento financiero.
- Si el estado cambió en otro dispositivo, se recarga y explica antes de aceptar una nueva acción.

## 3. Modelo mental y arquitectura de información

### 3.1 Objetos que ve el usuario

| Objeto | Descripción en interfaz | No confundir con |
|---|---|---|
| Solicitud | Acuerdo propuesto que aún no tiene pago acreditado | Operación completada |
| Operación | Compra o venta con acuerdo, dinero, envío y cierre | Publicación externa |
| Reclamo | Pedido formal de revisión que detiene la liberación ordinaria | Consulta de soporte |
| Devolución | Flujo ordenado dentro de un reclamo resuelto | Cancelación simple |
| Evidencia | Archivo, texto, tracking o evento presentado con autor y fecha | Chat o almacenamiento personal |
| Calificación | Evaluación elegible de una contraparte tras el cierre | Fallo de disputa |
| Política | Regla versionada que calcula valores o plazos | Edición manual de una operación |

### 3.2 Navegación de participante

**Móvil:** barra inferior con `Inicio`, `Compras`, `Ventas` y `Reclamos`; perfil e idioma en el menú de cuenta. El botón `Nueva solicitud` aparece como acción destacada en Inicio y Ventas, no como quinta pestaña permanente.

**Escritorio:** navegación lateral con los mismos destinos, acción `Nueva solicitud` y menú de cuenta. El contenido conserva jerarquía y orden respecto de móvil.

Una misma persona puede comprar y vender. La navegación no obliga a elegir un rol global: el rol pertenece a cada operación.

### 3.3 Navegación administrativa

- **Operaciones:** bandeja, búsquedas, alertas, pagos, vencimientos y disputas.
- **Disputas:** colas, detalle de revisión, solicitudes de información y resoluciones.
- **Políticas:** catálogo, simulación, borradores, vigencias y publicación.
- **Usuarios:** búsqueda y vista autorizada.
- **Auditoría:** eventos filtrables y exportación, si el permiso y la política lo habilitan.
- **Configuración:** países, monedas, idiomas, categorías, plantillas, integraciones y roles según permiso.

La consola administrativa debe estar visual y técnicamente separada del área de participantes. La disponibilidad de cada destino deriva de RBAC (`RF-ADM-007`, `PE-002`).

## 4. Mapa de pantallas

| ID | Pantalla / vista | Rol principal | Flujo | Requisitos principales |
|---|---|---|---|---|
| UX-00 | Acceso por correo | Todos | FL-01 | RF-AUT-001..004 |
| UX-01 | Continuar magic link / enlace inválido | Todos | FL-01 | RF-AUT-002..003,006 |
| UX-02 | Consentimientos y perfil mínimo | Participante | FL-01 | RF-AUT-005, RF-PER-001 |
| UX-10 | Inicio | Participante | FL-12 | RF-DAS-001..006 |
| UX-11 | Compras | Comprador | FL-12 | RF-DAS-001,004,005 |
| UX-12 | Ventas | Vendedor | FL-12 | RF-DAS-002,004,005 |
| UX-13 | Reclamos | Ambas partes | FL-12 | RF-DAS-003..005 |
| UX-14 | Detalle canónico de operación | Ambas partes | FL-03..12 | RF-OPS-011, RF-DAS-006 |
| UX-20 | Crear solicitud: acuerdo | Vendedor | FL-02 | RF-OPS-001..003 |
| UX-21 | Crear solicitud: dinero y entrega | Vendedor | FL-02 | RF-OPS-003..006 |
| UX-22 | Revisar y enviar solicitud | Vendedor | FL-02 | RF-OPS-004..009 |
| UX-23 | Solicitud enviada | Vendedor | FL-02 | RF-OPS-007,009,011 |
| UX-30 | Revisar acuerdo invitado | Comprador | FL-03 | RF-OPS-004..008 |
| UX-31 | Confirmar aceptación e ir a pagar | Comprador | FL-03 | RF-OPS-008, RF-PAG-001 |
| UX-32 | Resultado/estado de pago | Comprador | FL-03 | RF-PAG-002..004 |
| UX-40 | Declarar envío | Vendedor | FL-04 | RF-ENV-001..003,007 |
| UX-41 | Cargar y revisar evidencia | Vendedor | FL-04 | RF-ENV-001,004,006 |
| UX-42 | Envío declarado | Ambas partes | FL-04..05 | RF-ENV-005, RF-CON-005 |
| UX-50 | Confirmar recepción | Comprador | FL-05 | RF-CON-001..002 |
| UX-51 | Liberación/reembolso en proceso | Ambas partes | FL-05,10 | RF-PAG-008..010 |
| UX-60 | Abrir reclamo | Comprador | FL-06 | RF-DIS-001..004 |
| UX-61 | Detalle de disputa | Ambas partes | FL-07 | RF-DIS-005..007,013 |
| UX-62 | Aportar evidencia/responder | Ambas partes | FL-07 | RF-DIS-005..006,009 |
| UX-63 | Resolución | Ambas partes | FL-08 | RF-DIS-010..015 |
| UX-64 | Proponer/revisar acuerdo de disputa | Ambas partes | FL-07..08 | RF-DIS-010..011 |
| UX-70 | Instrucciones de devolución | Comprador | FL-09 | RF-DEV-001..004 |
| UX-71 | Registrar devolución | Comprador | FL-09 | RF-DEV-003 |
| UX-72 | Confirmar devolución / reportar problema | Vendedor | FL-09 | RF-DEV-005..007 |
| UX-80 | Calificar contraparte | Ambas partes | FL-11 | RF-REP-001..012 |
| UX-81 | Perfil público | Público | FL-11 | RF-PER-003, RF-REP-006..010 |
| UX-90 | Perfil, idioma y privacidad | Participante | FL-01 | RF-PER-001..004 |
| UX-A10 | Bandeja operativa | Admin. operaciones | FL-14 | RF-ADM-006,007,010 |
| UX-A11 | Revisión integral de operación | Admin. operaciones | FL-08,14 | RF-DIS-008..009 |
| UX-A12 | Preparar resolución | Admin. operaciones | FL-08 | RF-DIS-010..014 |
| UX-A13 | Segunda aprobación | Admin. autorizado | FL-08,14 | RF-DIS-012, RF-ADM-007..009 |
| UX-A20 | Catálogo de políticas | Admin. sistema | FL-13 | RF-ADM-001..003 |
| UX-A21 | Editor y simulador de política | Admin. sistema | FL-13 | RF-ADM-002..005 |
| UX-A22 | Publicar política | Admin. sistema | FL-13 | RF-ADM-002,005,008 |
| UX-A30 | Auditoría | Soporte/Admin. | FL-14 | RF-ADM-008..009 |

## 5. Estructura común del detalle canónico (`UX-14`)

Orden obligatorio:

1. **Encabezado de estado:** identificador legible, rol del visor, estado textual, acción requerida y plazo.
2. **Acción principal:** una sola; puede ser pagar, enviar, confirmar, reclamar, responder, devolver, calificar o ninguna.
3. **Resumen de dinero:** monto base, cargos propios, total pagado o neto estimado y estado financiero.
4. **Acuerdo original:** título, condición, descripción, categoría, publicación externa marcada como referencia e imágenes.
5. **Envío y tracking:** transportista, historial de tracking, fecha de despacho, entrega estimada y evidencia compartible.
6. **Reclamo/devolución:** solo si existe; estado, alegaciones, evidencia, solicitudes y resolución.
7. **Línea de tiempo:** eventos relevantes con actor, fecha/hora local y detalle expandible.
8. **Reputación:** acción o estado de calificación cuando corresponda.
9. **Ayuda:** explicación contextual y referencia de soporte.

En móvil, el CTA primario puede permanecer fijo al pie siempre que no cubra contenido, respete zoom y se oculte cuando el teclado esté abierto. En escritorio, se muestra en un panel lateral estable.

### 5.1 Encabezados por estado

| Estado funcional | Título orientado al usuario | Actor/CTA esperado |
|---|---|---|
| Borrador | “Terminá tu solicitud” | Vendedor / Continuar |
| Pendiente de aceptación/pago | “Esperando el pago del comprador” / “Revisá el acuerdo” | Vendedor informativo / Comprador Revisar |
| Pago en proceso | “Estamos confirmando el pago” | Sistema; sin instruir envío |
| Pagada; pendiente de envío | “Pago confirmado. Prepará el envío” | Vendedor / Registrar envío |
| Enviada; pendiente de recepción | “El producto está en camino” | Comprador / Ver tracking, Confirmar o Reclamar |
| Confirmación vencida | “Necesitamos tu confirmación” | Comprador / Confirmar o Reclamar |
| En disputa | “El pago está pausado mientras revisamos el reclamo” | Parte requerida / Responder |
| Devolución requerida | “La resolución requiere una devolución” | Parte requerida / Ver instrucciones |
| Liberación en proceso | “Estamos procesando el pago al vendedor” | Informativo |
| Reembolso en proceso | “Estamos procesando el reembolso” | Informativo |
| Completada | “Operación completada” | Calificar, si es elegible |
| Reembolsada | “Reembolso confirmado” | Calificar, si es elegible |
| Cancelada | “Solicitud cancelada” | Crear nueva, si corresponde |
| Expirada | “La solicitud venció” | Crear nueva, si corresponde |
| Revisión excepcional | “La operación necesita revisión” | Seguir instrucciones / Ayuda |

Los títulos deben adaptarse al rol sin cambiar el hecho de negocio. Un estado en proceso nunca usa el pasado perfecto (“pagado”, “reembolsado”) antes de confirmación reconciliada.

## 6. Especificación pantalla por pantalla

### 6.1 Acceso, consentimiento y perfil (`UX-00` a `UX-02`, FL-01)

**Acceso por correo**

- Logo oficial Yanti en su lockup correspondiente al tema, propuesta de valor breve y campo `Correo electrónico`.
- CTA `Enviarme un enlace`.
- Respuesta neutral: no revela si la cuenta existe.
- Tras enviar, mostrar el correo parcialmente enmascarado, validez configurada y reenvío con espera visible.
- No pedir contraseña ni código salvo que una futura política aprobada modifique el método.

**Enlace inválido, usado o vencido**

- No diferenciar detalles que faciliten abuso más allá de lo útil para recuperarse.
- CTA `Solicitar otro enlace`; enlace secundario `Volver al inicio`.
- La ruta de retorno nunca se muestra ni acepta si es externa.

**Continuación segura del enlace**

- Abrir la URL por `GET` muestra una pantalla mínima de continuación, pero no consume el token ni crea una sesión.
- El token se consume únicamente después de que la persona active `Continuar`, mediante un `POST`.
- La pantalla previa al `POST` no carga analítica, imágenes, fuentes ni recursos externos que puedan recibir la URL o el referrer.
- Prefetch y scanners de correo no deben invalidar el enlace. Tras el consumo, la aplicación retira el token de la URL/historial tan pronto como sea seguro.

**Consentimientos y perfil mínimo**

- Mostrar versión y enlaces de términos/privacidad en el idioma aprobado.
- Separar consentimientos obligatorios de comunicaciones opcionales.
- Campos iniciales: nombre visible, país, idioma y zona horaria; otros solo si política/KYC los exige (`DP-012`).
- Si falta texto legal aprobado para combinación país/idioma, bloquear de manera explícita, no aplicar fallback silencioso.

**Trazabilidad:** `RF-AUT-001..006`, `RF-PER-001..004`, `VF-AUT-001..006`, `CA-AUT-001..005`, `CA-I18N-003`.

### 6.2 Inicio y listados (`UX-10` a `UX-13`, FL-12)

**Inicio** prioriza en este orden:

1. acciones vencidas;
2. acciones próximas;
3. operaciones activas informativas;
4. accesos a compras, ventas y reclamos;
5. actividad terminada reciente.

Cada tarjeta muestra: título, ID legible, rol, contraparte con nombre autorizado, importe + código ISO, estado, actor esperado, plazo y CTA. No usar carruseles para acciones críticas.

**Listados**

- Pestañas o filtros accesibles por estado; filtros adicionales por fecha y moneda.
- Búsqueda por ID o contraparte.
- Orden predeterminado: requiere mi acción, plazo más cercano, actividad reciente.
- Los filtros activos se expresan como texto removible y se conservan al abrir/cerrar un detalle durante la sesión.
- En escritorio puede usarse tabla; en móvil, tarjetas. El contenido y las acciones deben ser equivalentes.
- Paginación estable o carga progresiva con posición recuperable; no scroll infinito para colas administrativas.

**Estados vacíos**

- Compras: “Todavía no tenés compras. Cuando un vendedor te envíe una solicitud, va a aparecer acá.”
- Ventas: “Todavía no creaste solicitudes.” + CTA `Crear solicitud`.
- Reclamos: “No tenés reclamos abiertos ni anteriores.” Sin CTA para crear uno fuera de una operación elegible.

**Trazabilidad:** `RF-DAS-001..006`, `FL-12`, `RNF-002`.

### 6.3 Crear solicitud (`UX-20` a `UX-23`, FL-02)

Flujo recomendado en tres pasos con guardado automático de borrador:

1. **Acuerdo:** correo comprador, país, moneda, categoría, título, descripción/condición, publicación e imágenes exigidas.
2. **Dinero y entrega:** monto base, modalidad habilitada y vista previa de comisiones/plazos efectivos.
3. **Revisión:** acuerdo completo, desglose para ambas partes, vencimiento y declaración de exactitud.

Reglas de interfaz:

- Mostrar progreso por nombre de paso, no solo “1/3”.
- País se selecciona; no queda confirmado por IP. Monedas se filtran por combinación habilitada.
- La ayuda de descripción invita a documentar marca, modelo, estado, defectos y accesorios.
- La URL externa se etiqueta “Referencia de la publicación”; no se importa ni confía en contenido sin control.
- El desglose se recalcula al cambiar monto/ámbito y anuncia el cambio a tecnología asistiva.
- `Enviar solicitud` requiere confirmación final y revalidación. Evitar doble envío deshabilitando el CTA mientras se procesa, sin depender solo de ello para idempotencia.
- Tras enviar: ID, destinatario enmascarado, vencimiento, `Ver operación`, `Reenviar invitación` con límites y `Cancelar solicitud` cuando sea elegible.
- Después de aceptación/pago, no ofrecer edición material; explicar que se debe cancelar y crear otra cuando las reglas lo permitan.

**Trazabilidad:** `RF-OPS-001..011`, `RN-001..012`, `VF/ER de FL-02`, `CA-OPS-001..004`, `DP-005`.

### 6.4 Revisión, aceptación y pago (`UX-30` a `UX-32`, FL-03)

**Revisar acuerdo**

- Mostrar vendedor y enlace a perfil público, acuerdo, condición, imágenes, monto, comisiones del comprador, total, moneda, vencimiento y política aplicable.
- Mostrar neto del vendedor como transparencia, con jerarquía secundaria.
- Casilla/confirmación expresa: “Revisé y acepto estas condiciones”; no preseleccionada.
- CTA `Aceptar e ir a pagar`; secundaria `No continuar` con explicación, sin implicar cancelación si no tiene permiso.

**Transición a Mercado Pago**

- Informar que continuará en el proveedor y volverá a la app.
- No abrir ventana emergente como única opción.
- Conservar retorno seguro y contexto de operación.

**Resultado**

- Retorno del navegador: “Recibimos tu regreso. Estamos confirmando el pago con el proveedor.”
- Pendiente/revisión: explicar que no debe volver a pagar salvo instrucción explícita.
- Rechazado/cancelado: mostrar causa segura, si está disponible, y CTA permitido para reintentar.
- Acreditado: “Pago confirmado”; notificar que el vendedor ya puede enviar.
- Monto/moneda inconsistente o pago tardío: estado de revisión, sin activar envío.

**Trazabilidad:** `RF-PAG-001..007`, `RN-013..014`, `FL-03`, `CA-PAG-001..004`.

### 6.5 Envío y evidencia (`UX-40` a `UX-42`, FL-04)

El vendedor solo ve CTA de envío después de acreditación confirmada.

**Formulario**

- Fecha de despacho.
- Modalidad y transportista entre opciones permitidas.
- Código o URL de tracking según modalidad.
- Fecha estimada de entrega restringida por política; ayuda sobre días corridos/hábiles.
- Archivos exigidos de producto y empaquetado.

**Carga de evidencia**

- Selector de archivos y captura desde cámara como opciones equivalentes.
- Antes de subir: formatos, tamaño máximo, cantidad, privacidad y recomendación de no incluir documentos/direcciones innecesarias.
- Por archivo: nombre accesible, miniatura cuando sea segura, tipo, tamaño, progreso numérico, estado de análisis, reintento y quitar antes de presentar.
- “Subido” no equivale a “aceptado”: distinguir carga, análisis y presentación final.
- Si falla un archivo, conservar los válidos y permitir reemplazar solo el fallido.
- Tras presentar, no permitir reemplazo silencioso. Correcciones crean nueva versión y muestran historial.
- Para videos, miniatura + duración + descarga/visualización autorizada; nunca reproducción automática.

**Confirmación**

- Resumen de tracking, entrega estimada, archivos y quién podrá verlos.
- CTA `Declarar envío`; confirmación explícita.
- Resultado muestra siguiente hito y fecha límite del comprador.

**Trazabilidad:** `RF-ENV-001..007`, `RN-015..017`, `CA-ENV-001..002`, `DP-008..011`, `RNF-007`.

### 6.6 Seguimiento, confirmación y liberación (`UX-42`, `UX-50`, `UX-51`, FL-05/10)

**Comprador** ve tracking, fecha estimada, acuerdo, evidencia compartible y dos acciones claramente diferenciadas:

- primaria `Confirmar que recibí conforme`;
- secundaria de alto impacto `Informar un problema`.

**Confirmación conforme** utiliza una pantalla de revisión, no un modal mínimo:

- confirma recepción y coincidencia sustancial con el acuerdo;
- explica que iniciará la liberación y puede limitar reclamos posteriores;
- muestra importe afectado y estado esperado;
- CTA final inequívoco `Confirmar recepción y liberar el pago` (texto sujeto a validación legal de `DP-002`).

**Inacción/recordatorios**

- Banner visible desde el hito configurado: fecha/hora exactas, cantidad de recordatorios efectiva y consecuencia.
- El último recordatorio debe distinguirse por texto, no solo color.
- Si existe retención, no prometer una fecha de liberación como cierta.
- Mostrar el estado real del aviso —preparado, aceptado, entregado, rebotado o fallido— solo cuando sea publicable y sin afirmar entrega por una mera aceptación del proveedor.
- La autoliberación solo puede presentarse como programada si existe una política `DP-021` aprobada y satisfecha para país/canal. Si falta o un rebote/falla incumple la política, mostrar `Necesita revisión`; no prometer liberación automática.

**Movimientos en proceso**

- Mostrar “en proceso” hasta confirmación reconciliada.
- Incluir última actualización, qué debe hacer el usuario (usualmente nada) y plazo orientativo solo si está aprobado.
- En falla recuperable: “No se completó todavía”, referencia de soporte y sin ofrecer reintento financiero libre al participante.

**Trazabilidad:** `RF-CON-001..007`, `RF-PAG-008..012`, `RN-018..022`, `CA-CON-001..003`, `CA-FIN-001..003`.

### 6.7 Abrir y gestionar reclamo (`UX-60` a `UX-63`, FL-06..08)

**Apertura**

- Solo desde una operación elegible.
- Paso 1: motivo configurable; mínimo: no recibido, distinto, daño, faltantes, condición no declarada y otro.
- Paso 2: relato guiado y evidencia mínima específica del motivo.
- Paso 3: revisión de alegación, archivos, fecha límite, efecto de pausa y comisión de reclamo si aplica.
- La comisión muestra base, monto, momento de cobro y tratamiento conocido; si `DP-006/007` no está resuelto, no se debe habilitar una conducta financiera inventada.
- CTA final `Abrir reclamo`; indicar que la contraparte podrá ver la información compartible.

**Detalle de disputa**

- Encabezado de estado y plazo más próximo.
- Alegación inicial inmutable.
- Línea de tiempo procesal.
- Dos colecciones diferenciadas: `Evidencia compartida con las partes` y `Información privada de operaciones`.
- Solicitudes administrativas con destinatario, requisito, vencimiento, estado y CTA.
- Área de respuesta estructurada; no convertirla en chat general.
- Evidencia de la contraparte accesible de forma equitativa, salvo ocultamiento fundamentado.

**Propuesta de acuerdo (`UX-64`)**

- `Proponer un acuerdo` abre una pantalla separada con resultado, asignación completa de importes, requisitos, vencimiento y versión.
- Si el vendedor elige “aceptar la pretensión”, la interfaz lo expresa como `Proponer aceptar el reclamo`; no usa `Resolver`, `Reembolsar` ni `Liberar`.
- La contraparte ve la misma versión y puede `Aceptar esta propuesta` o `Rechazarla`. Cualquier edición crea una versión nueva e invalida aceptaciones previas.
- Antes de aceptar se explica: “Aceptar no mueve dinero todavía. La propuesta debe ser aceptada por ambas partes y validada como resolución.”
- Tras doble aceptación, el estado es `Acuerdo pendiente de validación`; la retención permanece y no se muestra éxito financiero hasta la resolución/confirmación autorizada.
- Si el contrato de doble aceptación no está implementado, estas acciones permanecen ocultas y no se sustituye por texto libre.

**Resolución para participantes**

- Resultado en lenguaje neutral.
- Motivo estructurado + explicación.
- Destino separado de monto base, comisión comprador, comisión vendedor, comisión reclamo y devolución.
- Requisitos pendientes, actor y fecha límite.
- Autor/fecha en grado permitido; no exponer datos internos.
- Si exige devolución, CTA `Ver instrucciones de devolución`; no presentar el reembolso como completado.

**Trazabilidad:** `RF-DIS-001..015`, `RN-023..030`, `FL-06..08`, `CA-DIS-001..004`, `DP-006..007`, `DP-014..016`.

### 6.8 Devolución (`UX-70` a `UX-72`, FL-09)

**Instrucciones** deben mostrar:

- qué artículos/accesorios devolver;
- destino validado, minimizado hasta que corresponda;
- método permitido;
- quién paga el envío según resolución;
- fecha/hora límite y consecuencia escrita;
- evidencia requerida;
- hito que habilitará el reembolso.

**Comprador registra devolución** mediante tracking, transportista, fecha y evidencia de empaquetado. La confirmación repite el destino y el hito financiero.

**Vendedor recibe devolución** y elige:

- `Confirmar recepción`, con revisión de consecuencia;
- `Reportar un problema`, con motivo y evidencia.

Si una parte no actúa, mostrar solo la consecuencia congelada en la resolución. Nunca improvisar un reembolso o liberación (`RF-DEV-006/007`).

**Trazabilidad:** `RF-DEV-001..008`, `RN-026..028`, `FL-09`, `CA-DEV-001..002`, `DP-015..016`.

### 6.9 Calificación y perfil público (`UX-80`, `UX-81`, FL-11)

**Formulario de calificación**

- Disponible solo después del cierre financiero, para operación/rol terminal elegible.
- La calificación es una acción posterior e independiente: no completar el formulario jamás bloquea, retrasa o condiciona liberación, reembolso o cierre.
- Escala y criterios se cargan desde política; la propuesta 1–5 no se trata como definitiva (`DP-017`).
- Criterios según rol, no una etiqueta genérica.
- Comentario obligatorio con contador de caracteres significativos y reglas visibles.
- Validación objetiva: vacío, solo emojis/símbolos, repetición, enlaces, datos personales y abuso; no “positividad”.
- Error en línea explica cómo corregir sin borrar el texto.
- Antes de enviar, explicar publicación ciega/ventana solo si esa política fue aprobada.

**Perfil público**

- Nombre visible, antigüedad redondeada, reputación separada como comprador/vendedor cuando haya volumen suficiente, cantidad de operaciones elegibles y comentarios publicables.
- Estados de muestra insuficiente: “Aún no hay suficientes operaciones para mostrar esta métrica.”
- No mostrar correo, documentos, domicilio, datos de pago, evidencia, montos individuales ni motivos privados de disputa.
- Denunciar comentario disponible; la moderación conserva el original y no altera la calificación sin regla aprobada.

**Trazabilidad:** `RF-REP-001..012`, `RN-031..034`, `VF-REP-001..006`, `CA-REP-001..004`, `DP-017..018`.

### 6.10 Perfil privado (`UX-90`)

- Nombre visible, correo verificado con flujo separado de cambio, país, idioma y zona horaria.
- Explicar qué información es pública mediante vista previa.
- Preferencias de comunicación no pueden desactivar avisos transaccionales obligatorios.
- Cuenta restringida: mostrar acciones disponibles y soporte, no controles antifraude.
- Privacidad: acceso a solicitudes de derechos y política de conservación cuando se definan; no prometer borrado de registros legalmente conservables.

## 7. Consola administrativa

### 7.1 Bandeja operativa (`UX-A10`)

- Resumen de alertas: webhooks fallidos, pagos no conciliados, automatizaciones vencidas, movimientos fallidos y disputas fuera de SLA.
- Filtros por ID, referencia externa permitida, correo exacto con permiso, estado, país, moneda, fecha y cola.
- Columnas configuradas por rol; datos sensibles enmascarados por defecto.
- Orden por riesgo operativo/SLA; no solo actividad reciente.
- Selección masiva no permite movimientos de dinero, fallos ni cambios de estado.

### 7.2 Revisión integral (`UX-A11`)

Disposición recomendada en escritorio:

- columna principal: acuerdo, cronología, alegaciones, evidencia y solicitudes;
- panel lateral: identidad/rol autorizado, dinero, retenciones, SLA y acciones permitidas;
- historial financiero y auditoría como secciones separadas.

Debe distinguir con etiquetas persistentes:

- dato presentado por comprador;
- dato presentado por vendedor;
- hecho verificado por sistema/proveedor;
- nota interna;
- información oculta a las partes con motivo.

El administrador no puede editar originales. Descargar/ver evidencia sensible registra acceso. Un conflicto declarado deshabilita `Resolver` y ofrece `Reasignar`.

### 7.3 Preparar resolución y aprobación (`UX-A12`, `UX-A13`)

Flujo en pasos:

1. elegir resultado permitido;
2. introducir motivo estructurado y explicación para las partes;
3. asignar por separado todos los importes/comisiones/costos;
4. definir requisitos y plazos si hay devolución;
5. revisar impacto, retenciones, saldo y política;
6. confirmar o enviar a segunda aprobación.

La pantalla final muestra un resumen de antes/después. La acción irreversible exige autenticación reciente cuando corresponda, motivo y confirmación textual inequívoca. Si supera umbral, el primer administrador no puede autoaprobar.

### 7.4 Políticas (`UX-A20` a `UX-A22`)

**Catálogo:** ámbito, versión, estado, vigencia, autor y solapamientos. Estados `Borrador`, `Programada`, `Activa`, `Retirada` con texto e icono.

**Editor/simulador:**

- ámbito global/país/moneda/categoría o combinación soportada;
- valores y vigencias;
- motivo obligatorio;
- validación de rango, moneda y solapamiento;
- ejemplos con monto, comisión comprador, total, comisión vendedor, neto, plazos y regla ganadora;
- diff contra versión previa.

**Publicación:** muestra alcance, fecha efectiva, impacto solo en nuevas operaciones según hito aprobado y advertencia de no retroactividad. No incluir un botón genérico `Guardar` para publicar; usar `Guardar borrador` y `Publicar política` separados.

### 7.5 Auditoría (`UX-A30`)

- Filtros por actor, rol efectivo, acción, recurso, resultado, fecha y correlación.
- Evento expandible con antes/después, motivo, aprobaciones y origen técnico sin secretos.
- Timestamps en UTC y representación local explícita.
- La interfaz no ofrece editar o eliminar eventos.
- Exportación, si existe, requiere permiso, queda auditada y aplica minimización.

**Trazabilidad administración:** `RF-ADM-001..010`, `RF-DIS-008..015`, `PE-002..006`, `FL-08`, `FL-13`, `FL-14`, `CA-ADM-001..002`.

## 8. Sistema visual de producto y componentes

La marca se define en `brand/` conforme a `DP-001A`: master B Organic, paleta A11 Cyan-Turquoise + Coral, wordmark delineado y variantes para modo claro/oscuro. Los contratos semánticos siguientes siguen siendo obligatorios. Los colores vivos de identidad no reemplazan los tokens funcionales accesibles ni los colores de estado.

### 8.1 Jerarquía visual

- Tipografía sans serif legible, con métricas apropiadas para español y portugués.
- Escala mínima recomendada: cuerpo 16 px, ayuda 14 px, títulos mediante tokens; zoom al 200% sin pérdida.
- Espaciado basado en múltiplos consistentes; densidad cómoda en participantes y compacta controlada en admin.
- Contenedores con ancho de lectura; formularios no ocupan toda la pantalla en escritorio.
- Importes y códigos de operación usan cifras tabulares cuando ayude a comparar.

### 8.2 Tokens semánticos requeridos

- `surface/default`, `surface/subtle`, `surface/elevated`.
- `text/primary`, `text/secondary`, `text/inverse`, `text/link`.
- `border/default`, `border/strong`, `focus`.
- `action/primary`, `action/secondary`, `action/destructive`.
- `status/info`, `status/success`, `status/warning`, `status/danger`, cada uno con fondo, texto, borde e icono accesibles.

Los estados financieros pendientes usan `info` o `warning` según acción, nunca `success`. La decisión final de paleta debe cumplir contraste.

### 8.3 Componentes obligatorios

- Encabezado de operación.
- Tarjeta de acción requerida.
- Desglose de dinero.
- Plazo/deadline con consecuencia.
- Badge de estado con icono + texto.
- Línea de tiempo.
- Paso/progreso de formulario.
- Campo, ayuda, error y contador.
- Selector de país/moneda/categoría.
- Cargador y galería de evidencia.
- Visor autorizado de evidencia.
- Tracking con historial.
- Banner y aviso en línea.
- Modal/diálogo solo para confirmaciones breves; página de revisión para movimientos irreversibles.
- Toast para confirmaciones no críticas; nunca como único registro de éxito/error financiero.
- Tabla accesible y tarjeta equivalente.
- Filtros, búsqueda y paginación.
- Skeleton de estructura, spinner con etiqueta y barra de progreso.

### 8.4 Acciones destructivas o irreversibles

- Diferenciar visualmente sin depender solo del rojo.
- Nombrar la consecuencia: `Cancelar solicitud`, `Confirmar recepción y liberar`, `Emitir resolución`.
- Describir qué no puede deshacerse.
- No usar patrones engañosos, doble negación ni opciones preseleccionadas.
- Mantener foco dentro del diálogo y devolverlo al disparador al cerrar.

## 9. Presentación de dinero

### 9.1 Contrato de visualización

Toda revisión financiera muestra:

```text
Precio del producto                 [monto base]
Comisión del comprador              [monto y criterio]
Otros cargos/impuestos conocidos    [monto o “incluido”]
Total a pagar                       [total comprador]

Comisión del vendedor               [monto y criterio]
Neto estimado a recibir             [neto vendedor]
Moneda                              [código ISO]
```

- Usar símbolo local más código ISO cuando el símbolo sea ambiguo: `$ 10.000 ARS`.
- No mezclar monedas dentro de un total.
- No usar decimales fijos: respetar unidad menor de la moneda.
- Alinear importes para comparación, pero conservar lectura lineal correcta con lector de pantalla.
- “Estimado” debe incluir causa y momento esperado de confirmación.
- Comisiones cero se muestran como `Sin cargo` o monto cero según contexto; no se omiten si afectan comparación.
- Nunca presentar saldo del proveedor como saldo bancario disponible sin confirmación.

### 9.2 Estados financieros

| Estado | Texto recomendado | Evitar |
|---|---|---|
| Inicio | “Pago iniciado” | “Pagado” |
| Confirmación | “Estamos confirmando el pago” | “Casi listo” sin detalle |
| Acreditado | “Pago confirmado” | “Dinero garantizado” |
| Liberación pendiente | “Pago al vendedor en proceso” | “Vendedor cobró” |
| Reembolso pendiente | “Reembolso en proceso” | “Dinero devuelto” |
| Fallo | “Todavía no pudimos completar…” | “Error 502” |
| Confirmado | “Liberación confirmada” / “Reembolso confirmado” | Estado provisional |

## 10. Presentación de fechas y vencimientos

- Formato localizado, con mes escrito cuando reduce ambigüedad.
- Mostrar fecha y hora exactas, zona, tipo de días y consecuencia.
- Ejemplo ES: `Tenés tiempo hasta el 18 de agosto de 2026, 18:00 (GMT−3). Son días corridos.`
- Ejemplo pt-BR: `Você tem até 18 de agosto de 2026, 18h (GMT−3). São dias corridos.`
- Tiempo relativo puede acompañar: `en 2 días`, nunca reemplazar lo exacto en decisiones críticas.
- Cuenta regresiva se actualiza sin anunciar cada segundo; anunciar cambios significativos como día/hora restante.
- Si la fecha depende de `DP-008..010` o `DP-014..016`, la interfaz recibe el valor calculado; no lo calcula con constantes propias.
- Si no existe fecha confirmada, decir `Fecha pendiente de confirmación`, no mostrar guiones ambiguos.

## 11. Estados transversales

### 11.1 Carga

- Skeleton solo cuando refleja estructura conocida; no simula datos financieros.
- Operaciones mayores a 1 segundo muestran etiqueta de actividad.
- Carga de archivos muestra porcentaje individual y general.
- En acciones no idempotentes, bloquear reenvío visualmente y comunicar “Estamos procesando”; la seguridad real permanece en servidor.

### 11.2 Vacío

Un estado vacío debe decir qué falta, por qué está vacío y cuál es el siguiente paso permitido. No usar ilustraciones que desplacen la explicación o infantilicen disputas.

### 11.3 Error

Estructura de mensaje:

1. qué ocurrió en lenguaje simple;
2. qué datos/acción se conservaron;
3. qué puede hacer ahora;
4. referencia de soporte si no es recuperable.

Errores de campo aparecen junto al campo y en resumen al inicio tras enviar. El foco se mueve al resumen; cada enlace lleva al campo.

### 11.4 Éxito

- Confirmar el hecho exacto y el próximo paso.
- Persistir éxitos financieros en la página, no solo en toast.
- Ejemplo: “Solicitud enviada. Le enviamos un enlace al comprador. Vence el [fecha configurada].”

### 11.5 Pendiente o revisión

- Usar un estado explícito separado de éxito/error.
- Mostrar última actualización y actor esperado.
- No pedir repetir pago ni movimiento financiero con resultado desconocido.

### 11.6 Sin conexión o sesión vencida

- Conservar borradores locales solo si no incluyen evidencia sensible o tokens y la política lo permite.
- Al recuperar sesión, revalidar estado antes de presentar.
- Si la sesión vence durante una carga, explicar qué archivos llegaron y cuáles deben repetirse.

## 12. Contenido y microcopy crítico ES / pt-BR

Los textos son ejemplos funcionales, no traducciones legales aprobadas. Los avisos legales requieren catálogo versionado y aprobación por país.

| Contexto | Español | Português (Brasil) |
|---|---|---|
| Acceso | “Ingresá tu correo y te enviaremos un enlace seguro para entrar.” | “Informe seu e-mail e enviaremos um link seguro para entrar.” |
| Respuesta neutral | “Si podemos enviar el enlace a esa dirección, lo vas a recibir en unos minutos.” | “Se pudermos enviar o link para esse endereço, você o receberá em alguns minutos.” |
| Pago pendiente | “Estamos confirmando tu pago. No vuelvas a pagar.” | “Estamos confirmando seu pagamento. Não pague novamente.” |
| Pago confirmado | “Pago confirmado. Le avisamos al vendedor que ya puede enviar.” | “Pagamento confirmado. Avisamos ao vendedor que ele já pode fazer o envio.” |
| No enviar aún | “Todavía no envíes el producto. El pago no está confirmado.” | “Ainda não envie o produto. O pagamento não foi confirmado.” |
| Envío | “Cargá pruebas del producto y del embalaje antes de declarar el envío.” | “Envie provas do produto e da embalagem antes de declarar o envio.” |
| Confirmación | “Confirmá solo si recibiste el producto y coincide con lo acordado.” | “Confirme somente se você recebeu o produto e ele corresponde ao combinado.” |
| Consecuencia | “Al confirmar, iniciaremos la liberación del pago al vendedor.” | “Ao confirmar, iniciaremos a liberação do pagamento ao vendedor.” |
| Recordatorio | “Necesitamos que confirmes la recepción o informes un problema antes del [fecha].” | “Precisamos que você confirme o recebimento ou informe um problema até [data].” |
| Reclamo | “Abrir un reclamo pausa la liberación mientras revisamos la evidencia.” | “Abrir uma reclamação pausa a liberação enquanto analisamos as provas.” |
| Evidencia compartida | “La otra parte podrá ver este archivo.” | “A outra parte poderá ver este arquivo.” |
| Solicitud admin | “Necesitamos información adicional antes del [fecha].” | “Precisamos de informações adicionais até [data].” |
| Reembolso pendiente | “El reembolso está en proceso. Te avisaremos cuando el proveedor lo confirme.” | “O reembolso está em processamento. Avisaremos quando o provedor confirmar.” |
| Devolución | “El reembolso se iniciará cuando se cumpla esta condición: [hito de la resolución].” | “O reembolso será iniciado quando esta condição for cumprida: [marco da decisão].” |
| Comentario inválido | “Contá qué ocurrió con palabras propias. No incluyas datos personales ni enlaces.” | “Conte o que aconteceu com suas próprias palavras. Não inclua dados pessoais nem links.” |
| Error recuperable | “No pudimos completar la acción. Conservamos tus datos; intentá de nuevo.” | “Não foi possível concluir a ação. Seus dados foram mantidos; tente novamente.” |
| Revisión excepcional | “La operación necesita una revisión. No tenés que repetir el pago.” | “A operação precisa de análise. Você não precisa pagar novamente.” |

### 12.1 Reglas editoriales

- Tratar de `vos` en español rioplatense solo si esa variante es la aprobada; de lo contrario usar una variante regional neutral. El catálogo no mezcla `tú`, `usted` y `vos` dentro de una experiencia.
- En pt-BR usar `você`; evitar traducciones literales de términos financieros.
- Frases breves, activas y con actor explícito.
- No usar “Oops”, humor ni celebraciones en reclamos, fallas o dinero pendiente.
- No usar mayúsculas completas para urgencia.
- Los botones comienzan con verbo y describen resultado.
- Los textos escritos por usuarios no se traducen automáticamente ni se presentan como contenido de la plataforma.

## 13. Internacionalización y localización

### 13.1 Requisitos de implementación visibles

- Todo texto proviene de claves semánticas fuera de la lógica; no concatenar frases.
- Admitir pluralización y género sin incrustar el orden español.
- Probar ES y pt-BR como mínimo (`CA-I18N-001`), además de pseudo-localización con expansión.
- Formatos mediante locale BCP 47 y moneda ISO 4217; almacenamiento no cambia.
- Nombres propios, tracking y evidencia permanecen en idioma original.
- El idioma del destinatario determina notificaciones futuras; el idioma de aceptación histórica no cambia.
- Si no existe traducción legal aprobada, bloquear el flujo afectado, no aplicar fallback.
- Selector de idioma usa nombre autóctono: `Español`, `Português (Brasil)`.

### 13.2 País, moneda y zona

- País operativo siempre se selecciona y confirma.
- Solo se ofrecen monedas/proveedores/categorías habilitados para esa matriz.
- No mostrar conversión si el MVP no la soporta (`DP-004`).
- La zona horaria del usuario puede diferir de la operación: mostrar la local y permitir ver la de referencia.
- Direcciones y teléfonos, si se incorporan por KYC/devolución, usan formatos y validación por país sin excluir variaciones válidas.

## 14. Accesibilidad — WCAG 2.2 AA

WCAG 2.2 AA es un requisito binario para las páginas críticas del MVP: `UX-00..02`, `UX-14`, `UX-20..23`, `UX-30..32`, `UX-40..42`, `UX-50..51`, `UX-60..64`, `UX-70..72`, `UX-80`, y las acciones administrativas críticas `UX-A11..13`, `UX-A21..22` y `UX-A30`. Un incumplimiento AA en ese alcance bloquea la aceptación salvo corrección; no se trata como aspiración.

### 14.1 Perceptible

- Contraste de texto normal ≥ 4.5:1; texto grande ≥ 3:1; componentes y foco ≥ 3:1.
- No comunicar estado, parte procesal o urgencia solo mediante color.
- Texto alternativo funcional para imágenes informativas; evidencia requiere descripción proporcionada o contexto de archivo, sin inventar su contenido.
- Videos subidos no se reproducen automáticamente; los videos de ayuda propios requieren subtítulos.
- Contenido conserva significado con zoom 200% y reflow a 320 CSS px.

### 14.2 Operable

- Todo es utilizable por teclado, sin trampas de foco.
- Orden de foco coincide con el visual; foco visible y no oculto por barras fijas.
- Objetivos táctiles al menos 24×24 CSS px; preferencia de producto 44×44 para acciones principales.
- No exigir gestos complejos; cargar evidencia funciona con selector estándar.
- Los límites de tiempo informan y permiten extensión cuando la regla legal/operativa lo autoriza; no prometer extensión si no existe.
- `Esc` cierra diálogos no críticos; una acción financiera en proceso no se cancela por cerrar la vista.

### 14.3 Comprensible

- `lang` correcto en documento y fragmentos de otro idioma.
- Etiquetas persistentes; placeholder no sustituye label.
- Errores identifican campo, causa y corrección; entrada válida se conserva.
- Las confirmaciones críticas repiten consecuencia y monto.
- Navegación, nombres y orden son consistentes entre roles equivalentes.

### 14.4 Robusto

- HTML semántico antes que ARIA.
- Encabezados jerárquicos, landmarks y título de página específico.
- Mensajes dinámicos usan live regions con prioridad adecuada; no anuncian progreso excesivo.
- Tablas administrativas incluyen caption y encabezados asociados.
- Inputs tienen nombre, descripción, error y estado programático.
- Componentes personalizados exponen nombre, rol, valor y estado.

### 14.5 Pruebas mínimas

- Teclado completo y foco visible.
- NVDA + Chrome/Firefox en Windows; VoiceOver + Safari en iOS/macOS según matriz soportada.
- Zoom 200% y 400% donde aplique; 320 px de ancho.
- Alto contraste de Windows y `prefers-reduced-motion`.
- ES y pt-BR con lector de pantalla.
- Formularios críticos con errores, archivos, diálogos y actualizaciones asíncronas.

## 15. Responsive y dispositivos

### 15.1 Breakpoints por comportamiento

No prescribir medidas de framework. Definir al menos:

- **Compacto:** una columna, navegación inferior, CTA seguro al pie, tarjetas en listados.
- **Medio:** una o dos columnas según tarea; formularios conservan ancho de lectura.
- **Amplio:** navegación lateral; detalle con contenido + panel de acción; administración con tabla y panel lateral.

### 15.2 Reglas

- Sin scroll horizontal en flujos de participante.
- Tablas administrativas pueden usar contenedor horizontal accesible, con primera columna/acciones comprensibles y alternativa de detalle.
- Teclado móvil no tapa campos, errores ni CTA.
- Captura de cámara es opcional, nunca única.
- En conexiones lentas, priorizar texto/estado antes que miniaturas.
- Respetar áreas seguras de dispositivos y orientación.

## 16. Privacidad y seguridad en interfaz

- Enmascarar correo, documentos, direcciones y referencias externas según rol/contexto.
- El perfil público es una vista propia y minimizada; no un dashboard privado recortado.
- En emails no incluir evidencia, domicilio completo, datos de pago ni señales antifraude.
- Enlaces externos muestran dominio y advertencia; abrirlos no debe exponer tokens ni referrer sensible.
- Archivos de evidencia se leen o descargan mediante un gateway autenticado que revalida sesión, actor, recurso y visibilidad y audita el acceso. Las URLs firmadas bearer se reservan para carga; lectura directa solo si una decisión de riesgo explícita acepta su no vinculación al usuario y define controles compensatorios.
- Previsualizaciones eliminan metadatos sensibles cuando corresponda sin alterar el original preservado.
- La interfaz administrativa indica cuando un acceso sensible queda auditado.
- Copiar ID de operación está permitido; copiar datos sensibles requiere permiso y, si se implementa, auditoría.
- Autocompletado se configura según sensibilidad; tokens y datos financieros nunca persisten en almacenamiento inseguro.
- Mensajes de autorización no confirman la existencia de operaciones ajenas.

**Trazabilidad:** `RF-PER-003..004`, `RF-DIS-006`, `RF-ADM-007..008`, `PE-006`, `RNF-006..008`, `RNF-012`.

## 17. Notificaciones y continuidad multicanal

### 17.1 Centro in-app

- Agrupar por operación y ordenar por acción/plazo.
- Leído/no leído no equivale a acción resuelta.
- Cada aviso enlaza al detalle autenticado; no ejecuta acciones críticas desde el email.
- Evitar duplicar múltiples avisos visuales por el mismo hito idempotente.

### 17.2 Email con Resend

Plantilla mínima:

- propósito/estado;
- ID de operación;
- acción y actor;
- fecha/hora/zona;
- CTA seguro a la app;
- ayuda.

La app no presenta “email entregado” como hecho si Resend solo lo aceptó. Rebotes críticos deben ser visibles a operaciones y ofrecer recuperación autorizada. El idioma usado queda registrado. Los criterios de suficiencia, rebote y fallback para autoliberación provienen de `DP-021`; sin política aplicable, la UI presenta revisión y no una cuenta regresiva de liberación cierta.

### 17.3 Eventos mínimos con diseño propio

Magic link, invitación, pago confirmado, pago pendiente/fallido, despacho habilitado, despacho declarado, recordatorios de recepción, liberación/reembolso confirmado o fallido, reclamo abierto, respuesta/evidencia, solicitud adicional, resolución, devolución y calificación.

**Trazabilidad:** sección 13 del PRD, sección 21 del FSD, `AU-001..015`.

## 18. Analítica UX y privacidad

Eventos de interfaz deben vincularse a los eventos de producto del PRD sin registrar:

- tokens de magic link;
- textos libres, comentarios o alegaciones;
- contenido/nombre de archivos;
- correo completo, dirección, documentos o datos de pago;
- URLs externas con parámetros sensibles.

Mediciones mínimas:

- inicio/fin/abandono y error por paso de solicitud, pago, envío, reclamo, devolución y calificación;
- tiempo hasta comprender/ejecutar acción requerida;
- tasa de reintento por carga de evidencia;
- accesibilidad: errores de validación y recuperación, no atributos de discapacidad;
- idioma/locale y tipo de dispositivo en nivel agregado.

## 19. Criterios UX verificables

### 19.1 Comprensión y acción

- **CUX-001:** en cada estado de `UX-14`, una prueba automatizada verifica presencia de estado textual, actor esperado, acción principal o explicación de ausencia, y fecha/consecuencia cuando existe plazo.
- **CUX-002:** ningún participante recibe instrucción de envío cuando el pago no está acreditado (`CA-PAG-004`).
- **CUX-003:** todo estado financiero provisional contiene “en proceso”, “confirmando” o equivalente localizado y no usa el estilo semántico de éxito.
- **CUX-004:** un movimiento irreversible requiere una vista de revisión con importe, destinatario/resultado y consecuencia.
- **CUX-005:** cambiar estado en otra sesión provoca revalidación y mensaje antes de ejecutar una acción obsoleta.
- **CUX-005A:** una operación solo muestra autoliberación programada cuando la política `DP-021` está aprobada y satisfecha; en ausencia o falla se muestra revisión.

### 19.2 Formularios y evidencia

- **CUX-006:** un error conserva campos válidos y enfoca un resumen enlazado al primer campo inválido.
- **CUX-007:** la carga parcial permite reintentar solo archivos fallidos y diferencia `cargando`, `analizando`, `aceptado` y `presentado`.
- **CUX-008:** una corrección de tracking/evidencia muestra el valor anterior y no lo sustituye silenciosamente.
- **CUX-009:** la apertura de reclamo muestra costo efectivo y efecto de pausa antes de confirmar; si la política necesaria falta, el CTA queda bloqueado con explicación.
- **CUX-010:** un comentario negativo que cumple validaciones objetivas puede enviarse (`CA-REP-002`).
- **CUX-010A:** proponer/aceptar un acuerdo de disputa no cambia el estado financiero, conserva versión y requiere doble aceptación más resolución/confirmación autorizada.
- **CUX-010B:** la calificación solo aparece tras el cierre terminal elegible y su omisión no bloquea ninguna transición financiera.

### 19.3 Internacionalización

- **CUX-011:** FL-01 a FL-12 se completan en ES y pt-BR sin claves, fallback legal silencioso ni texto cortado.
- **CUX-012:** el layout soporta expansión de texto del 30% y pseudo-localización.
- **CUX-013:** cada importe crítico muestra código ISO cuando el símbolo es ambiguo y reconcilia visualmente con el desglose.
- **CUX-014:** cada plazo crítico muestra fecha, hora, zona, tipo de días y consecuencia.
- **CUX-015:** el contenido generado por usuarios conserva idioma original y se identifica como tal.

### 19.4 Accesibilidad

- **CUX-016:** flujos principales pasan auditoría automática sin errores WCAG A/AA y revisión manual de teclado/lector de pantalla.
- **CUX-017:** interfaz de participante funciona a 320 px y zoom 200% sin pérdida de contenido/acción ni scroll horizontal.
- **CUX-018:** estados, errores y evidencia no dependen solo de color; contraste cumple 2.2 AA.
- **CUX-019:** foco no queda cubierto por cabeceras/CTA fijos y retorna correctamente tras diálogos.
- **CUX-020:** actualizaciones asíncronas críticas se anuncian una vez con contexto suficiente.

### 19.5 Privacidad y administración

- **CUX-021:** perfil público no revela correo, domicilio, documentos, pagos, evidencia ni montos individuales.
- **CUX-022:** acceso no autorizado devuelve mensaje no enumerativo.
- **CUX-023:** descargar/ver evidencia administrativa sensible genera evento auditable y se comunica al administrador.
- **CUX-024:** soporte/auditor no ve acciones para mover dinero o fallar disputas.
- **CUX-025:** publicar política muestra diff, vigencia, alcance, simulación y no retroactividad antes de confirmar.

### 19.6 Rendimiento percibido

- **CUX-026:** contenido útil de páginas principales aparece dentro del objetivo RNF-003 en condiciones definidas; estado y CTA se priorizan sobre multimedia.
- **CUX-027:** toda espera superior a 1 segundo ofrece indicación; toda espera superior al umbral acordado ofrece contexto o recuperación.
- **CUX-028:** cerrar/recargar una pantalla financiera pendiente conserva el estado real y no duplica la intención.

## 20. Matriz resumida de trazabilidad

| Área UX | Flujos FSD | RF/RN principales | Decisiones pendientes que no debe cerrar |
|---|---|---|---|
| Acceso/perfil | FL-01 | RF-AUT-*, RF-PER-* | DP-001, DP-012, DP-018 |
| Solicitud/acuerdo | FL-02 | RF-OPS-*, RN-001..012 | DP-004, DP-005, DP-011 |
| Pago | FL-03, FL-10 | RF-PAG-*, RN-013..014 | DP-002..007, DP-013 |
| Envío | FL-04 | RF-ENV-*, RN-015..017 | DP-008..011 |
| Confirmación | FL-05 | RF-CON-*, RN-018..022 | DP-009..010, DP-013, DP-021 |
| Reclamo/disputa | FL-06..08 | RF-DIS-*, RN-023..030 | DP-006..007, DP-014 |
| Devolución | FL-09 | RF-DEV-* | DP-014..016 |
| Reputación | FL-11 | RF-REP-*, RN-031..034 | DP-017..018 |
| Dashboards | FL-12 | RF-DAS-* | DP-001 |
| Políticas | FL-13 | RF-ADM-001..005 | DP-005..011, DP-017..018 |
| Operaciones/auditoría | FL-14 | RF-ADM-006..010 | DP-012..014, DP-020 |
| Internacionalización | transversal | PRD §11, FSD §22, CA-I18N-* | DP-001, DP-003..004, DP-010 |
| Accesibilidad/responsive | transversal | RNF-001..003 | DP-020 |

## 21. Decisiones de diseño pendientes

Estas decisiones de diseño dependen de las `DP-*` del PRD o de validación con usuarios. No bloquean wireframes con datos configurables, pero sí el cierre de interfaz productiva:

1. nombre, identidad visual, tono regional y variante exacta de español (`DP-001`);
2. vocabulario legal permitido para custodia, protección y liberación (`DP-002`);
3. países, monedas y experiencia real de Mercado Pago por combinación (`DP-003`, `DP-004`);
4. hito visible de congelación y tratamiento de comisiones (`DP-005..007`);
5. valores y consecuencias de plazos (`DP-008..010`, `DP-014..016`);
6. categorías, modalidades y evidencia obligatoria (`DP-011`);
7. puntos de KYC, revisión de riesgo y contracargo (`DP-012`, `DP-013`);
8. escala, criterios, ventana y fórmula reputacional (`DP-017`);
9. reglas/explicaciones de moderación y retención (`DP-018`);
10. navegadores/dispositivos soportados, SLO de interfaz y umbrales de rendimiento (`DP-020`).
11. requisito de notificación efectiva, estados suficientes, rebotes y fallback antes de autoliberar (`DP-021`).

## 22. Entregables derivados recomendados

Sin ampliar el alcance funcional, este documento debe alimentar:

- wireframes de baja fidelidad de `UX-00` a `UX-90`;
- prototipo navegable de FL-02 a FL-09 en ES y pt-BR;
- design tokens y biblioteca de componentes accesibles;
- catálogo versionado de contenido y plantillas de email;
- matriz de contenido por estado/rol;
- plan de investigación con compradores, vendedores y operaciones;
- casos visuales para estados felices, vacíos, errores, pendientes y revisión;
- pruebas de accesibilidad y criterios `CUX-*` automatizables.

No deben producirse pantallas finales con cifras o conductas que aparenten resolver decisiones pendientes. La identidad Yanti aprobada sí debe aplicarse desde los assets y tokens oficiales de `brand/`.

## 23. Guía de uso para Codex

- Citar ID `UX-*`, `CUX-*`, `RF-*` y `FL-*` relevantes en implementación y pruebas.
- Construir la interfaz desde estado de dominio y permisos de servidor, no desde rutas o etiquetas locales.
- Centralizar dinero, fechas, zonas, contenido e internacionalización; no formatearlos manualmente en componentes.
- Implementar todos los estados de carga, vacío, error, éxito, pendiente y revisión descritos.
- Mantener la misma semántica y orden entre tarjeta móvil y tabla de escritorio.
- Tratar evidencia y enlaces externos como contenido no confiable.
- No usar valores propuestos del PRD como constantes productivas.
- No inferir decisiones `DP-*`; mostrar bloqueo o configuración faltante cuando sea necesario.
- No declarar éxito financiero hasta confirmación reconciliada.
- Probar acceso cruzado, teclado, lector de pantalla, reflow, ES/pt-BR y concurrencia de estado.

---

### Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.0 | 2026-08-07 | Primera especificación UX/UI derivada de PRD 0.1.0 y FSD 0.1.0 |
| 0.1.1 | 2026-08-07 | Magic link por interacción, acuerdos bilaterales sin efecto inmediato, calificación post-cierre, WCAG AA obligatorio y UX de `DP-021` |
