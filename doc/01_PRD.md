# 01 — PRD: Compra segura entre particulares

**Estado:** Borrador de definición para MVP  
**Versión:** 0.1.1  
**Última actualización:** 2026-08-07  
**Responsable:** Producto  
**Audiencia:** Producto, Diseño, Ingeniería, Operaciones, Riesgo, Legal y Soporte  
**Carácter:** Fuente de verdad funcional de nivel producto  

> Este documento define qué debe hacer el producto y por qué. Cuando exista una contradicción con conversaciones, bocetos o tickets, prevalece este PRD, salvo que un documento posterior aprobado indique explícitamente que lo modifica. Los detalles de estados, API, datos, arquitectura y pruebas deben derivarse de este documento sin inventar reglas de negocio.

## 1. Resumen ejecutivo

La aplicación permite realizar compraventas más seguras entre particulares que se conocen mediante canales sin protección transaccional, como Facebook Marketplace, WhatsApp o Telegram.

El vendedor crea una solicitud de pago con las condiciones del acuerdo. El comprador revisa y paga. La plataforma mantiene el dinero sujeto a las capacidades legales y técnicas del proveedor de pagos. Tras la acreditación, el vendedor envía el producto y aporta evidencia. El comprador confirma la recepción conforme o abre un reclamo. Si confirma, el pago se libera al vendedor. Si no actúa, la plataforma envía recordatorios y, en ausencia de reclamo, libera automáticamente el dinero al concluir el plazo. Ante una disputa, ambas partes pueden presentar evidencia y un administrador emite una resolución auditable que puede liberar, reembolsar o requerir una devolución previa.

El producto será sencillo, mobile-first, multidioma, multipaís y multimoneda para Latinoamérica y Brasil. El acceso se realizará mediante magic link. La primera integración de pagos será Mercado Pago, el envío de correo se realizará con Resend y el despliegue se hará en Google Cloud Run.

Las comisiones, plazos y otras políticas operativas no estarán codificados como constantes: serán configurables por administradores, con versionado, vigencia y trazabilidad.

## 2. Problema y oportunidad

Las compraventas entre particulares iniciadas fuera de marketplaces transaccionales exponen a ambas partes a fraude y a una asimetría de confianza:

- el comprador teme pagar y no recibir, o recibir un artículo distinto o defectuoso;
- el vendedor teme enviar y no cobrar, o sufrir un reclamo oportunista;
- los acuerdos suelen quedar dispersos entre mensajes y publicaciones externas;
- no existe un flujo neutral y trazable para capturar condiciones, evidencias, entrega, reclamos y resolución;
- la operación transfronteriza o en distintas monedas agrega complejidad y costos poco transparentes.

La oportunidad es ofrecer una capa de confianza independiente, simple y regional, que estructure el acuerdo, automatice hitos y conserve evidencia suficiente para resolver conflictos.

## 3. Visión y principios del producto

### 3.1 Visión

Convertirse en la forma más simple y confiable de proteger una compraventa entre particulares en Latinoamérica, sin importar dónde se originó el contacto.

### 3.2 Principios

1. **Claridad antes que velocidad:** nadie paga ni acepta una condición sin ver importe, moneda, comisiones, plazos y descripción.
2. **Simplicidad radical:** cada pantalla debe tener una acción principal evidente y lenguaje no técnico.
3. **Neutralidad:** comprador y vendedor acceden al mismo acuerdo y pueden aportar evidencia.
4. **Trazabilidad:** toda acción relevante queda fechada, atribuida y auditable.
5. **Dinero explícito:** importes, comisiones, impuestos, conversiones y monto neto nunca se infieren ni se ocultan.
6. **Configuración, no constantes:** políticas variables por país, moneda o riesgo se administran y versionan.
7. **Internacionalización desde el diseño:** idioma, moneda, zona horaria y formato regional no son adaptaciones posteriores.
8. **Automatización segura:** una liberación o reembolso automático debe ser idempotente, observable y recuperable ante fallas.

## 4. Objetivos

### 4.1 Objetivos del MVP

- Permitir que un vendedor cree y envíe una solicitud de pago en pocos minutos.
- Mostrar al comprador un acuerdo inequívoco y permitirle pagar mediante Mercado Pago.
- Mantener una línea de tiempo verificable desde la creación hasta la liberación o el reembolso.
- Guiar al vendedor para documentar el despacho con evidencia y tracking.
- Permitir confirmación de recepción, calificación y reclamo desde una experiencia simple.
- Automatizar recordatorios y liberaciones conforme a políticas vigentes.
- Dar a operaciones una consola para configurar comisiones, gestionar disputas y auditar acciones.
- Dar a cada usuario dashboards separados de compras, ventas y reclamos.
- Construir reputación pública basada exclusivamente en operaciones completadas.
- Soportar desde la base múltiples países, monedas e idiomas de LATAM y Brasil.

### 4.2 Objetivos de experiencia

- La persona siempre debe entender el estado actual, qué debe hacer, quién debe actuar y cuál es la próxima fecha límite.
- Los flujos principales deben ser utilizables en un teléfono y no requerir conocimientos financieros.
- Los errores de pago, autenticación, carga de evidencia y tracking deben ofrecer recuperación clara.

## 5. No objetivos del MVP

- Ser un marketplace o catálogo de productos.
- Proporcionar chat general entre comprador y vendedor.
- Organizar logística propia, retiro físico o seguros de transporte.
- Garantizar autenticidad mediante peritaje físico.
- Financiar compras, ofrecer cuotas propias o crédito.
- Soportar pagos divididos, múltiples vendedores, carrito o pagos parciales.
- Automatizar íntegramente el fallo de disputas mediante IA. La IA podrá asistir en el futuro, pero el fallo del MVP será humano.
- Admitir negociación posterior al pago que altere unilateralmente las condiciones originales.
- Gestionar operaciones fuera de países, monedas, categorías y límites habilitados por administración.
- Prometer custodia fiduciaria o denominar legalmente el servicio “escrow” sin validación jurídica por país.
- Soportar pagos transfronterizos o conversión de moneda hasta validar disponibilidad, regulación, costos y liquidación.

## 6. Personas y roles

### 6.1 Vendedor

Persona que acuerda vender un producto, crea la solicitud de pago, aporta información del acuerdo, despacha, carga evidencia y recibe el dinero si la operación concluye a su favor.

### 6.2 Comprador

Persona invitada por correo que revisa las condiciones, paga, sigue el envío, confirma la recepción o abre un reclamo, y califica al vendedor al terminar la operación.

### 6.3 Administrador de operaciones

Personal autorizado que consulta operaciones, solicita o analiza evidencia, gestiona disputas, emite resoluciones y ejecuta acciones manuales permitidas. No puede cambiar políticas financieras globales salvo que también tenga el rol correspondiente.

### 6.4 Administrador del sistema

Personal con privilegios restringidos para administrar países, monedas, idiomas, comisiones, plazos, límites, categorías, plantillas, roles e integraciones. Toda modificación queda auditada.

### 6.5 Soporte / auditor (lectura)

Personal que consulta usuarios, operaciones, eventos y evidencia según permisos, sin capacidad de mover dinero, fallar disputas ni alterar configuración.

### 6.6 Sistema

Actor automático que procesa webhooks, programa vencimientos, envía notificaciones, reintenta tareas idempotentes y ejecuta liberaciones o reembolsos autorizados por reglas o resoluciones.

## 7. Alcance del MVP

### 7.1 Incluido

- Registro y acceso por magic link enviado al correo.
- Perfil privado y perfil público con reputación.
- Creación, revisión, expiración y cancelación de solicitudes de pago.
- Pago mediante Mercado Pago en combinaciones país/moneda habilitadas.
- Cálculo transparente de comisiones variables para comprador y vendedor.
- Evidencia previa al envío, datos de despacho y tracking.
- Confirmación de recepción conforme.
- Recordatorios diarios y liberación automática.
- Apertura, gestión y resolución de reclamos con evidencia bilateral.
- Flujo de devolución cuando la resolución lo requiera.
- Liberación al vendedor y reembolso al comprador.
- Calificación recíproca y comentario obligatorio con validación mínima.
- Dashboards de compras, ventas y reclamos.
- Consola administrativa y registro de auditoría.
- Emails transaccionales mediante Resend y notificaciones dentro de la app.
- Infraestructura desplegable en Google Cloud Run.
- Interfaz y contenidos internacionalizables.

### 7.2 Fuera de alcance inicial

- Aplicaciones móviles nativas.
- Mensajes SMS, WhatsApp o push móvil.
- Múltiples proveedores de pago activos en simultáneo, aunque la arquitectura no debe impedirlos.
- Resolución automatizada de disputas.
- Operaciones con servicios, bienes digitales, inmuebles, vehículos u otras categorías no habilitadas.
- Compra de etiquetas de envío o integración universal con transportistas.

## 8. Flujo principal de una operación

1. El vendedor accede mediante magic link y completa los datos obligatorios de su perfil.
2. Crea una solicitud con correo del comprador, país de la operación, moneda, monto del producto, descripción, condición pactada, enlace de publicación y, cuando corresponda, imágenes de referencia.
3. Antes de confirmar, la aplicación presenta el desglose de comisiones, total que pagará el comprador y neto estimado que recibirá el vendedor.
4. El sistema congela en la operación una copia de las condiciones y de la versión de política aplicable, y envía la invitación al comprador.
5. El comprador accede mediante magic link, revisa el acuerdo completo y lo acepta expresamente antes de pagar.
6. Mercado Pago procesa el pago. Solo un webhook autenticado o una consulta autoritativa al proveedor, siempre correlacionados y reconciliados, pueden marcarlo como acreditado. El retorno del navegador nunca es fuente de acreditación.
7. El sistema notifica al vendedor que puede despachar. No debe instruirle a enviar antes de la acreditación.
8. El vendedor carga evidencia de empaquetado, transportista, código o URL de tracking y fecha estimada de entrega dentro del máximo permitido.
9. El sistema notifica el despacho al comprador y muestra la línea de tiempo.
10. El comprador confirma que recibió conforme o abre un reclamo antes de la fecha límite visible.
11. Si confirma, el sistema inicia la liberación conforme a la política aplicable. Las calificaciones se habilitan únicamente después del cierre financiero elegible y jamás bloquean, retrasan ni condicionan una liberación o un reembolso.
12. Si no confirma ni reclama al alcanzar la fecha de entrega límite, el sistema solicita confirmación una vez por día durante tres días consecutivos, por defecto.
13. Si al concluir el último plazo no existe confirmación ni reclamo, el sistema inicia la liberación automática al vendedor.
14. Si existe un reclamo, se suspende cualquier liberación automática hasta una resolución final.

## 9. Requisitos funcionales

La palabra **DEBE** indica un requisito obligatorio del MVP; **DEBERÍA**, una prioridad alta no bloqueante si se documenta su postergación.

### 9.1 Identidad, acceso y perfil

- **RF-AUT-001 — Magic link.** La aplicación DEBE permitir registro e inicio de sesión mediante un enlace de un solo uso enviado al correo, sin contraseña.
- **RF-AUT-002 — Seguridad del enlace.** El magic link DEBE expirar, ser de un solo uso y quedar invalidado después de consumirse o al emitirse uno nuevo según la política de seguridad.
- **RF-AUT-003 — Retorno.** Después de autenticarse, el usuario DEBE regresar de forma segura al flujo u operación que originó el acceso.
- **RF-AUT-004 — Prevención de abuso.** El envío de enlaces DEBE tener límites de frecuencia, respuesta no reveladora sobre la existencia de cuentas y trazabilidad técnica.
- **RF-AUT-005 — Consentimientos.** El sistema DEBE registrar versión, fecha, idioma y evidencia de aceptación de términos, privacidad y políticas aplicables.
- **RF-AUT-006 — Consumo seguro.** Abrir por `GET` la URL de un magic link NO DEBE consumir el token. El consumo DEBE requerir una interacción explícita que ejecute un `POST`, de forma que previsualizadores y scanners de correo no invaliden el enlace, y el token no DEBE filtrarse a logs, analítica, referrers ni recursos externos.
- **RF-PER-001 — Perfil.** El usuario DEBE poder gestionar nombre visible, idioma, país, zona horaria y los datos adicionales requeridos por pagos o cumplimiento.
- **RF-PER-002 — Correo.** El correo autenticado DEBE ser la identidad inicial. Su cambio requiere reverificación y no debe romper el historial.
- **RF-PER-003 — Perfil público.** Cada usuario elegible DEBE tener un perfil público limitado a datos autorizados, antigüedad, métricas de reputación y calificaciones publicables; nunca debe exponer correo, documentos, domicilio ni datos de pago.
- **RF-PER-004 — Restricciones.** El sistema DEBE poder limitar, suspender o bloquear cuentas y explicar al usuario las acciones disponibles sin divulgar controles antifraude sensibles.

### 9.2 Solicitud y acuerdo

- **RF-OPS-001 — Crear solicitud.** El vendedor DEBE poder crear una solicitud con correo del comprador, país, moneda, monto, descripción, condición del artículo, enlace de publicación y datos obligatorios definidos por configuración.
- **RF-OPS-002 — Referencia del acuerdo.** La descripción DEBE permitir detallar marca, modelo, estado, defectos conocidos, accesorios y cualquier condición material.
- **RF-OPS-003 — Validaciones.** El sistema DEBE validar país, moneda, monto mínimo/máximo, categoría, longitud, URL y elegibilidad antes de enviar.
- **RF-OPS-004 — Desglose.** Antes de crear o aceptar, ambas partes DEBEN ver monto base, comisiones propias, impuestos o cargos conocidos, total del comprador, neto estimado del vendedor y moneda.
- **RF-OPS-005 — Inmutabilidad.** Después de la aceptación y/o pago, los términos materiales DEBEN ser inmutables. Cualquier cambio requiere cancelar y generar una nueva solicitud.
- **RF-OPS-006 — Política congelada.** La operación DEBE conservar una instantánea de las tasas, plazos, límites, textos legales y reglas aplicables al momento definido por la política.
- **RF-OPS-007 — Invitación.** El sistema DEBE enviar al comprador un enlace seguro y permitir reenvíos con límites de frecuencia.
- **RF-OPS-008 — Aceptación.** El comprador DEBE aceptar expresamente las condiciones antes de iniciar el pago.
- **RF-OPS-009 — Expiración.** Una solicitud no pagada DEBE expirar conforme al plazo configurado. El vendedor puede cancelarla mientras no exista un pago en proceso o acreditado.
- **RF-OPS-010 — Identificador.** Cada operación DEBE tener un identificador legible para soporte y uno interno no predecible.
- **RF-OPS-011 — Línea de tiempo.** Ambas partes DEBEN ver eventos relevantes, actor, fecha, siguiente acción y fecha límite.

### 9.3 Pagos, comisiones y conciliación

- **RF-PAG-001 — Proveedor inicial.** El sistema DEBE iniciar pagos con Mercado Pago únicamente en países, monedas y modelos de liquidación habilitados.
- **RF-PAG-002 — Fuente de verdad.** Los estados financieros DEBEN confirmarse mediante un webhook autenticado o una consulta autoritativa al proveedor, siempre correlacionados y reconciliados; nunca por el retorno del navegador.
- **RF-PAG-003 — Idempotencia.** Crear, acreditar, liberar, reembolsar y procesar webhooks DEBE ser idempotente.
- **RF-PAG-004 — Estados pendientes.** El usuario DEBE ver estados pendientes, rechazados, cancelados y en revisión con una acción siguiente clara.
- **RF-PAG-005 — Comisiones variables.** El sistema DEBE calcular por separado la comisión del comprador y del vendedor según políticas administrables, sin valores codificados.
- **RF-PAG-006 — Transparencia.** Toda comisión DEBE mostrarse antes de la aceptación y conservarse en el registro de la operación.
- **RF-PAG-007 — Acreditación.** El vendedor solo DEBE recibir la instrucción de envío cuando el pago esté acreditado y la operación sea elegible.
- **RF-PAG-008 — Liberación.** La liberación solo DEBE iniciarse por confirmación válida, vencimiento automático válido o resolución administrativa autorizada.
- **RF-PAG-009 — Reembolso.** El reembolso solo DEBE iniciarse conforme a una cancelación elegible, una resolución o una falla de operación documentada.
- **RF-PAG-010 — Fallas.** Si una liberación o reembolso falla, la operación DEBE permanecer en un estado no terminal, generar alerta y reintentarse de forma controlada.
- **RF-PAG-011 — Registro financiero.** El sistema DEBE mantener un libro interno inmutable de cargos, comisiones, liberaciones, reembolsos, ajustes y referencias del proveedor.
- **RF-PAG-012 — No sobregiro.** Ninguna resolución o reintento DEBE mover más dinero que el saldo atribuible a la operación.

### 9.4 Envío y entrega

- **RF-ENV-001 — Evidencia de despacho.** El vendedor DEBE poder adjuntar fotos o videos del producto y empaquetado antes de declarar el despacho.
- **RF-ENV-002 — Datos de envío.** El vendedor DEBE informar transportista, código o URL de tracking cuando exista, fecha de despacho y fecha estimada de entrega.
- **RF-ENV-003 — Plazo máximo.** La fecha estimada DEBE respetar el máximo configurado para el país o tipo de operación; el valor inicial propuesto es 10 días corridos desde el despacho.
- **RF-ENV-004 — Evidencia inmutable.** Los archivos presentados DEBEN conservar original, metadatos técnicos, hash, autor y fecha. No pueden reemplazarse silenciosamente.
- **RF-ENV-005 — Notificación.** Al declararse el despacho, el comprador DEBE ser notificado y ver la evidencia autorizada, el tracking y la fecha límite.
- **RF-ENV-006 — Corrección controlada.** Los datos de tracking pueden complementarse o corregirse sin borrar el valor anterior; todo cambio queda auditado y se notifica si es material.
- **RF-ENV-007 — Entrega manual.** Para modalidades sin transportista, solo si están habilitadas, el sistema DEBE requerir un mecanismo equivalente de prueba de entrega.

### 9.5 Confirmación, vencimientos y automatización

- **RF-CON-001 — Recepción conforme.** El comprador DEBE poder confirmar que recibió el producto y que coincide sustancialmente con lo acordado.
- **RF-CON-002 — Advertencia.** Antes de confirmar, la aplicación DEBE explicar que la acción inicia la liberación y puede limitar reclamos posteriores según términos aplicables.
- **RF-CON-003 — Recordatorios.** Si no existe confirmación ni reclamo al vencer la entrega, el sistema DEBE enviar recordatorios diarios durante la cantidad configurada; el valor inicial es tres días consecutivos.
- **RF-CON-004 — Liberación automática.** Al concluir el último plazo, sin reclamo abierto, retención administrativa ni anomalía de pago, el sistema DEBE iniciar la liberación automática.
- **RF-CON-005 — Cálculo temporal.** Los vencimientos DEBEN calcularse en una zona horaria definida y mostrarse en la zona local del usuario, indicando fecha y hora exactas.
- **RF-CON-006 — Carrera segura.** La apertura válida de un reclamo antes del vencimiento DEBE impedir la liberación aunque ambos eventos se procesen casi simultáneamente.
- **RF-CON-007 — Procesamiento tardío.** Las tareas demoradas no DEBEN liberar fondos sin reevaluar el estado y todas las retenciones al momento de ejecución.

### 9.6 Dashboards

- **RF-DAS-001 — Compras.** El usuario DEBE tener un listado de compras con estado, contraparte, importe, moneda, próxima acción y fecha límite.
- **RF-DAS-002 — Ventas.** El usuario DEBE tener un listado equivalente de ventas.
- **RF-DAS-003 — Reclamos.** El usuario DEBE tener un listado de reclamos con estado, fecha límite de respuesta y acción requerida.
- **RF-DAS-004 — Filtros.** Los listados DEBEN permitir filtrar por estado, rol, fecha y moneda, y buscar por identificador o contraparte.
- **RF-DAS-005 — Prioridad.** Las operaciones que requieren acción del usuario DEBEN aparecer destacadas antes que las informativas.
- **RF-DAS-006 — Detalle único.** La operación DEBE tener una vista canónica con resumen financiero, acuerdo, envío, evidencia, reputación aplicable y línea de tiempo.

### 9.7 Reclamos y disputas

- **RF-DIS-001 — Apertura.** El comprador DEBE poder abrir un reclamo antes de la liberación irreversible, eligiendo un motivo, describiendo el problema y aportando evidencia mínima.
- **RF-DIS-002 — Motivos.** Los motivos configurables DEBEN incluir al menos: no recibido, artículo distinto, daño, faltantes, condición no declarada y otro.
- **RF-DIS-003 — Costo visible.** Si la política aplica una comisión de reclamo, el comprador DEBE verla y aceptarla antes de abrirlo. El valor inicial propuesto es 3%, sujeto a configuración y validación legal.
- **RF-DIS-004 — Suspensión.** Un reclamo abierto DEBE suspender la liberación automática y preservar los fondos o su equivalente operativo permitido.
- **RF-DIS-005 — Evidencia bilateral.** Comprador y vendedor DEBEN poder aportar texto, fotos, videos, documentos y tracking hasta sus fechas límite.
- **RF-DIS-006 — Acceso equitativo.** Cada parte DEBE ver las alegaciones y evidencias compartibles de la otra, salvo información protegida o controles antifraude.
- **RF-DIS-007 — Plazos.** La consola DEBE mostrar vencimientos para responder, aportar evidencia, devolver y resolver; sus valores serán configurables.
- **RF-DIS-008 — Revisión.** Un administrador de operaciones autorizado DEBE poder revisar el acuerdo original, la cronología, el pago, el tracking y la evidencia sin alterar originales.
- **RF-DIS-009 — Información adicional.** El administrador DEBE poder solicitar información adicional a una o ambas partes, con fecha límite y notificación.
- **RF-DIS-010 — Resoluciones.** El MVP DEBE admitir: liberar al vendedor; reembolsar al comprador sin devolución; exigir devolución y reembolsar tras su validación; y cerrar por acuerdo entre las partes cuando sea verificable. Una parte que proponga aceptar la pretensión solo crea una propuesta versionada sin efecto financiero; exige aceptación explícita de ambas partes sobre la misma versión y resolución/confirmación autorizada antes de cualquier movimiento.
- **RF-DIS-011 — Resolución fundada.** Todo fallo DEBE incluir motivo estructurado, explicación para las partes, importes, comisiones, requisitos pendientes, autor y fecha.
- **RF-DIS-012 — Doble control.** Resoluciones o ajustes por encima de un umbral configurable DEBERÍAN requerir aprobación de un segundo administrador.
- **RF-DIS-013 — Notificación.** Ambas partes DEBEN recibir la resolución y los siguientes pasos en su idioma disponible.
- **RF-DIS-014 — Irreversibilidad visible.** El sistema DEBE advertir al administrador antes de ejecutar un movimiento irreversible y requerir confirmación explícita.
- **RF-DIS-015 — Reapertura.** El MVP no garantiza apelación; si administración habilita una corrección excepcional, debe conservar el fallo anterior y un motivo auditado.

### 9.8 Devoluciones

- **RF-DEV-001 — Autorización.** Una devolución protegida solo DEBE comenzar por resolución o acuerdo aprobado dentro de un reclamo.
- **RF-DEV-002 — Instrucciones.** El comprador DEBE ver qué devolver, destino validado, método, fecha límite, quién paga el envío y evidencia requerida.
- **RF-DEV-003 — Evidencia de devolución.** El comprador DEBE cargar comprobante, transportista, tracking y evidencia del empaquetado.
- **RF-DEV-004 — Retención.** El reembolso no DEBE ejecutarse hasta satisfacer la condición definida en la resolución: despacho comprobado, entrega comprobada o validación manual.
- **RF-DEV-005 — Recepción.** El vendedor DEBE confirmar la recepción de la devolución o reportar un problema dentro del plazo configurado.
- **RF-DEV-006 — Inacción.** Si el vendedor no actúa, el sistema DEBE aplicar la regla de vencimiento congelada en la resolución, con recordatorios y revisión de retenciones.
- **RF-DEV-007 — Incumplimiento.** Si el comprador no devuelve en plazo y no existe una extensión aprobada, el sistema DEBE escalar o ejecutar la consecuencia definida en la resolución; nunca debe decidirla implícitamente.
- **RF-DEV-008 — Cierre financiero.** El cierre DEBE reflejar por separado reembolso, comisiones retenidas o devueltas y costos logísticos cuando correspondan.

### 9.9 Reputación y calificaciones

- **RF-REP-001 — Elegibilidad.** Solo participantes de operaciones reales que alcancen un estado terminal elegible DEBEN poder calificarse.
- **RF-REP-002 — Reciprocidad.** Comprador y vendedor DEBEN poder calificarse por separado usando criterios apropiados a su rol.
- **RF-REP-003 — Escala.** La calificación DEBE usar una escala consistente y explicada; se propone 1 a 5 estrellas, pendiente de confirmación.
- **RF-REP-004 — Comentario obligatorio.** Toda calificación DEBE incluir un comentario obligatorio que supere controles mínimos de calidad.
- **RF-REP-005 — Calidad mínima.** La validación DEBE exigir longitud mínima configurable y rechazar texto vacío, solo emojis, repetición evidente, enlaces no permitidos, datos personales y contenido abusivo. No debe evaluar opinión ni forzar positividad.
- **RF-REP-006 — Contexto.** La reputación pública DEBE distinguir desempeño como comprador y como vendedor cuando haya datos suficientes.
- **RF-REP-007 — Publicación imparcial.** Para reducir represalias, las calificaciones DEBERÍAN publicarse cuando ambas partes califican o al vencer una ventana ciega configurable.
- **RF-REP-008 — Disputas.** El perfil DEBE mostrar métricas agregadas de disputas solo con umbrales de privacidad y contexto suficiente; no debe publicar evidencia privada.
- **RF-REP-009 — Moderación.** El sistema DEBE permitir denunciar, ocultar y moderar comentarios, conservando original, decisión y auditoría.
- **RF-REP-010 — Edición.** Una calificación publicada no puede modificarse libremente. Correcciones excepcionales requieren flujo auditado.
- **RF-REP-011 — Sin autocalificación.** Una persona no DEBE calificarse a sí misma ni calificar más de una vez por rol y operación.
- **RF-REP-012 — Sin bloqueo financiero.** La calificación solo DEBE habilitarse después de un cierre financiero terminal elegible y su ausencia NO DEBE bloquear, retrasar ni condicionar liberaciones, reembolsos o el cierre.

### 9.10 Administración y auditoría

- **RF-ADM-001 — Configuración.** El administrador del sistema DEBE gestionar políticas por ámbito global, país, moneda, categoría y, si se aprueba, segmento de riesgo.
- **RF-ADM-002 — Versionado.** Toda política DEBE tener versión, estado borrador/activa/retirada, vigencia desde/hasta, autor y motivo del cambio.
- **RF-ADM-003 — Precedencia.** La resolución de políticas DEBE tener una precedencia documentada y mostrar al administrador qué regla efectiva se aplicará.
- **RF-ADM-004 — Simulación.** Antes de publicar comisiones, el administrador DEBERÍA poder simular ejemplos de total y neto.
- **RF-ADM-005 — Sin retroactividad.** Un cambio no DEBE modificar operaciones existentes salvo migración excepcional explícita, autorizada y auditada.
- **RF-ADM-006 — Consola de operaciones.** El personal autorizado DEBE buscar y filtrar operaciones, usuarios, pagos, vencimientos y reclamos.
- **RF-ADM-007 — RBAC.** La consola DEBE aplicar permisos de mínimo privilegio y separar lectura, soporte, disputas, configuración y acciones financieras.
- **RF-ADM-008 — Auditoría.** Inicios de sesión administrativos, vistas sensibles, cambios de configuración, fallos y movimientos de dinero DEBEN registrarse de forma inmutable.
- **RF-ADM-009 — Justificación.** Toda acción manual que cambie estado, plazo o dinero DEBE requerir un motivo.
- **RF-ADM-010 — Alertas.** El sistema DEBE alertar sobre webhooks fallidos, pagos sin conciliar, tareas vencidas, liberaciones/reembolsos fallidos y disputas fuera de SLA.

## 10. Reglas de negocio

### 10.1 Acuerdo y operación

- **RN-001.** Una operación tiene exactamente un comprador, un vendedor, una moneda de denominación y un monto base.
- **RN-002.** Comprador y vendedor no pueden ser la misma cuenta ni identidades relacionadas cuando los controles de riesgo así lo determinen.
- **RN-003.** La publicación externa es referencia; la instantánea aceptada dentro de la aplicación es el acuerdo operativo.
- **RN-004.** Los términos materiales no pueden cambiar después de la aceptación/pago. Debe crearse una operación nueva.
- **RN-005.** Una solicitud expirada o cancelada no puede pagarse; cualquier pago tardío debe conciliarse y resolverse sin activar un envío.
- **RN-006.** Solo categorías y rangos de monto habilitados pueden operar.

### 10.2 Comisiones

- **RN-007.** La comisión del comprador y la del vendedor son independientes, pueden ser porcentuales, fijas o combinadas, y pueden incluir mínimos y máximos.
- **RN-008.** Valores iniciales propuestos: 1% al comprador y 1% al vendedor. No son constantes técnicas y no entran en producción sin aprobación comercial, fiscal y legal.
- **RN-009.** Valor inicial propuesto para apertura de reclamo: 3% a cargo del comprador. Debe definirse base de cálculo, momento de cobro y tratamiento según fallo antes de producción.
- **RN-010.** La versión de comisión aplicable se congela en el hito definido —propuesta: aceptación del comprador— y no cambia retroactivamente.
- **RN-011.** El redondeo se realiza en unidades menores de la moneda con una única regla documentada; el desglose debe reconciliar exactamente con el proveedor.
- **RN-012.** El total del comprador y el neto del vendedor deben mostrarse antes del pago. Cargos no conocidos deben identificarse como estimados o externos.

### 10.3 Pago y envío

- **RN-013.** “Pago iniciado” no equivale a “pago acreditado”. Solo el segundo habilita el despacho.
- **RN-014.** Ningún evento del navegador es suficiente para acreditar, liberar o reembolsar.
- **RN-015.** El vendedor debe despachar dentro de un plazo configurable desde la acreditación; el vencimiento y su consecuencia quedan pendientes de decisión.
- **RN-016.** La fecha estimada de entrega propuesta no puede exceder el máximo efectivo, inicialmente 10 días corridos desde el despacho, salvo excepción aprobada.
- **RN-017.** La ausencia de tracking en una modalidad que lo requiere impide declarar el envío completo.

### 10.4 Confirmación y liberación automática

- **RN-018.** La confirmación conforme autoriza iniciar la liberación, pero no convierte un fallo técnico de pago en éxito.
- **RN-019.** En la fecha límite de entrega, si no hay confirmación o reclamo, se envía un recordatorio diario durante tres días consecutivos por defecto.
- **RN-020.** Después del último plazo se libera automáticamente solo si no hay reclamo, retención, contracargo, anomalía, revisión de riesgo ni tarea financiera pendiente.
- **RN-021.** Cada tarea automática debe releer el estado vigente antes de actuar.
- **RN-022.** Una vez que el proveedor confirma una liberación irreversible, un reclamo ordinario ya no puede prometer recuperación de fondos; deben existir canales legales o de soporte separados según política.

### 10.5 Disputas y evidencia

- **RN-023.** La apertura válida de un reclamo pausa la liberación.
- **RN-024.** Ambas partes conservan carga de aportar evidencia relevante. La falta de evidencia se valora junto con acuerdo, tracking y conducta; no implica automáticamente fraude.
- **RN-025.** Si no existe evidencia fiable de entrega, la resolución puede favorecer el reembolso al comprador, sujeto a revisión integral y política aplicable.
- **RN-026.** Si lo recibido difiere sustancialmente del acuerdo, la resolución puede exigir devolución antes del reembolso.
- **RN-027.** Cuando se exige devolución, los fondos permanecen retenidos hasta el hito expresamente indicado en el fallo.
- **RN-028.** Una resolución debe especificar destino de monto base, comisión del comprador, comisión del vendedor, comisión de reclamo y costos de devolución.
- **RN-029.** Los originales de evidencia y eventos nunca se eliminan por una resolución; pueden restringirse por privacidad o retención legal.
- **RN-030.** Un administrador con conflicto de interés no puede fallar la disputa.

### 10.6 Reputación

- **RN-031.** Solo las operaciones terminales definidas como elegibles afectan reputación.
- **RN-032.** Las operaciones canceladas antes del pago no generan calificación.
- **RN-033.** El comentario es obligatorio y debe pasar validaciones objetivas mínimas; la crítica negativa válida no puede bloquearse por su tono desfavorable.
- **RN-034.** La reputación debe recalcularse de forma reproducible y resistir duplicados o eliminación de cuentas.

## 11. Requisitos internacionales

### 11.1 Países y expansión regional

- El sistema DEBE usar un catálogo administrable de países habilitados. “LATAM + Brasil” expresa el mercado objetivo, no implica habilitación simultánea de todos los países.
- Cada país DEBE tener estado de disponibilidad, monedas admitidas, proveedor/cuenta de pago, límites, categorías, textos legales, impuestos conocidos, plazos y requisitos de identidad.
- El lanzamiento país por país DEBE depender de validación legal, fiscal, operativa y de las capacidades reales de Mercado Pago.

### 11.2 Monedas

- Todos los importes DEBEN almacenarse como unidades menores enteras junto con código ISO 4217; no se deben usar números de punto flotante para dinero.
- La interfaz DEBE mostrar código o símbolo sin ambigüedad y respetar decimales de la moneda.
- Una operación conserva una sola moneda de denominación.
- El MVP no DEBE prometer conversión ni liquidación transfronteriza. Si el proveedor convierte, el tipo, margen, responsable y monto final deben mostrarse y persistirse antes de habilitar el caso.
- Las reglas de redondeo, mínimos y máximos DEBEN configurarse por moneda.

### 11.3 Idiomas y localización

- Idiomas iniciales propuestos: español y portugués de Brasil. La arquitectura DEBE permitir incorporar variantes y nuevos idiomas sin cambiar lógica de negocio.
- No deben existir textos visibles codificados directamente en componentes o emails.
- Fechas, horas, números, moneda y pluralización DEBEN usar locale.
- Los documentos legales y plantillas DEBEN versionarse por país e idioma, con fallback explícito. No se permite mostrar silenciosamente un texto legal en otro idioma.
- El contenido escrito por usuarios no se traducirá automáticamente en el MVP.
- La operación DEBE preservar el idioma en el que cada parte aceptó condiciones y recibió comunicaciones críticas.

### 11.4 Zona horaria y calendario

- Los instantes se almacenan en UTC y se muestran en la zona horaria del usuario.
- La política DEBE definir si cada plazo utiliza días corridos o hábiles. Hasta confirmación, los valores de 10 y 3 días se interpretan como días corridos.
- Toda fecha límite crítica DEBE mostrarse con fecha, hora y zona, no solo como “hoy” o “mañana”.

### 11.5 Cumplimiento regional

- Antes de habilitar un país se DEBEN validar KYC/KYB aplicable, AML, sanciones, protección al consumidor, privacidad, custodia de fondos, licencias, impuestos, facturación, contracargos y retención de evidencia.
- El nombre comercial del flujo no DEBE afirmar una figura jurídica no aprobada.

## 12. Configuración administrativa

La configuración DEBE poder expresarse por ámbito y vigencia. Como mínimo incluirá:

| Grupo | Parámetros mínimos |
|---|---|
| Disponibilidad | países, monedas, idiomas, categorías, modalidades de entrega |
| Importes | mínimo, máximo, límites acumulados y umbrales de aprobación |
| Comisión comprador | porcentaje, fijo, mínimo, máximo, impuestos y regla de redondeo |
| Comisión vendedor | porcentaje, fijo, mínimo, máximo, impuestos y regla de redondeo |
| Reclamo | costo, base de cálculo, momento de cobro, devolución/retención según fallo |
| Solicitud | vigencia, cantidad máxima de reenvíos y límites de frecuencia |
| Envío | plazo para despachar, máximo de entrega, tracking obligatorio y evidencia mínima |
| Confirmación | cantidad de recordatorios, intervalo, hora de envío y gracia final |
| Disputas | motivos, SLA, plazos de respuesta, evidencia requerida y doble aprobación |
| Devolución | plazo, responsable del costo, prueba requerida y regla ante inacción |
| Reputación | escala, longitud de comentario, ventana ciega y umbrales de publicación |
| Archivos | formatos, tamaños, cantidad, retención, análisis de malware y acceso |
| Riesgo | retenciones y revisiones permitidas, sin exponer reglas sensibles al público |

Precedencia propuesta, de mayor a menor especificidad: excepción explícita aprobada para la operación; categoría + país + moneda; país + moneda; país; global. Debe confirmarse en la especificación funcional.

## 13. Notificaciones

### 13.1 Canales del MVP

- Email transaccional mediante Resend.
- Centro o indicadores de notificación dentro de la aplicación.
- No se incluyen SMS, WhatsApp ni push nativo.

### 13.2 Eventos mínimos

| Evento | Destinatario | Propósito |
|---|---|---|
| Magic link solicitado | Usuario | Autenticación segura |
| Solicitud creada | Comprador | Revisar y pagar |
| Solicitud reenviada/próxima a expirar | Comprador | Evitar pérdida accidental |
| Pago acreditado | Ambas partes | Confirmar; instruir envío solo al vendedor |
| Pago rechazado/pendiente | Comprador | Recuperar el pago |
| Plazo de despacho próximo/vencido | Vendedor y, según caso, comprador | Solicitar acción y transparencia |
| Producto despachado | Comprador | Ver tracking y fecha límite |
| Entrega por confirmar | Comprador | Confirmar o reclamar |
| Recordatorios diarios | Comprador | Advertir fecha exacta de liberación |
| Reclamo abierto | Ambas partes y operaciones | Suspensión y próximos pasos |
| Evidencia o respuesta requerida | Parte correspondiente | Cumplir plazo |
| Resolución emitida | Ambas partes | Explicar fallo e importes |
| Devolución requerida/despachada/recibida | Parte correspondiente | Completar retorno |
| Liberación o reembolso iniciado/completado/fallido | Parte correspondiente | Estado financiero |
| Calificación disponible/próxima a vencer | Ambas partes | Completar reputación |
| Cambio sensible de cuenta | Usuario | Seguridad |

### 13.3 Reglas de comunicación

- Cada notificación DEBE usar el idioma preferido del destinatario cuando exista una plantilla aprobada.
- Debe incluir identificador de operación, acción requerida, fecha límite exacta y enlace seguro; no debe incluir evidencia sensible como adjunto.
- Los eventos financieros, de seguridad y de disputa no pueden darse de baja como marketing.
- El estado de entrega del correo, reintentos y rebotes DEBE quedar registrado sin convertir el email en fuente de verdad del estado.
- Los enlaces no deben autenticar ni autorizar una acción financiera irreversible por sí solos.
- El requisito de notificación efectiva previo a una liberación automática, los estados de entrega suficientes, el tratamiento de rebotes y el fallback por país dependen de `DP-021`. Hasta aprobarlo, la automatización DEBE resolver una política explícita para la combinación aplicable; si falta, debe denegar la autoliberación y escalar a revisión, no asumir que un envío o una notificación in-app son suficientes.

## 14. Reputación y confianza

### 14.1 Señales públicas propuestas

- Nombre visible y avatar opcional moderado.
- Mes/año de incorporación.
- Promedio y cantidad de calificaciones como comprador y como vendedor.
- Distribución de calificaciones cuando exista volumen suficiente.
- Cantidad de operaciones completadas por rol.
- Comentarios publicados con fecha aproximada, rol y contexto limitado de la operación.
- Insignias verificadas solo cuando exista una definición objetiva y auditable.

### 14.2 Controles de calidad del comentario

El comentario obligatorio debe:

- superar una longitud mínima configurable, propuesta inicial de 20 caracteres significativos;
- contener texto informativo y no solo símbolos, emojis o caracteres repetidos;
- no incluir teléfonos, correos, domicilios, documentos o enlaces;
- pasar controles de lenguaje abusivo, amenazas, discriminación, spam y contenido ilegal;
- permitir reformulación y revisión humana cuando sea rechazado;
- conservar la versión original para auditoría con acceso restringido.

La validación automática no debe inventar hechos, reescribir el comentario sin consentimiento ni impedir una experiencia negativa descrita de forma válida.

## 15. Gestión de disputas

### 15.1 Principios

- Imparcialidad y oportunidad de respuesta para ambas partes.
- Decisión basada en el acuerdo aceptado, evidencia verificable, tracking y cronología.
- Separación entre asistencia automática y fallo humano.
- Explicación comprensible, tratamiento explícito de cada importe y auditoría completa.
- Protección de datos: compartir solo evidencia necesaria y permitida.

### 15.2 Evidencia aceptable

- Fotos y videos del artículo, defectos, número de serie, embalaje y apertura.
- Comprobantes de despacho, entrega, intento de entrega o devolución.
- Código y URL de tracking.
- Capturas o documentos pertinentes al acuerdo, sujetos a autenticidad y privacidad.
- Metadatos técnicos y eventos registrados por la propia plataforma.

La especificación funcional debe definir formatos, tamaños, cantidad, análisis de malware, retención, acceso, descarga y criterios para material potencialmente sensible.

### 15.3 Resultado financiero

Todo fallo debe producir un desglose determinista:

1. destino del monto base;
2. tratamiento de la comisión del comprador;
3. tratamiento de la comisión del vendedor;
4. tratamiento del costo de reclamo;
5. responsable del envío de devolución;
6. hito que autoriza el movimiento;
7. monto no recuperable o limitado por el proveedor, si existiera;
8. momento y medio estimado de la liquidación o devolución.

## 16. Requisitos no funcionales de producto

- **RNF-001 — Accesibilidad.** Las páginas y flujos críticos del MVP DEBEN cumplir WCAG 2.2 nivel AA. El alcance obligatorio comprende autenticación y consentimientos; solicitud, acuerdo y pago; envío y evidencia; confirmación, reclamo, disputa y devolución; cierre y calificación; y las acciones administrativas de disputa, dinero, políticas y auditoría. La conformidad incluye navegación por teclado, foco visible/no oculto, reflow, contraste, nombres/roles/estados programáticos y mensajes no dependientes solo del color.
- **RNF-002 — Responsive.** La experiencia DEBE ser mobile-first y funcional en navegadores modernos de escritorio y móvil.
- **RNF-003 — Rendimiento.** Las páginas principales DEBERÍAN mostrar contenido útil en menos de 2,5 segundos en condiciones móviles razonables, excluyendo redirecciones de terceros.
- **RNF-004 — Disponibilidad.** Pagos y webhooks DEBEN tolerar reintentos y caídas temporales sin duplicar movimientos.
- **RNF-005 — Observabilidad.** Deben existir logs estructurados, métricas, trazas y alertas correlacionables por operación, sin registrar secretos ni datos sensibles innecesarios.
- **RNF-006 — Privacidad.** Se aplicará minimización, cifrado en tránsito y reposo, controles de acceso, retención definida y procedimientos de derechos del titular compatibles con obligaciones legales.
- **RNF-007 — Archivos.** Toda carga DEBE validarse, analizarse y entregarse mediante acceso autorizado y temporal; nunca ejecutarse o servirse de forma insegura.
- **RNF-008 — Auditoría.** Los eventos financieros, administrativos y de disputa DEBEN ser inmutables y conservar actor, instante, contexto y correlación.
- **RNF-009 — Despliegue.** La aplicación DEBE desplegarse en Google Cloud Run con configuración por entorno, secretos fuera del código, migraciones controladas y rollback documentado.
- **RNF-010 — Integraciones.** Mercado Pago y Resend DEBEN estar encapsulados para permitir sustitución o coexistencia futura sin cambiar el dominio central.
- **RNF-011 — Recuperación.** Deben definirse objetivos de recuperación, copias de seguridad y pruebas de restauración antes de producción.
- **RNF-012 — Seguridad.** Se requieren protección CSRF/XSS/SSRF, rate limiting, autorización por recurso, rotación de secretos, validación de webhooks y revisión de dependencias.

## 17. Criterios de aceptación del MVP

El MVP estará listo para lanzamiento controlado cuando:

1. Un vendedor elegible pueda crear una solicitud válida y el comprador la reciba en su idioma.
2. Ambas partes vean el mismo acuerdo congelado y un desglose financiero reconciliable.
3. Un comprador pueda pagar en al menos una combinación país/moneda aprobada y un webhook autenticado o una consulta autoritativa, correlacionados y reconciliados, habiliten el envío exactamente una vez; el retorno del navegador no lo habilite.
4. El vendedor pueda cargar evidencia y tracking, y el comprador reciba la información y la fecha límite correcta.
5. La confirmación conforme inicie una única liberación y el resultado se refleje en ambos dashboards.
6. La inacción genere el número correcto de recordatorios y una única liberación automática, salvo cualquier retención válida.
7. Un reclamo abierto a tiempo detenga la liberación incluso bajo concurrencia.
8. Ambas partes puedan aportar evidencia y un administrador autorizado pueda emitir cada tipo de resolución soportado.
9. Una devolución exigida mantenga el dinero retenido hasta el hito configurado y termine en el movimiento correcto.
10. Las fallas y reintentos de Mercado Pago, Resend y tareas programadas no dupliquen efectos.
11. Las comisiones y plazos puedan modificarse para nuevas operaciones sin desplegar código ni alterar operaciones existentes.
12. Los dashboards muestren correctamente compras, ventas, reclamos, acciones y vencimientos.
13. Solo usuarios elegibles puedan calificar, el comentario sea obligatorio y los resultados aparezcan en el perfil público sin filtrar datos privados.
14. La consola aplique roles, registre auditoría y exija motivos para acciones manuales.
15. La interfaz funcione en español y portugués brasileño, con formatos correctos de fecha y moneda.
16. Legal, pagos, seguridad y operaciones aprueben explícitamente el país piloto y el modelo de custodia/liberación.
17. Las páginas y flujos críticos definidos en `RNF-001` demuestren conformidad WCAG 2.2 AA mediante pruebas automáticas y manuales.

## 18. Criterios de éxito y métricas

Los objetivos numéricos deben fijarse después de instrumentar una línea base o durante el piloto.

### 18.1 Métrica norte

**Operaciones protegidas completadas correctamente por mes**, entendidas como operaciones pagadas que terminan en liberación o reembolso coherente, sin incidente financiero no resuelto.

### 18.2 Embudo

- Solicitudes creadas → entregadas → abiertas → aceptadas → pago iniciado → pago acreditado.
- Tiempo mediano desde creación hasta pago.
- Tasa de abandono por paso, país, moneda, dispositivo e idioma.
- Tiempo desde acreditación hasta despacho y desde despacho hasta cierre.

### 18.3 Confianza y disputas

- Porcentaje de operaciones con reclamo.
- Motivos de reclamo y tasa por categoría/vendedor, con controles de volumen.
- Tiempo mediano y percentil 90 de resolución.
- Porcentaje resuelto por liberación, reembolso y devolución.
- Reclamos reabiertos, contactos repetidos y satisfacción posterior.
- Porcentaje de envíos con evidencia y tracking completos.

### 18.4 Finanzas y operaciones

- Volumen de pagos y net revenue por país/moneda.
- Comisión efectiva y costo del proveedor.
- Pagos no conciliados; liberaciones y reembolsos fallidos o demorados.
- Pérdidas por fraude, contracargos y ajustes por cada 1.000 unidades monetarias procesadas.
- Operaciones que requieren intervención manual y minutos operativos por disputa.

### 18.5 Experiencia y reputación

- Tasa de finalización del flujo móvil.
- Tasa de entrega de emails críticos y magic links exitosos.
- Porcentaje de operaciones elegibles con calificación.
- Comentarios rechazados por control de calidad y tasa de aprobación tras corrección.
- CSAT de operación y de resolución de disputa.

### 18.6 Fiabilidad

- Disponibilidad de flujos críticos.
- Latencia de procesamiento de webhooks y tareas vencidas.
- Duplicados financieros: objetivo absoluto de cero.
- Tasa de errores por integración y tiempo de recuperación.

## 19. Analítica y eventos mínimos

La instrumentación DEBE distinguir eventos de producto de eventos financieros auditables. Como mínimo:

- `payment_request_created`, `payment_request_sent`, `payment_request_viewed`, `agreement_accepted`;
- `payment_started`, `payment_pending`, `payment_accredited`, `payment_failed`;
- `shipment_declared`, `shipment_evidence_added`, `delivery_confirmation_requested`;
- `delivery_confirmed`, `reminder_sent`, `auto_release_eligible`, `release_started`, `release_completed`, `release_failed`;
- `dispute_opened`, `evidence_added`, `evidence_requested`, `dispute_resolved`;
- `return_required`, `return_shipped`, `return_received`, `refund_started`, `refund_completed`, `refund_failed`;
- `rating_submitted`, `rating_published`, `rating_moderated`.

Cada evento debe incluir identificadores no sensibles, versión de política, país, moneda, idioma, rol, timestamps y resultado. La analítica no reemplaza el libro financiero ni el registro de auditoría.

## 20. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación inicial |
|---|---|---|
| El modelo de custodia/liberación no es legal o no está disponible en un país | Crítico | Validación legal y técnica país por país; no lanzar hasta aprobación |
| Mercado Pago no soporta el flujo requerido o difiere por país | Crítico | Prueba de concepto, contratos y matriz de capacidades; capa de abstracción |
| Contracargos después de liberar | Alto | Política de reservas/riesgo, conciliación y límites; decisión financiera pendiente |
| Fraude, triangulación o cuentas relacionadas | Alto | KYC/AML según riesgo, límites, señales y revisión manual |
| Evidencia falsa o insuficiente | Alto | Originales, hashes, metadatos, tracking y revisión humana |
| Liberación automática incorrecta por carrera o tarea tardía | Crítico | Bloqueo transaccional, idempotencia y reevaluación inmediata |
| Configuración errónea de comisiones | Alto | Borrador, simulación, aprobación, vigencia, auditoría y rollback para futuras operaciones |
| Disputas costosas o lentas | Alto | Categorías claras, evidencia guiada, SLA, colas y métricas operativas |
| Exposición de datos o evidencia sensible | Crítico | Mínimo privilegio, URLs temporales, cifrado, retención y auditoría de acceso |
| Mala entregabilidad de magic links o avisos | Alto | Monitoreo de Resend, SPF/DKIM/DMARC, reintentos y estado visible en app |
| Ambigüedad por monedas, idioma o zona horaria | Alto | ISO 4217, locale, UTC y fechas límite explícitas |
| Reputación manipulada o represalias | Medio/alto | Solo operaciones reales, ventana ciega, detección de abuso y moderación |
| El costo de reclamo desalienta reclamos legítimos | Alto | Revisión legal/ética, transparencia, excepciones y análisis de impacto |

## 21. Dependencias

- Aprobación legal y regulatoria por país.
- Definición contractual y técnica con Mercado Pago.
- Cuentas de Mercado Pago compatibles con el modelo de fondos aprobado.
- Cuenta y dominio verificado en Resend, con SPF, DKIM y DMARC.
- Proyecto y entornos en Google Cloud, secretos, base de datos, almacenamiento de evidencia, colas/tareas y observabilidad.
- Políticas de categorías prohibidas, KYC/AML, privacidad, retención, moderación y soporte.
- Equipo o proveedor para resolución humana de disputas y SLA operativo.
- Traducción y revisión jurídica de español y portugués brasileño.

## 22. Decisiones pendientes

Las siguientes decisiones bloquean partes del diseño o el lanzamiento. No deben ser resueltas por Codex sin aprobación explícita.

La decisión `DP-001A` resolvió el nombre y la identidad visual: el producto se denomina **Yanti**, usa el dominio `yanti.app` y adopta **B Organic / A11 Cyan-Turquoise + Coral** como sistema oficial. La entidad operadora y los países del piloto continúan pendientes dentro de `DP-001`. Ver `decisions/DP-001A_BRAND_NAME_AND_IDENTITY.md`.

| ID | Decisión | Responsable sugerido | Bloquea |
|---|---|---|---|
| DP-001 | Entidad operadora y países del piloto; nombre e identidad resueltos por `DP-001A` | Negocio/Legal | Estructura legal y lanzamiento |
| DP-002 | Figura legal del servicio y forma exacta de mantener/liberar fondos por país | Legal/Pagos | Arquitectura financiera |
| DP-003 | Matriz real de capacidades de Mercado Pago por país, moneda y cuenta | Pagos | Integración y expansión |
| DP-004 | Si se permiten operaciones transfronterizas y quién asume conversión | Legal/Pagos | Multipaís/moneda |
| DP-005 | Evento exacto que congela comisiones: creación, aceptación o acreditación | Producto/Finanzas | Cálculo financiero |
| DP-006 | Base, cobro y devolución del 3% de reclamo; posibles exenciones | Legal/Producto | Disputas |
| DP-007 | Tratamiento de todas las comisiones en cada tipo de resolución | Finanzas/Legal | Reembolsos |
| DP-008 | Plazo para que el vendedor despache y consecuencia del incumplimiento | Producto/Operaciones | Estado y automatización |
| DP-009 | Inicio exacto del plazo de entrega y uso de tracking como señal | Producto/Operaciones | Recordatorios/liberación |
| DP-010 | Días corridos vs. hábiles y hora de corte por país | Operaciones/Legal | Motor de plazos |
| DP-011 | Categorías permitidas/prohibidas, límites y modalidades de entrega | Riesgo/Legal | Elegibilidad |
| DP-012 | Requisitos KYC/AML y momento de verificación por rol/importe | Riesgo/Legal | Onboarding/payout |
| DP-013 | Política de contracargos, reservas y saldo negativo | Finanzas/Riesgo | Pérdidas y liberación |
| DP-014 | SLA de evidencia, disputa, devolución y apelación | Operaciones | Consola y notificaciones |
| DP-015 | Quién paga la devolución por tipo de fallo | Legal/Producto | Resoluciones |
| DP-016 | Hito de reembolso en devolución: despacho, entrega o validación | Riesgo/Producto | Flujo de retorno |
| DP-017 | Escala, ventana ciega, caducidad y fórmula exacta de reputación | Producto | Perfil público |
| DP-018 | Reglas de moderación, revisión y retención de comentarios/evidencia | Legal/Trust | Contenido y privacidad |
| DP-019 | Stack de aplicación, base de datos, almacenamiento y scheduler | Ingeniería | Arquitectura técnica |
| DP-020 | Objetivos numéricos de piloto, SLO/RTO/RPO y umbral de salida | Dirección/Ingeniería | Go-live |
| DP-021 | Qué constituye notificación efectiva antes de autoliberar, tratamiento de rebotes y fallback permitido por país/canal | Legal/Producto/Operaciones | Recordatorios y liberación automática |

## 23. Supuestos explícitos del borrador

- Los productos son bienes físicos enviados o entregados mediante modalidades habilitadas.
- El vendedor inicia la operación y conoce el correo del comprador.
- El comprador paga en una sola transacción y la operación usa una sola moneda.
- Mercado Pago puede ofrecer algún mecanismo legalmente aprobado para diferir la disponibilidad o ejecutar la liberación; esto debe comprobarse.
- Los valores 1% + 1%, 3%, 10 días y 3 recordatorios son configuraciones iniciales propuestas, no garantías comerciales ni constantes.
- El fallo de disputas es humano en el MVP.
- Español y portugués brasileño son los primeros idiomas, sin limitar futuras incorporaciones.

## 24. Documentos derivados requeridos

Este PRD debe complementarse, sin duplicar ni contradecir sus reglas, con:

1. **02_FSD.md:** flujos exhaustivos, estados alternativos, vencimientos y casos límite.
2. **03_DOMAIN_AND_STATE_MACHINES.md:** entidades, invariantes y máquinas de estados de operación, pago, envío, disputa, devolución y payout.
3. **04_UX_UI_SPEC.md:** mapa de pantallas, contenido, accesibilidad y estados visuales.
4. **05_TECHNICAL_ARCHITECTURE.md:** stack, Cloud Run, tareas, integraciones, observabilidad y despliegue.
5. **06_DATA_AND_API_CONTRACTS.md:** modelo de datos, API, webhooks, archivos, errores y autorización.
6. **07_PAYMENTS_DISPUTES.md:** libro financiero, Mercado Pago, comisiones, conciliación, contracargos, fallos y devoluciones.
7. **08_SECURITY_AUDIT_ACCEPTANCE.md:** amenazas, RBAC, auditoría, privacidad y pruebas de aceptación.
8. **AGENTS.md:** instrucciones operativas para Codex, incluyendo orden de lectura y prohibición de inventar decisiones pendientes.

## 25. Guía de uso para Codex

- Implementar únicamente requisitos marcados como incluidos en MVP y decisiones aprobadas.
- No convertir propuestas o decisiones pendientes en comportamiento definitivo.
- No codificar comisiones, plazos, países, monedas, idiomas, categorías ni límites como constantes de dominio.
- Preservar importes, moneda, versión de política, actor, timestamps y referencias externas en cada transición relevante.
- Tratar movimientos financieros, webhooks y consultas autoritativas como idempotentes, correlacionables y auditables.
- Ante una contradicción, detener la implementación afectada y registrar la decisión requerida en lugar de elegir silenciosamente.
- Utilizar los identificadores `RF-*`, `RN-*`, `RNF-*` y `DP-*` en tickets, pruebas y documentación derivada para mantener trazabilidad.

---

### Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.0 | 2026-08-07 | Primer borrador integral del PRD para revisión |
| 0.1.1 | 2026-08-07 | Alineación de acreditación autoritativa, calificación posterior al cierre, WCAG 2.2 AA, consumo seguro de magic links y decisión `DP-021` |
