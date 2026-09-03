# 07 — Pagos, ledger, conciliación y disputas

**Estado:** Borrador técnico-operativo sujeto a validación legal y del proveedor  
**Versión:** 0.1.2  
**Última actualización:** 2026-08-07  
**Documentos fuente:** `01_PRD.md`, `02_FSD.md`, `03_DOMAIN_AND_STATE_MACHINES.md`, `05_TECHNICAL_ARCHITECTURE.md` y `06_DATA_AND_API_CONTRACTS.md`, todos v0.1.1  
**Audiencia:** Pagos, Finanzas, Ingeniería, Operaciones, Riesgo, Legal, Auditoría, Soporte y QA  
**Carácter:** Fuente de verdad especializada para el modelo financiero y la operación de disputas, subordinada al PRD y al FSD  

> Este documento no denomina ni presupone que el servicio sea jurídicamente un escrow. “Fondos protegidos”, “retención” y “liberación” son términos funcionales internos. La titularidad, custodia, disponibilidad, licencias, cuentas y movimientos posibles deben validarse por país y contrato. Ninguna capacidad de Mercado Pago se considera disponible hasta documentarla, probarla y habilitarla en la matriz de capacidades aprobada (`DP-002`, `DP-003`).

## 1. Propósito

Definir un modelo financiero implementable, auditable y neutral al proveedor para:

- recibir y conciliar pagos de compradores;
- calcular y congelar comisiones configurables sin usar punto flotante;
- representar principal, comisiones, impuestos, costos, retenciones y derechos económicos;
- ordenar liberaciones y reembolsos sin duplicarlos;
- detectar pagos tardíos, contracargos, diferencias y resultados externos desconocidos;
- resolver disputas asignando explícitamente cada componente monetario;
- coordinar evidencia, SLA, devolución, doble aprobación y acciones operativas;
- verificar que el libro interno, el proveedor y las liquidaciones externas concilien.

No define contratos HTTP o tablas definitivas —responsabilidad de `06_DATA_AND_API_CONTRACTS.md`— ni reemplaza la validación legal, fiscal o contractual.

## 2. Precedencia y lenguaje normativo

Precedencia:

1. ley, regulación, contrato del proveedor y decisiones formalmente aprobadas;
2. `01_PRD.md`;
3. `02_FSD.md`;
4. `03_DOMAIN_AND_STATE_MACHINES.md`;
5. este documento para semántica financiera;
6. `05_TECHNICAL_ARCHITECTURE.md`;
7. `06_DATA_AND_API_CONTRACTS.md` para representación y contratos, sin debilitar invariantes financieras;
8. código, tickets y conversaciones.

- **DEBE / NO DEBE:** requisito obligatorio del MVP.
- **DEBERÍA:** prioridad alta; posponer requiere justificación.
- **Propuesto:** diseño recomendado, no decisión de negocio aprobada.
- `PF-*`: requisito financiero; `RC-*`: regla de conciliación; `OD-*`: regla operativa de disputa; `CA-PD-*`: criterio de aceptación de este documento.

Las referencias `RF-*`, `RN-*`, `INV-*`, `TR-*`, `DP-*` y `CA-*` conservan el significado de los documentos fuente.

## 3. Separación de conceptos

### 3.1 Capas de verdad

| Capa | Qué representa | Autoridad |
|---|---|---|
| Acuerdo | Precio, moneda, comisiones mostradas y condiciones aceptadas | Snapshot inmutable de la operación |
| Estado de dominio | Elegibilidad para pagar, enviar, disputar o cerrar | Máquinas `SM-OPS`, `SM-PAG`, `SM-DIS`, `SM-DEV`, `SM-FIN` |
| Ledger interno | Hechos económicos y obligaciones internas por partida doble | Asientos confirmados e inmutables |
| Orden financiera | Intención durable de producir un movimiento externo | `AGG-ORDEN-FINANCIERA` |
| Estado del proveedor | Resultado informado/consultado de un objeto externo | Webhook autenticado o consulta autoritativa del proveedor |
| Liquidación | Agrupación neta reportada por proveedor | Reporte/archivo/API conciliable |
| Banco | Efectivo realmente ingresado o debitado de cuentas de la entidad | Extracto bancario |

Ninguna capa sustituye automáticamente a otra. Un webhook autenticado **o** una consulta autoritativa puede confirmar un objeto del proveedor; solo la correlación y conciliación validadas habilitan el asiento y la transición interna correspondiente. El retorno del navegador nunca acredita. El ledger no prueba por sí mismo la custodia jurídica ni la disponibilidad bancaria.

### 3.2 Términos financieros

| Término | Definición |
|---|---|
| Principal | Monto base pactado del producto, sin comisiones ni impuestos adicionales |
| Comisión comprador | Cargo de servicio atribuido al comprador según política |
| Comisión vendedor | Cargo de servicio atribuido al vendedor, normalmente descontable de lo que reciba si el modelo lo permite |
| Comisión de reclamo | Cargo eventual asociado a abrir/gestionar un reclamo; tratamiento abierto en `DP-006` |
| Costo del proveedor | Importe cobrado por el procesador; no se confunde con comisión de plataforma |
| Retención funcional | Bloqueo interno que impide una orden; no declara dónde están jurídicamente los fondos |
| Reserva lógica | Importe temporalmente apartado dentro de una operación para evitar órdenes incompatibles; no es un asiento contable confirmado |
| Liberación | Movimiento funcional a favor del vendedor, solo si existe capacidad aprobada |
| Reembolso | Movimiento funcional de devolución al comprador |
| Contracargo | Débito o reclamo iniciado en el circuito de pago, potencialmente posterior al cierre |
| Ajuste | Nueva orden autorizada para corregir una diferencia; nunca edición de un asiento confirmado |

## 4. Objetivos e invariantes financieras

### 4.1 Objetivos

- Reconstruir el destino de cada unidad menor de una operación.
- Garantizar que un reintento no duplique cobros, liberaciones ni reembolsos.
- Mantener separados estados provisionales, confirmados, rechazados y desconocidos.
- Explicar a las partes total, neto y tratamiento final de cada componente.
- Permitir conciliación y cierre sin depender de interpretación manual del historial.
- Impedir movimientos cuando una decisión `DP-*` necesaria no está aprobada.

### 4.2 Invariantes obligatorias

- **PF-INV-001.** Todo importe es entero en unidad menor y tiene moneda ISO 4217.
- **PF-INV-002.** Un asiento contable balancea débitos y créditos dentro de una sola moneda.
- **PF-INV-003.** Una operación ordinaria tiene una sola moneda; no se netean monedas distintas.
- **PF-INV-004.** Como máximo un intento de pago queda acreditado por operación (`INV-FIN-002`).
- **PF-INV-005.** El retorno del navegador no acredita ni confirma un movimiento (`INV-FIN-001`).
- **PF-INV-006.** Ninguna orden confirmada se edita o revierte por cambio de estado; se crea una orden compensatoria.
- **PF-INV-007.** Liberaciones, reembolsos y ajustes confirmados no exceden el principal y componentes disponibles para su causa (`INV-FIN-004`).
- **PF-INV-008.** Una orden con resultado desconocido se consulta antes de reintentar con la misma clave (`INV-FIN-005`).
- **PF-INV-009.** Una liberación exige pago acreditado y conciliado, envío válido, causa, capacidad verificada y ausencia de retenciones aplicables (`INV-FIN-009`).
- **PF-INV-010.** Una resolución no se confirma hasta asignar principal, comisión comprador, comisión vendedor, comisión de reclamo, impuestos/cargos y devolución.
- **PF-INV-011.** Política, desglose y regla de redondeo congelados nunca cambian retroactivamente.
- **PF-INV-012.** La suma algebraica del ledger completo por moneda es cero; el subledger de cada operación también debe balancear.
- **PF-INV-013.** Una diferencia de cuenta, operación, moneda o importe crea retención y revisión; no se “corrige” el dato para hacerlo coincidir.
- **PF-INV-014.** Analítica, dashboards y email no son fuentes de verdad financiera.
- **PF-INV-015.** Una combinación con capacidad desconocida se considera no soportada.

## 5. Modelo financiero neutral al proveedor

### 5.1 Conceptos canónicos

El dominio modela estos objetos sin asumir que correspondan uno a uno con objetos de Mercado Pago:

| Objeto | Propósito | Cardinalidad propuesta |
|---|---|---|
| `PaymentIntent` | Intento del comprador de pagar una operación | 0..N por operación |
| `ExternalCharge` | Cobro/operación observada en proveedor | 0..N por intento |
| `FeeAssessment` | Cálculo congelado de una comisión/impuesto | 0..N por operación |
| `Hold` | Retención funcional con causa y acciones bloqueadas | 0..N activas |
| `FinancialOrder` | Intención de liberar, reembolsar o ajustar | 0..N por operación |
| `ExternalMovement` | Movimiento observado asociado a una orden | 0..N por orden |
| `ChargebackCase` | Contracargo o revisión equivalente del proveedor | 0..N por pago |
| `JournalEntry` | Hecho económico balanceado | 0..N por operación |
| `SettlementBatch` | Liquidación externa agrupada | 0..N |
| `ReconciliationItem` | Resultado de comparación y diferencia | 0..N por objeto |

`PaymentIntent` y `FinancialOrder` son intenciones internas; `ExternalCharge` y `ExternalMovement` son observaciones externas; `JournalEntry` registra hechos económicos confirmados. No deben fusionarse en una sola tabla/estado.

### 5.2 Capabilities, no nombres de producto

La integración de pagos debe consultar una matriz versionada de capacidades por:

`proveedor + entorno + país + moneda + cuenta/plataforma + modelo contractual`.

Capacidades mínimas:

- crear cobro y consultar estado;
- verificar origen de webhook;
- clave idempotente y alcance de unicidad;
- retener/diferir disponibilidad, si existe;
- liberar/pagar a vendedor, si existe;
- reembolso total y, solo si se aprueba, parcial;
- reversión/cancelación y límites temporales;
- comisiones/costos informados por proveedor;
- contracargos, reservas y saldo negativo;
- onboarding/KYC de vendedor y destino de fondos;
- reportes de liquidación y conciliación;
- estados definitivos y eventos tardíos.

La ausencia de evidencia para una capacidad equivale a `UNVERIFIED` y bloquea el flujo afectado con `ERR-POL-009` o `CAPACIDAD_NO_VERIFICADA`.

## 6. Libro mayor de doble entrada

### 6.1 Decisión

Se adopta un **ledger de doble entrada append-only**. Una tabla de saldos mutables o una suma de movimientos del proveedor no es equivalente porque no obliga a balancear, no separa obligaciones y activos, y dificulta compensaciones y auditoría.

El ledger es un subledger operativo. La contabilidad legal/fiscal de la entidad puede exigir un plan de cuentas, criterios de reconocimiento y exportaciones adicionales. Finanzas/Contabilidad debe aprobar el mapeo antes de producción.

### 6.2 Estructura conceptual

Un `JournalEntry` contiene:

- `journal_entry_id`, tipo, moneda, instante contable y estado `POSTED`;
- referencia causal: operación, intento, orden, disputa, resolución, contracargo o settlement;
- versión de política y correlación;
- al menos dos `Posting`;
- total débito igual a total crédito;
- hash o control de integridad, autor/sistema y fecha de creación;
- referencia a asiento compensado cuando corresponda.

Un `Posting` contiene cuenta, lado débito/crédito, importe positivo en unidad menor, operación, participante económico cuando corresponda y dimensiones no sensibles. Un asiento posteado no se edita ni elimina.

### 6.2.1 Compatibilidad con el contrato de datos 06

El recurso lógico `ledger_entry` de `06_DATA_AND_API_CONTRACTS.md` debe implementarse como un asiento agrupador más dos o más postings, o como filas que compartan un `journal_entry_id` y cuya restricción diferida garantice balance. Una fila aislada con “dirección” e importe no constituye por sí sola una partida doble. El contrato físico debe permitir verificar balance atómicamente antes de `POSTED`.

La propuesta de resolución del documento 06 usa destinos resumidos y marcadores `POLICY_REQUIRED`. En la implementación:

- `base_amount.destination = BUYER` mapea a `REFUND_BUYER` o `RETURN_THEN_REFUND` según outcome;
- `base_amount.destination = SELLER` mapea a `PAY_SELLER`;
- cada `POLICY_REQUIRED` debe resolverse a uno de los estados de asignación de §14.1;
- ningún marcador de ejemplo puede persistir en una resolución confirmada;
- el contrato OpenAPI derivado debe expresar estas restricciones como enums/discriminadores y validar exhaustividad.

### 6.3 Plan de cuentas lógico mínimo

| Tipo | Cuenta lógica | Uso |
|---|---|---|
| Activo | `PROVIDER_CLEARING` | Importe confirmado que el proveedor debe/liquida a la entidad según modelo contractual |
| Activo | `BANK_CASH` | Efectivo conciliado en banco |
| Activo | `PROVIDER_RESERVE_RECEIVABLE` | Reserva/retención del proveedor reconocida cuando exista evidencia |
| Activo | `CHARGEBACK_RECEIVABLE` | Recuperación esperada autorizada, si la política contable lo admite |
| Pasivo | `PROTECTED_PRINCIPAL` | Principal pendiente de asignación final dentro de la operación |
| Pasivo | `SELLER_PAYABLE` | Importe confirmado pagadero al vendedor |
| Pasivo | `BUYER_REFUND_PAYABLE` | Importe confirmado a devolver al comprador |
| Pasivo | `TAX_PAYABLE` | Impuesto recaudado y pendiente de remisión |
| Ingreso | `BUYER_FEE_REVENUE` | Comisión comprador reconocida |
| Ingreso | `SELLER_FEE_REVENUE` | Comisión vendedor reconocida |
| Ingreso | `DISPUTE_FEE_REVENUE` | Comisión de reclamo reconocida si `DP-006` lo autoriza |
| Gasto | `PROVIDER_PROCESSING_EXPENSE` | Costo confirmado del proveedor |
| Gasto | `REFUND_OR_CHARGEBACK_EXPENSE` | Costos no recuperables autorizados |
| Gasto | `FRAUD_OR_CREDIT_LOSS` | Pérdida reconocida por política contable |
| Control | `SUSPENSE_UNMATCHED` | Diferencia temporal excepcional; siempre con SLA y owner |

Las cuentas “protected” o “payable” describen una obligación interna; no declaran una cuenta bancaria segregada ni una figura fiduciaria. `SUSPENSE_UNMATCHED` nunca debe usarse para cerrar una operación ni ocultar diferencias.

### 6.4 Dimensiones y balances

Cada posting debe identificar:

- moneda y operación;
- cuenta lógica;
- país y entidad legal aplicable;
- proveedor/cuenta externa cuando corresponda;
- componente (`PRINCIPAL`, `BUYER_FEE`, `SELLER_FEE`, `DISPUTE_FEE`, `TAX`, `PROVIDER_COST`, `RETURN_SHIPPING`, `ADJUSTMENT`);
- participante económico funcional, sin exponer datos personales;
- snapshot y causa.

Balances derivados:

- saldo del principal protegido por operación;
- importe pagadero al vendedor;
- importe reembolsable al comprador;
- ingresos por tipo de comisión;
- impuestos por jurisdicción;
- clearing y settlement por proveedor/moneda;
- diferencias sin conciliar.

No se persiste un saldo como única verdad. Si se materializa por rendimiento, se reconstruye y compara con postings.

### 6.5 Asientos canónicos ilustrativos

Los siguientes ejemplos muestran la forma, no el momento legal de reconocimiento. El evento exacto de reconocimiento de comisiones depende de `DP-005`, `DP-006`, `DP-007` y Contabilidad.

#### A. Pago confirmado por principal y comisión del comprador

Supuesto ilustrativo: el proveedor confirma un cobro total `T = B + F_b + Tax_b`.

| Cuenta | Débito | Crédito |
|---|---:|---:|
| `PROVIDER_CLEARING` | `T` | — |
| `PROTECTED_PRINCIPAL` | — | `B` |
| `BUYER_FEE_REVENUE` | — | `F_b` |
| `TAX_PAYABLE` | — | `Tax_b` |

Si la comisión aún no se reconoce, se acredita primero a un pasivo de ingreso diferido y luego se reclasifica mediante otro asiento. La política contable decide; nunca se reescribe el asiento original.

#### B. Resolución/liberación del principal con comisión del vendedor

Supuesto ilustrativo: `SellerNet = B - F_s - Tax_s`.

| Cuenta | Débito | Crédito |
|---|---:|---:|
| `PROTECTED_PRINCIPAL` | `B` | — |
| `SELLER_PAYABLE` | — | `SellerNet` |
| `SELLER_FEE_REVENUE` | — | `F_s` |
| `TAX_PAYABLE` | — | `Tax_s` |

El pago confirmado al vendedor cancela `SELLER_PAYABLE` contra `PROVIDER_CLEARING` o `BANK_CASH`, según el rail real.

#### C. Reembolso del principal

Al autorizar el derecho al reembolso:

| Cuenta | Débito | Crédito |
|---|---:|---:|
| `PROTECTED_PRINCIPAL` | `B` | — |
| `BUYER_REFUND_PAYABLE` | — | `B` |

Al confirmarse el movimiento:

| Cuenta | Débito | Crédito |
|---|---:|---:|
| `BUYER_REFUND_PAYABLE` | `B` | — |
| `PROVIDER_CLEARING` o `BANK_CASH` | — | `B` |

El reembolso o retención de `F_b`, `F_s`, `F_d` e impuestos genera líneas separadas conforme a la resolución; no se deduce del principal.

#### D. Costo confirmado del proveedor

| Cuenta | Débito | Crédito |
|---|---:|---:|
| `PROVIDER_PROCESSING_EXPENSE` | `C_p` | — |
| `PROVIDER_CLEARING` | — | `C_p` |

Si el proveedor descuenta el costo dentro del settlement, se concilia al mismo importe sin modificar las comisiones cobradas al usuario.

### 6.6 Reservas lógicas

Al crear una orden financiera se registra una reserva sobre componentes disponibles. La reserva:

- evita dos órdenes incompatibles;
- tiene causa, importe, moneda, estado y expiración operativa;
- se crea en la misma transacción que la orden;
- se consume al confirmar o se libera al rechazo/cancelación comprobados;
- no es un posting de ledger salvo que Contabilidad defina cuentas memo separadas;
- no puede vencer automáticamente si la orden fue enviada y su resultado es desconocido.

## 7. Comisiones, impuestos y redondeo

### 7.1 Configuración versionada

Cada `FeePolicy` debe incluir:

- tipo de comisión: comprador, vendedor, reclamo u otra aprobada;
- ámbito y vigencia;
- base de cálculo explícita;
- tasa racional, importe fijo, mínimo y máximo;
- moneda del componente fijo;
- regla y etapa de redondeo;
- impuestos incluidos/adicionados y jurisdicción;
- evento de cálculo, congelación, cobro y reconocimiento;
- tratamiento por resultado de disputa;
- autor, aprobación, versión y motivo.

No se permiten porcentajes binarios de punto flotante. Se recomienda representar la tasa como `rate_numerator / rate_denominator`, con denominador fijo documentado —por ejemplo partes por millón— o como decimal exacto arbitrario convertido a entero racional al publicar.

### 7.2 Fórmula canónica

Sea:

- `B`: base en unidades menores;
- `r_n/r_d`: tasa exacta;
- `F`: importe fijo en unidades menores;
- `Min`, `Max`: límites opcionales;
- `Round(x, mode)`: redondeo de la moneda/política.

```text
percent_component = Round(B × r_n / r_d, mode)
fee_before_bounds  = percent_component + F
fee                = min(Max, max(Min, fee_before_bounds))
```

Cuando un límite no existe no participa. El orden “redondear porcentaje → sumar fijo → aplicar límites” debe permanecer versionado; cambiarlo crea otra política. Si impuestos se calculan sobre la comisión:

```text
fee_tax = Round(fee × tax_n / tax_d, tax_rounding_mode)
buyer_total = principal + buyer_fee + buyer_fee_tax + otros_cargos_comprador
seller_net  = principal - seller_fee - seller_fee_tax - otras_retenciones_vendedor
```

Todas las líneas deben reconciliar con el monto externo. Si el proveedor añade un cargo no conocido, la operación se bloquea hasta clasificarlo; no se redistribuye silenciosamente.

### 7.3 Reglas de redondeo

- La moneda define cantidad de decimales, pero la operación interna ya usa unidades menores.
- La política define `HALF_UP`, `HALF_EVEN`, `FLOOR`, `CEILING` u otra regla aprobada.
- Se redondea una vez por componente en la etapa congelada; no sobre totales agregados si eso cambia la suma.
- El desglose debe satisfacer exactamente: total comprador, neto vendedor, impuestos y componentes.
- Una moneda sin decimales usa la misma fórmula sobre su unidad mínima.
- Los ejemplos de simulación se almacenan con resultado esperado y se ejecutan antes de publicar una política.

### 7.4 Snapshot financiero

La operación debe preservar:

- monto base y moneda;
- IDs/versiones de políticas candidatas y regla ganadora;
- inputs de país, categoría, riesgo permitido y fecha efectiva;
- fórmula normalizada, tasa, fijo, límites y redondeo;
- cada componente resultante;
- total comprador y neto estimado vendedor;
- textos/consentimientos mostrados;
- hito e instante de congelación.

`DP-005` determina el hito. Hasta aprobarlo, el sistema puede simular, pero no habilitar pagos productivos.

### 7.5 Valores propuestos, no constantes

Los valores 1% comprador, 1% vendedor y 3% reclamo son solo propuestas del PRD. Deben cargarse como políticas de entorno, permanecer inactivos hasta aprobación y tener pruebas de límites/redondeo. Ningún test productivo debe asumirlos como verdad universal.

## 8. Ciclo de cobro

### 8.1 Estados y objetos

Se adopta `SM-PAG` del documento 03. El adaptador conserva el estado externo original y lo mapea a:

`CREATED`, `PENDING_USER_PROVIDER`, `UNDER_REVIEW`, `ACCREDITED_PENDING_RECONCILIATION`, `ACCREDITED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `INCONSISTENT`.

“Aprobado” externo no equivale automáticamente a `ACCREDITED`: debe validarse que el estado signifique fondos disponibles conforme al modelo contractual aprobado.

### 8.2 Creación

1. Validar operación, comprador, vigencia, snapshot, país/moneda y capacidades.
2. Crear `PaymentIntent` con idempotencia y monto esperado dentro de una transacción.
3. Escribir outbox antes de invocar al proveedor.
4. El worker crea el objeto externo con referencia única de operación e intento.
5. Guardar respuesta, referencia, cuenta y estado provisional.
6. Entregar al comprador únicamente el mecanismo de continuación permitido.

No se crea un segundo intento incompatible mientras el anterior pueda acreditar. Un reintento del usuario con la misma clave devuelve el intento existente.

### 8.3 Acreditación

Requisitos acumulativos:

- webhook auténtico o consulta autorizada;
- objeto externo pertenece a la cuenta/entorno esperados;
- referencia correlaciona una operación e intento únicos;
- monto total y moneda coinciden exactamente;
- pagador/destino coinciden cuando el proveedor los expone y la política permite usarlos;
- estado externo está mapeado a acreditable en la matriz vigente;
- no existe otro intento acreditado;
- asiento de cobro balanceado creado una vez;
- conciliación transaccional `MATCHED`.

Solo entonces se emite `EVT-PAG-002 PagoAcreditado`. Si la solicitud estaba `CANCELLED` o `EXPIRED`, conserva ese estado terminal y se abre el subproceso ortogonal `FinancialExceptionReview` con hold `LATE_PAYMENT_REVIEW`; nunca se habilita despacho automáticamente.

## 9. Holds, liberaciones, reembolsos y ajustes

### 9.1 Retenciones

Se usa el catálogo canónico del documento 03: `DISPUTE_OPEN`, `RISK_REVIEW`, `CHARGEBACK`, `PAYMENT_INCONSISTENCY`, `FINANCIAL_ORDER_UNKNOWN`, `SHIPMENT_INCIDENT`, `RETURN_INCIDENT`, `ADMINISTRATIVE`, `PROVIDER_CAPABILITY_UNVERIFIED` y `LATE_PAYMENT_REVIEW`. Cada retención tiene:

- autoridad de origen y causal estructurada;
- acciones bloqueadas;
- instante, evidencia/referencia y SLA;
- autoridad autorizada para levantarla;
- resultado de reevaluación al levantar.

Levantar una retención nunca ejecuta automáticamente una liberación o reembolso: solo encola una nueva evaluación con todas las guardas.

### 9.2 Orden financiera

Se adopta `SM-FIN`. La orden incluye:

- tipo `RELEASE`, `REFUND` o `AUTHORIZED_ADJUSTMENT`;
- operación, moneda, importe y componentes;
- beneficiario funcional y destino externo validado;
- causa: confirmación, vencimiento, resolución, devolución o compensación;
- snapshot/resolución y aprobaciones;
- clave idempotente estable;
- reserva lógica y postings previstos;
- referencia externa, intentos, observaciones y conciliación.

### 9.3 Liberación

Antes de `READY_TO_SEND` se revalidan en una transacción:

- pago acreditado y conciliado;
- causa vigente y no consumida;
- envío declarado;
- política de notificación efectiva `DP-021` satisfecha para una autoliberación; si falta o falla, denegar y escalar;
- ausencia de disputa y retenciones aplicables;
- capacidad real de movimiento y destino habilitado;
- saldo lógico y ledger balanceado;
- desglose de comisión vendedor aprobado;
- KYC/riesgo requerido satisfecho (`DP-012`, `DP-013`);
- idempotencia y ausencia de orden incompatible.

La confirmación del comprador autoriza evaluar; no garantiza que el proveedor complete el movimiento. La operación sigue no terminal mientras la orden esté pendiente o incierta.

### 9.4 Reembolso

Antes de enviar:

- existe cancelación elegible, resolución confirmada o devolución cuyo hito se cumplió;
- la matriz declara reembolso disponible para el objeto/importe/ventana;
- cada componente indica `REFUND`, `RETAIN`, `NOT_CHARGED`, `PAY_TO_SELLER`, `EXPENSE` o `UNRESOLVED`;
- ningún componente está `UNRESOLVED`;
- el importe no excede lo pagado y aún reembolsable;
- no hay orden incompatible, chargeback ya aplicado o resultado incierto;
- aprobaciones y destino original cumplen contrato/política.

Los reembolsos parciales permanecen fuera del MVP salvo decisión explícita y capacidad verificada. Un acuerdo entre partes que requiera parcial queda en revisión, no se aproxima a total.

### 9.5 Resultado desconocido

Ante timeout después de enviar:

1. marcar `RESULT_UNKNOWN` y agregar retención `FINANCIAL_ORDER_UNKNOWN`;
2. conservar la misma clave idempotente;
3. consultar por referencia/idempotencia en el proveedor;
4. procesar webhooks correlacionados;
5. solo reintentar si se demuestra que no fue aceptada y el error es reintentable;
6. si no puede determinarse, escalar a revisión manual y mantener no terminal.

### 9.6 Compensaciones

Una corrección financiera crea:

- autorización y motivo;
- nueva orden con referencia causal a la original;
- nuevo asiento de signo económico contrario o nueva asignación;
- aprobación secundaria si supera umbral;
- notificación y evidencia operativa.

Nunca cambia el estado de una orden `CONFIRMED` ni elimina postings.

## 10. Webhooks, polling e idempotencia

### 10.1 Recepción

El endpoint debe conservar el cuerpo bruto necesario, verificar el mecanismo oficial aplicable, limitar tamaño/frecuencia y persistir en inbox antes de procesar. Responde rápido; no realiza una cadena financiera larga en la solicitud.

Campos mínimos de inbox:

- proveedor, entorno y `account_scope` receptor;
- identificador externo de evento o clave derivada;
- headers relevantes redactados y hash del cuerpo;
- tipo y referencia externa declarados;
- recepción UTC, estado de autenticidad y procesamiento;
- intentos, error, correlación y resolución final.

Un evento no auténtico se conserva de forma restringida para seguridad, no cambia estados y no se consulta siguiendo URLs arbitrarias aportadas en el payload.

### 10.2 Deduplificación y orden

- Restricción única por `(provider, environment, account_scope, external_event_id)`.
- Si no existe ID estable, fallback `(provider, environment, account_scope, resource_reference, observed_type, payload_hash)`; esa observación no produce efecto financiero directo y la consulta autoritativa confirma el hecho.
- Eventos duplicados devuelven éxito técnico sin repetir asientos/eventos.
- Eventos fuera de orden se anexan; una transición monotónica impide degradar un confirmado.
- Un mismo objeto con monto/moneda distintos crea inconsistencia, no actualización destructiva.

### 10.3 Polling y reconciliación programada

La consulta autoritativa es una fuente de confirmación equivalente al webhook autenticado cuando se correlaciona y reconcilia; no requiere que el webhook haya llegado. El polling programado aporta recuperación y seguimiento. Casos mínimos:

- intento pendiente más allá de ventana;
- señal de acreditación pendiente de conciliación;
- webhook ausente o no procesable;
- orden enviada/pendiente/resultado desconocido;
- liquidación esperada no recibida;
- contracargo/revisión abierta;
- reconciliación diaria y de cierre.

Intervalos, backoff, límites y antigüedad de escalamiento son configurables por proveedor/objeto. Una consulta tardía usa la referencia persistida y nunca reinicia el movimiento.

### 10.4 Claves estables

| Efecto | Clave mínima |
|---|---|
| Crear pago | `operation:{op}:payment_intent:{intent}` |
| Acreditar | `operation:{op}:accredit:{provider_charge}` |
| Cobrar comisión reclamo | `operation:{op}:dispute_fee:{dispute}:{policy}` |
| Liberar | `operation:{op}:release:{cause}:{resolution_version}` |
| Reembolsar | `operation:{op}:refund:{cause}:{resolution_version}` |
| Ajustar | `operation:{op}:adjustment:{authorization}` |
| Postear asiento | `journal:{business_event_id}:{journal_type}` |
| Procesar webhook | `provider:{provider}:env:{environment}:account:{account_scope}:event:{external_event_id}` |
| Conciliar | `reconcile:{object_type}:{object_id}:{source_version}` |

La misma clave con payload material distinto es conflicto y alerta financiera.

## 11. Conciliación

### 11.1 Niveles

1. **Transaccional:** objeto del proveedor contra intento/orden y ledger.
2. **Settlement:** reporte de liquidación contra objetos externos y clearing.
3. **Bancaria:** depósito/débito real contra settlement y `BANK_CASH`.

Cerrar una operación exige conciliación transaccional; cerrar un periodo financiero exige los tres niveles disponibles. Si el modelo no ofrece settlement o banco directo, la limitación se documenta y el control alternativo debe aprobarse.

### 11.2 Estados

`UNMATCHED`, `PARTIAL`, `MATCHED`, `MISMATCH_AMOUNT`, `MISMATCH_CURRENCY`, `MISMATCH_ACCOUNT`, `DUPLICATE`, `MISSING_INTERNAL`, `MISSING_EXTERNAL`, `TIMING_DIFFERENCE`, `UNDER_REVIEW`, `RESOLVED`.

`RESOLVED` requiere motivo, evidencia, actor, acción y referencia al ajuste si hubo. No equivale a borrar la diferencia.

### 11.3 Reglas

- **RC-001.** Comparar identificador, cuenta, operación, moneda, bruto, costos, neto, estado e instante.
- **RC-002.** Toda línea externa debe emparejar una interna o quedar en excepción con owner/SLA.
- **RC-003.** Todo asiento que dependa de proveedor debe vincular una observación externa.
- **RC-004.** Las diferencias temporales envejecen; no se clasifican perpetuamente como timing.
- **RC-005.** No se cierra una operación con principal en suspense.
- **RC-006.** Ajustes se postean; no se editan importes originales.
- **RC-007.** Los costos del proveedor se concilian separados de comisiones de plataforma.
- **RC-008.** Settlement neto se descompone a sus líneas; no se reparte proporcionalmente sin evidencia.
- **RC-009.** La conciliación es repetible e idempotente para la misma versión de fuente.
- **RC-010.** Una diferencia sobre umbral o edad genera alerta y retención de automatización afectada.

### 11.4 Frecuencia propuesta

- Near-real-time: acreditaciones, liberaciones, reembolsos y contracargos recibidos.
- Cada 5–15 minutos: pendientes/resultado desconocido, ajustable por límites del proveedor.
- Diario: objetos del día anterior, comisiones/costos y settlement.
- Mensual: cierre por moneda/cuenta/entidad y certificación de saldos.

Los intervalos son punto de partida operativo, no SLO aprobado (`DP-020`).

### 11.5 Cierre diario

El proceso genera por proveedor/cuenta/moneda:

- saldo inicial de clearing;
- cobros, liberaciones, reembolsos, costos, reservas y contracargos;
- settlements y movimientos bancarios;
- saldo final esperado/observado;
- partidas abiertas por tipo y antigüedad;
- certificación del operador y, sobre umbral, segundo revisor.

## 12. Contracargos, reservas y saldo negativo

`DP-013` bloquea la política definitiva. El modelo debe, no obstante, soportar:

- notificación de revisión/contracargo y su evidencia original;
- estados `OPEN`, `EVIDENCE_REQUIRED`, `SUBMITTED`, `WON`, `LOST`, `REVERSED`, `UNKNOWN`;
- retención inmediata de nuevas liberaciones relacionadas cuando sea legal/contractualmente permitido;
- vínculo con pago, operación, seller y settlement;
- importe, moneda, costos y plazo del proveedor;
- presentación de evidencia autorizada sin exponer datos de la disputa interna innecesariamente;
- asiento separado al confirmar débito, reversión o pérdida;
- política de responsable económico, reserva y recuperación;
- tratamiento de una operación ya cerrada mediante ajuste, nunca reescritura.

Antes del piloto deben aprobarse:

- quién absorbe principal, costos y saldo negativo;
- si se mantienen reservas previas a liberación y con qué límites;
- qué acciones se toman sobre vendedor/comprador y operaciones activas;
- cuándo se reconoce pérdida o recuperable;
- tratamiento de contracargo ganado/perdido después de reembolso o devolución.

Sin política aprobada, un contracargo crea hold `CHARGEBACK` y, cuando corresponda, `EXCEPTION_REVIEW`; no debita automáticamente a un usuario.

## 13. Disputas: expediente y SLA

### 13.1 Principios

- Fallo humano en el MVP.
- Igual oportunidad de aportar evidencia relevante.
- Acuerdo aceptado, cronología, tracking y evidencia de plataforma son fuentes; ninguna señal aislada decide universalmente.
- La ausencia de evidencia no equivale automáticamente a fraude.
- La resolución explica hechos considerados, regla aplicada y cada importe.
- La comisión de reclamo no debe impedir la apertura antes de resolver `DP-006` y su validación legal.
- Un reclamo válido crea la retención en la misma transacción que la disputa (`INV-DIS-001`).

### 13.2 Expediente mínimo

- operación, acuerdo y snapshot;
- pago, ledger y estado reconciliado;
- envío, tracking versionado y deadlines;
- motivo, alegación original y respuestas;
- evidencia con hash, autor, fecha y visibilidad;
- solicitudes de información y cumplimiento;
- revisor, conflicto declarado y actividad;
- propuestas versionadas, aprobaciones y fallo;
- asignación financiera y órdenes derivadas;
- devolución e incidencias si aplica;
- auditoría de acceso y comunicaciones críticas.

### 13.3 SLA configurable

Cada etapa debe tener política explícita:

- ventana para abrir reclamo;
- respuesta inicial del vendedor;
- evidencia adicional de cada parte;
- revisión de operaciones;
- información solicitada;
- segunda aprobación;
- despacho y confirmación de devolución;
- corrección/apelación si se habilita.

Un deadline conserva inicio, fin UTC, zona, calendario, causa, política y regla ante inacción. `DP-010` define días hábiles/corridos y cortes; `DP-014` define valores y apelación. Un SLA vencido no asigna dinero salvo consecuencia aprobada y congelada.

### 13.4 Evidencia

- Originales y metadatos no se sobrescriben.
- Archivos deben completar cuarentena y análisis antes de ser utilizables.
- La visibilidad es compartida, operaciones-only, nota interna o restringida.
- La clasificación no puede ocultar la razón sustancial del fallo.
- El revisor registra qué evidencia consultó; nuevas evidencias concurrentes invalidan la versión de propuesta.
- Capturas y metadatos se tratan como indicios, no como autenticidad garantizada.
- Tracking externo requiere fuente, timestamp y payload/evento original cuando esté disponible.

### 13.5 Doble aprobación

Se exige cuando la política lo determine por monto normalizado, tipo de resultado, excepción, conflicto de señales, ajuste o rol. El segundo aprobador:

- debe ser persona distinta del proponente;
- debe tener permiso y no declarar conflicto;
- ve expediente, propuesta, asignación e impacto irreversible;
- aprueba exactamente una versión; cualquier cambio invalida la aprobación;
- puede rechazar con motivo y devolver a revisión;
- no puede ejecutar mediante edición directa del estado.

El método de normalización de umbrales entre monedas permanece bajo Finanzas (`PE-005`); no se usa FX implícito.

## 14. Matriz de resolución financiera

### 14.1 Asignación obligatoria

Toda propuesta contiene una línea por componente:

| Componente | Estados de asignación permitidos |
|---|---|
| Principal | `PAY_SELLER`, `REFUND_BUYER`, `RETURN_THEN_REFUND`, `UNRESOLVED` |
| Comisión comprador | `RETAIN`, `REFUND`, `NOT_CHARGED`, `UNRESOLVED` |
| Comisión vendedor | `CHARGE`, `WAIVE`, `NOT_APPLICABLE`, `UNRESOLVED` |
| Comisión reclamo | `CHARGE`, `REFUND`, `WAIVE`, `NOT_CHARGED`, `UNRESOLVED` |
| Impuesto por comisión | `RETAIN_PAYABLE`, `REVERSE`, `NOT_APPLICABLE`, `UNRESOLVED` |
| Costo proveedor | `PLATFORM_EXPENSE`, `ALLOCATE_IF_LEGAL`, `UNRESOLVED` |
| Envío devolución | `BUYER`, `SELLER`, `PLATFORM`, `OTHER_APPROVED`, `UNRESOLVED` |

`UNRESOLVED` impide confirmar. `ALLOCATE_IF_LEGAL` exige regla aprobada; no es una asignación final.

### 14.2 Resultados del MVP

| Resultado | Principal | Orden inmediata | Requisito adicional |
|---|---|---|---|
| Liberar al vendedor | `PAY_SELLER` | Liberación | Capacidad, saldo, fees y aprobaciones |
| Reembolsar sin devolución | `REFUND_BUYER` | Reembolso | Capacidad y tratamiento de todas las comisiones |
| Exigir devolución | `RETURN_THEN_REFUND` | Ninguna al fallar | Instrucciones y hito escrito `DP-015/016` |
| Acuerdo verificable | Una opción soportada | Según asignación | Aceptación verificable y movimiento soportado |

Los resultados parciales o combinaciones principal dividido permanecen fuera del MVP. Si un acuerdo requiere parcial, se mantiene en revisión hasta que Producto/Legal/Pagos lo aprueben y los contratos se actualicen.

### 14.3 Plantilla de resolución

```text
Resultado: [LIBERAR | REEMBOLSAR | DEVOLVER | ACUERDO]
Versión del expediente revisada: [...]
Hechos considerados: [...]
Regla/política aplicada: [...]

Principal:                 [importe] -> [destino/condición]
Comisión comprador:        [importe] -> [tratamiento]
Impuesto comisión comp.:   [importe] -> [tratamiento]
Comisión vendedor:         [importe] -> [tratamiento]
Impuesto comisión vend.:   [importe] -> [tratamiento]
Comisión de reclamo:       [importe] -> [tratamiento]
Costo proveedor:           [importe] -> [tratamiento]
Envío de devolución:       [responsable y límite]

Hito que autoriza movimiento: [...]
Capacidad externa verificada: [ID y versión]
Aprobaciones: [...]
Explicación para comprador: [...]
Explicación para vendedor: [...]
```

### 14.4 Reglas por resultado

#### Liberar al vendedor

- No existe retención incompatible.
- El neto se calcula desde principal menos líneas aprobadas; nunca desde un porcentaje nuevo.
- La comisión comprador no modifica el principal salvo política explícita.
- Se crea una sola orden y reserva.

#### Reembolsar sin devolución

- Debe indicarse si cada comisión se reembolsa, retiene, condona o no fue cobrada.
- Costos irrecuperables del proveedor no se pasan a una parte sin aprobación legal/política.
- El medio/destino del reembolso sigue el contrato y se valida antes de enviar.

#### Devolución antes de reembolso

- El fallo fija artículo/accesorios, destino validado, transportista/modalidad, responsable del costo, evidencia, deadline, hito y regla de silencio/incumplimiento.
- No se crea orden de reembolso hasta cumplir el hito de `DP-016` y reevaluar incidencias/contracargos.
- El tracking no prueba universalmente conformidad; aplica exactamente la regla del fallo.

#### Acuerdo entre partes

- Se modela mediante `SettlementProposal` versionada dentro de una disputa activa, no como texto libre ni aceptación unilateral.
- Estados persistentes canónicos: `DRAFT`, `OPEN`, `PARTIALLY_ACCEPTED`, `SUBMITTED_FOR_REVIEW`, `INCORPORATED_IN_RESOLUTION`, `REVOKED`, `EXPIRED`.
- La propuesta contiene autor, explicación compartible, allocation completa, requisitos no financieros, expiración, política y hash canónico.
- Comprador y vendedor aceptan por separado la misma versión/hash con autenticación, idempotencia e instante del servidor.
- La segunda aceptación registra el hecho de aceptación mutua y transiciona atómicamente `PARTIALLY_ACCEPTED → SUBMITTED_FOR_REVIEW`; no existe `MUTUALLY_ACCEPTED` como estado estable.
- La aceptación mutua no mueve dinero: crea candidato de resolución. Un administrador valida capacidad, saldo, legalidad, conflictos y aprobaciones antes de incorporar en `RESOLVED_SETTLEMENT`.
- Editar crea nueva versión y ninguna aceptación se arrastra. La versión puede revocarse antes de la doble aceptación o expirar; ambas acciones conservan historia y no resuelven la disputa.
- Aceptar la pretensión del comprador se representa mediante esta propuesta y aceptación, no como reembolso directo.
- La asignación debe mapear a movimientos soportados. No se etiqueta como “acuerdo” una decisión unilateral administrativa.

## 15. Devoluciones

Se adopta `SM-DEV`. Controles financieros:

- la devolución nace de resolución confirmada;
- no cambia por sí sola el saldo del ledger;
- el despacho crea un hecho logístico, no un reembolso;
- la recepción o hito aprobado crea elegibilidad, no éxito externo;
- una incidencia agrega retención y bloquea la orden;
- la inacción aplica solo la consecuencia escrita;
- si el comprador incumple, una liberación requiere causa explícita, no un default técnico;
- los costos logísticos se registran como componente incluso si se pagan fuera de plataforma;
- paquete perdido/dañado durante retorno queda en revisión hasta aplicar la política de responsabilidad aprobada.

## 16. Operación administrativa

### 16.1 Segregación de funciones

| Acción | Rol mínimo | Segundo control |
|---|---|---|
| Ver datos financieros no sensibles | Soporte autorizado | No |
| Ver evidencia sensible | Operaciones con necesidad | Gateway autenticado + auditoría del actor |
| Proponer resolución | Admin. disputas | Según umbral/regla |
| Aprobar resolución | Segundo admin elegible | Persona distinta |
| Reintentar error no ambiguo | Operaciones financieras | Según importe |
| Resolver resultado desconocido | Operaciones financieras | Revisión obligatoria |
| Crear ajuste | Finanzas autorizado | Sí sobre umbral o siempre, según política |
| Publicar política de fees | Admin sistema/Finanzas | Recomendada siempre |
| Levantar retención de riesgo | Riesgo autorizado | Según regla |
| Marcar conciliación resuelta | Finanzas/conciliación | Evidencia y, sobre umbral, revisor |

Ningún rol puede editar directamente ledger, estado externo, saldo o fallo.

Los roles administrativos están deny-by-default hasta aprobar `DTA-SEC-001` (IdP corporativo, MFA, sesión/origen separados, lifecycle, recent auth y break-glass). Las notas internas usan `internal_admin_note` append-only con autor, propósito, visibilidad `ADMIN_ONLY`, retención y auditoría; no se almacenan como evidencia, submission de una parte ni log de auditoría genérico.

### 16.2 Bandejas

- pagos acreditables pendientes de conciliación;
- pagos tardíos de solicitudes canceladas/expiradas;
- órdenes en resultado desconocido o revisión;
- diferencias por nivel de conciliación y antigüedad;
- disputas por SLA, monto, país, motivo y revisor;
- propuestas pendientes de segunda aprobación;
- devoluciones próximas/vencidas e incidencias;
- contracargos y reservas;
- operaciones con saldo no cero tras cierre esperado.

Cada item tiene owner, severidad, deadline, última acción, siguiente paso permitido y correlación.

## 17. Runbooks

### RB-PD-01 — Pago reportado como exitoso por el navegador, sin acreditación

1. Mantener estado “verificando”; no habilitar envío.
2. Consultar la fuente autoritativa por referencia persistida; un webhook autenticado recibido en paralelo se procesa con el mismo scope.
3. Correlacionar y conciliar; no exigir que ambos canales hayan llegado.
4. Si no existe objeto, permitir nuevo intento solo cuando el anterior sea terminal/no acreditable.
5. Si existe pero difiere, retener y aplicar RB-PD-03.

### RB-PD-02 — Pago acreditado después de expirar/cancelar

1. Mantener `CANCELLED`/`EXPIRED`; crear `FinancialExceptionReview=OPEN` y hold `LATE_PAYMENT_REVIEW`; no habilitar despacho.
2. Conciliar cobro y postear el hecho confirmado.
3. Transicionar `OPEN → RECONCILING → PENDING_DECISION` sin reabrir la operación.
4. Evaluar compensación/reembolso según capacidad y política; crear una orden única si se autoriza.
5. Cerrar en `CLOSED_COMPENSATED` o `CLOSED_NO_MOVEMENT`, preservando el terminal de operación.
6. Notificar sin prometer plazo o resultado no confirmado.

### RB-PD-03 — Diferencia de monto, moneda, cuenta o duplicado

1. Marcar `INCONSISTENTE` y retener acciones.
2. Preservar payload y consulta oficial.
3. Comparar snapshot, objeto externo, ledger y settlement.
4. No modificar el monto interno para hacerlo coincidir.
5. Resolver con ajuste/reembolso autorizado o escalar; registrar causa raíz.

### RB-PD-04 — Liberación o reembolso con resultado desconocido

1. Detener retries automáticos y conservar reserva.
2. Consultar proveedor con referencia y clave original.
3. Procesar webhooks pendientes/fuera de orden.
4. Si se confirma, postear y cerrar idempotentemente.
5. Si se demuestra rechazo/no creación, reevaluar y reintentar con la misma identidad lógica.
6. Si persiste la ambigüedad, revisión manual; jamás marcar éxito por conveniencia.

### RB-PD-05 — Webhook duplicado, tardío o inválido

1. Duplicado: reconocer recepción sin reaplicar.
2. Tardío: conservar y evaluar transición monotónica.
3. Inválido: no procesar; alerta de seguridad según volumen.
4. Si contradice estado confirmado, consultar proveedor y abrir diferencia.

### RB-PD-06 — Ledger desbalanceado o saldo imposible

1. Alerta P1 y detener automatización financiera del ámbito afectado.
2. No insertar posting manual para “cuadrar”.
3. Identificar primer asiento/versión divergente y correlaciones.
4. Comparar outbox, provider observations y migraciones.
5. Crear asiento compensatorio solo con autorización.
6. Reejecutar invariantes, reconciliar y documentar incidente.

### RB-PD-07 — Settlement o banco no concilia

1. Clasificar monto, moneda, cuenta, costo, duplicado o timing.
2. Vincular líneas externas e internas sin neteo arbitrario.
3. Asignar owner/SLA; retener cierres o payouts si el riesgo lo requiere.
4. Obtener reporte corregido o crear ajuste autorizado.
5. Certificar cierre solo sin diferencias materiales no explicadas.

### RB-PD-08 — Contracargo

1. Registrar caso y evidencia externa; retención inmediata permitida.
2. Identificar operaciones, seller, settlement y saldo expuesto.
3. Cumplir deadline de evidencia del proveedor.
4. No debitar automáticamente al usuario sin política `DP-013`.
5. Al resultado, postear débito/reversión/costo y crear ajuste si corresponde.
6. Revisar controles de riesgo y comunicar según Legal.

### RB-PD-09 — Disputa fuera de SLA

1. Escalar cola y reasignar si corresponde.
2. Preservar retención; el vencimiento no decide fondos por sí solo.
3. Notificar a las partes con nuevo estado/plazo solo si está autorizado.
4. Registrar causa operativa y medir breach.

### RB-PD-10 — Incidencia de devolución

1. Agregar retención de devolución.
2. Comparar fallo, tracking, evidencia y deadlines.
3. Solicitar información dentro de una ventana explícita.
4. Aplicar únicamente la consecuencia escrita o elevar para corrección excepcional.
5. No reembolsar/liberar mientras el hito siga controvertido.

### RB-PD-11 — Caída del proveedor

1. Deshabilitar nuevas operaciones afectadas mediante capability/kill switch.
2. Mantener pendientes no terminales y no instruir envío.
3. Aplicar backoff y límites; priorizar conciliación de movimientos ya enviados.
4. Comunicar estado sin afirmar pérdida o éxito.
5. Reanudar gradualmente tras consulta/reconciliación.

### RB-PD-12 — Error de política de comisión

1. Retirar la versión para nuevas operaciones; no mutar snapshots.
2. Identificar operaciones afectadas por versión/hito.
3. Determinar con Finanzas/Legal si corresponde compensación.
4. Crear política nueva y, si aplica, órdenes/asientos compensatorios.
5. Documentar aprobación, impacto y comunicación.

## 18. Controles preventivos y detectivos

### 18.1 Preventivos

- constraints únicos para acreditación, orden por causa, webhook y journal por evento;
- check de balance por journal y moneda;
- transacción y bloqueo común para reclamo/liberación;
- matriz de capacidad deny-by-default;
- snapshots inmutables y simulación de fees;
- RBAC/ABAC, autenticación reciente y doble aprobación;
- límites de importe/velocidad y KYC/riesgo según política;
- reserva lógica antes de enviar orden;
- validación de webhook y consulta oficial;
- despliegues/migraciones con segregación y rollback compatible.

### 18.2 Detectivos

- conciliación transaccional, settlement y bancaria;
- saldo de ledger por operación/moneda igual a cero algebraico;
- principal protegido o payable envejecido;
- orden duplicada, incierta o sin webhook;
- segundo pago acreditado;
- fee calculado distinto a snapshot;
- operación terminal con saldo residual;
- suspense o diferencia fuera de SLA;
- accesos y cambios administrativos auditados;
- tasas de disputa/contracargo y concentración por cuenta/categoría.

### 18.3 Evidencia de control

Cada control automatizado produce ejecución, versión, inputs, resultado, diferencias y correlación. Los controles manuales conservan responsable, checklist, evidencia, fecha y aprobación. Un dashboard verde sin evidencia durable no prueba ejecución.

## 19. Métricas y alertas

### 19.1 Métricas

- GMV acreditado por país/moneda y tasa de acreditación;
- payment intents pendientes por antigüedad;
- tiempo webhook → acreditación conciliada;
- órdenes por estado y duración;
- resultados desconocidos y retries;
- diferencias de conciliación por tipo/importe/edad;
- settlements/bancos sin cerrar;
- ingresos de fee y costos del proveedor por componente;
- saldo de principal protegido y payable por antigüedad;
- disputas, resolución p50/p90, outcome y SLA breach;
- devoluciones pendientes/incidentes;
- contracargos, win/loss y pérdida por volumen;
- ajustes manuales y doble aprobación.

### 19.2 Alertas

- P1: asiento desbalanceado, movimiento duplicado, payout/refund mayor al saldo, credencial comprometida.
- P1/P2: resultado desconocido o diferencia por encima del umbral.
- P2: conciliación o settlement fuera de SLA, segundo acreditado, operación cerrada con saldo residual.
- P2/P3: disputa/devolución fuera de SLA, webhook backlog o capability degradada.

Umbrales y SLO dependen de `DP-020`.

## 20. Capacidades Mercado Pago por validar

La prueba de concepto y revisión contractual deben completar esta matriz para cada país/moneda/cuenta. No marcar `VERIFIED` solo por observar una pantalla de sandbox.

| Capacidad | Evidencia requerida | Estado inicial |
|---|---|---|
| Crear cobro único por importe/moneda | Documentación + prueba sandbox y controlada | `UNVERIFIED` |
| Identificador e idempotencia de creación | Alcance, TTL, conflicto de payload | `UNVERIFIED` |
| Autenticidad y deduplicación de webhook | Firma/token, raw body, event ID, retry | `UNVERIFIED` |
| Consulta autoritativa del pago | Endpoint, estados, consistencia y límites | `UNVERIFIED` |
| Significado contractual de “aprobado/disponible” | Contrato + operación real controlada | `UNVERIFIED` |
| Retención/diferimiento de disponibilidad | Producto/cuenta/país y límites | `UNVERIFIED` |
| Liberación separada a vendedor | Destino, irreversibilidad, KYC y tiempos | `UNVERIFIED` |
| Reembolso total | Ventana, costos, estado final e idempotencia | `UNVERIFIED` |
| Reembolso parcial | Igual; además múltiples parciales y límites | Fuera de MVP / `UNVERIFIED` |
| Comisiones/split/marketplace | Titularidad, desglose y settlement | `UNVERIFIED` |
| Contracargos y reservas | Eventos, evidencia, plazos, débitos | `UNVERIFIED` |
| Reporte de settlement y costos | API/archivo, IDs, zona y correcciones | `UNVERIFIED` |
| Ambientes y paridad sandbox/producción | Diferencias documentadas | `UNVERIFIED` |
| Límites/rate limits/SLA | Contrato y medición | `UNVERIFIED` |

Gate: ninguna transición `TR-FIN-002` a proveedor se habilita si la capacidad específica no está `VERIFIED`, versionada y aprobada.

### 20.1 Ruta excepcional para obtener evidencia productiva

El gate anterior se mantiene para todas las operaciones ordinarias y para cualquier API o interfaz de participantes. Sin embargo, algunas capacidades requieren una observación productiva controlada para reunir la evidencia que permite decidir si pasan de `UNVERIFIED` a `VERIFIED`. R05A puede ejecutar esa verificación únicamente mediante un **caso de verificación financiera** separado de `TR-FIN-002` y no expuesto al producto.

El caso de verificación exige simultáneamente:

- `controlled_real_transaction_authorized: true` y las autorizaciones de cloud, despliegue productivo y proveedor real requeridas por R05A;
- plan firmado con proveedor/cuenta, país, moneda, operaciones exactas, monto máximo, cantidad máxima de intentos, participantes allowlisted, ventana temporal, responsables y aprobadores;
- identificador único, claves de idempotencia exclusivas, ledger, auditoría, correlación, conciliación y kill switch activos antes del primer efecto;
- endpoints/harness internos con identidad privilegiada específica, sin acceso desde UI, API pública, jobs ordinarios o cuentas de participantes;
- prohibición de ampliar el scope, reintentar un resultado desconocido sin consulta o continuar ante una diferencia no prevista;
- cierre, conciliación y tratamiento explícito del dinero de prueba conforme al plan aprobado.

La ruta excepcional **no crea un tercer estado de capacidad y no auto-promueve**. La capacidad permanece `UNVERIFIED` durante toda la ejecución. El resultado —éxito, falla o diferencia— se registra como evidencia. Una revisión humana posterior, con documentación contractual y el resto de pruebas requeridas, decide mantener `UNVERIFIED` o publicar una versión `VERIFIED` con scope y aprobaciones. Solo esa versión habilita `TR-FIN-002` ordinaria y la entrada a R05B.

## 21. Decisiones pendientes

### 21.1 Decisiones del PRD

| DP | Efecto en este documento |
|---|---|
| `DP-001` | Entidad, país piloto, cuentas, región y textos |
| `DP-002` | Figura legal y modelo real de fondos; bloquea arquitectura productiva |
| `DP-003` | Métodos y estados de Mercado Pago; bloquea cobro/liberación/reembolso |
| `DP-004` | Transfronterizo/FX; por omisión fuera del MVP |
| `DP-005` | Hito de congelación de fees y políticas |
| `DP-006` | Base, cobro, exención y devolución de comisión de reclamo |
| `DP-007` | Tratamiento de cada fee por outcome |
| `DP-008..010` | Plazos y consecuencias de despacho/confirmación |
| `DP-011` | Categorías y límites que determinan elegibilidad/riesgo |
| `DP-012` | KYC/AML y momento de verificación de destino |
| `DP-013` | Contracargos, reservas, pérdidas y saldo negativo |
| `DP-014` | SLA y apelación/corrección |
| `DP-015` | Responsable económico de devolución |
| `DP-016` | Hito que autoriza reembolso |
| `DP-019` | Persistencia/stack; arquitectura 05 propone PostgreSQL/outbox |
| `DP-020` | SLO, RTO/RPO, umbrales y go-live |
| `DP-021` | Eficacia, fallback y escalamiento de notificaciones críticas antes de automatización |
| `DTA-SEC-001` | IdP/MFA/sesiones/lifecycle/break-glass administrativo; consola deny-by-default |

### 21.2 Decisiones adicionales de Finanzas/Pagos

| ID | Decisión | Responsable sugerido | Bloquea |
|---|---|---|---|
| DPF-001 | Plan de cuentas legal y momento de reconocimiento de ingresos | Contabilidad/Legal | Postings productivos |
| DPF-002 | Tratamiento e impuestos de cada comisión por país | Fiscal/Finanzas | Fee policy |
| DPF-003 | Fuente y formato de settlement/banco | Finanzas/Pagos | Cierre completo |
| DPF-004 | Ventana de conciliación y materialidad | Finanzas/Riesgo | Alertas/cierre |
| DPF-005 | Cuenta/s de suspense permitidas y SLA máximo | Contabilidad | Excepciones |
| DPF-006 | Aprobación y límites de ajustes manuales | Finanzas/Riesgo | Consola operativa |
| DPF-007 | Política de refunds cuando costos no son recuperables | Legal/Finanzas | Resoluciones |
| DPF-008 | Normalización de umbral entre monedas | Finanzas | Doble control |
| DPF-009 | Retención y acceso a datos financieros | Legal/Privacidad | Storage/auditoría |

## 22. Criterios de aceptación

### 22.1 Ledger y comisiones

- **CA-PD-001.** Cada journal posteado balancea por moneda y no puede editarse.
- **CA-PD-002.** Dos procesamientos del mismo evento crean un solo journal.
- **CA-PD-003.** El saldo de una operación se reconstruye solo desde postings y coincide con su proyección.
- **CA-PD-004.** Las fórmulas producen resultados exactos para tasa, fijo, mínimo, máximo, impuestos y moneda sin decimales.
- **CA-PD-005.** Cambiar una política no cambia el desglose congelado de una operación.
- **CA-PD-006.** La suma de líneas coincide exactamente con total comprador y neto vendedor.
- **CA-PD-007.** Un cierre esperado con saldo residual queda bloqueado y alertado.

### 22.2 Cobros y órdenes

- **CA-PD-008.** El retorno del navegador nunca acredita.
- **CA-PD-009.** Webhooks duplicados/fuera de orden producen una sola acreditación y ningún downgrade silencioso.
- **CA-PD-010.** Diferencia de monto, moneda o cuenta crea retención y no habilita envío.
- **CA-PD-011.** Dos intentos aparentemente acreditados dejan uno confirmado y el otro en revisión sin sumar saldo.
- **CA-PD-012.** Una orden repetida con la misma clave/payload devuelve el resultado previo.
- **CA-PD-013.** La misma clave con payload diferente es rechazada y alertada.
- **CA-PD-014.** Un timeout externo se consulta antes de reintentar.
- **CA-PD-015.** Una capacidad `UNVERIFIED` impide enviar la orden.
- **CA-PD-016.** Liberación/reembolso confirmado postea una vez y consume una sola reserva.

### 22.3 Conciliación y contracargos

- **CA-PD-017.** Cada línea externa está matched o en excepción con owner, causa y SLA.
- **CA-PD-018.** Reprocesar la misma fuente de conciliación no duplica ajustes ni cambia un match sin evidencia.
- **CA-PD-019.** Costos del proveedor no se mezclan con fees de plataforma.
- **CA-PD-020.** Un settlement neto se explica por sus componentes o permanece abierto.
- **CA-PD-021.** Un contracargo posterior al cierre crea caso y nuevos postings; no reescribe el cierre histórico.
- **CA-PD-022.** Sin `DP-013` aprobada, el contracargo no debita automáticamente a una parte.

### 22.4 Disputas y devoluciones

- **CA-PD-023.** Abrir reclamo y autorizar liberación concurrentemente produce una sola transición válida y respeta el límite temporal.
- **CA-PD-024.** Ninguna resolución con componente `UNRESOLVED` puede confirmarse.
- **CA-PD-025.** Una propuesta que supera saldo o requiere capacidad no verificada se bloquea.
- **CA-PD-026.** La aprobación secundaria se invalida si cambia la versión propuesta.
- **CA-PD-027.** Revisor y aprobador son distintos, autorizados y sin conflicto.
- **CA-PD-028.** Una devolución no inicia reembolso antes del hito escrito.
- **CA-PD-029.** Silencio o tracking aplica solo la consecuencia congelada; no una regla implícita.
- **CA-PD-030.** El fallo y la evidencia original sobreviven a corrección, moderación o compensación.

### 22.5 Operación y resiliencia

- **CA-PD-031.** Cada runbook produce auditoría, correlación y resultado reproducible.
- **CA-PD-032.** Un proveedor caído deja estados no terminales y no habilita despacho por optimismo.
- **CA-PD-033.** Restaurar DB no reenvía órdenes hasta reconciliar referencias externas.
- **CA-PD-034.** Ningún rol operativo puede editar directamente saldo, posting, fallo o estado externo.
- **CA-PD-035.** Una política errónea se retira para nuevas operaciones sin alterar snapshots anteriores.
- **CA-PD-036.** Webhook autenticado o consulta autoritativa reconciliada acreditan el mismo hecho una vez; el retorno del navegador nunca.
- **CA-PD-037.** La segunda aceptación bilateral congela versión y pasa directamente a `SUBMITTED_FOR_REVIEW`, sin mover dinero.
- **CA-PD-038.** Un pago tardío conserva `CANCELLED`/`EXPIRED` y se procesa en `FinancialExceptionReview` con `LATE_PAYMENT_REVIEW`.
- **CA-PD-039.** La deduplicación de webhook usa provider, environment, account scope e ID; el fallback exige consulta.
- **CA-PD-040.** Evidencia sensible y notas internas solo son accesibles a administración mediante identidad aprobada y auditoría del actor.

## 23. Trazabilidad

| Área | Requisitos y reglas fuente |
|---|---|
| Modelo neutral/capabilities | `RF-PAG-001..004`, `RNF-010`, `DP-002..004`, `TR-PAG-001` |
| Comisiones y snapshot | `RF-PAG-005..006`, `RN-007..012`, `RF-ADM-001..005`, `INV-FIN-008` |
| Ledger y no sobregiro | `RF-PAG-011..012`, `INV-FIN-004..008`, FSD §15 |
| Acreditación | `RF-PAG-002..007`, `RN-013..014`, `SM-PAG`, `CA-PAG-001..004` |
| Liberación/reembolso | `RF-PAG-008..010`, `RN-018..022`, `SM-FIN`, `FL-10` |
| Idempotencia/outbox | `RF-PAG-003`, `FSD §20.3`, modelo 03 §18, arquitectura 05 §7 |
| Conciliación | `RF-PAG-002`, `RF-PAG-010..011`, `TR-PAG-005`, `TR-FIN-007` |
| Reclamo/evidencia | `RF-DIS-001..009`, `RN-023..025`, `SM-DIS`, `FL-06..07` |
| Resolución/doble control | `RF-DIS-010..015`, `RN-026..030`, `TR-DIS-008..013` |
| Acuerdo bilateral | `RF-DIS-010`, `SM-SET`, `TR-SET-001..008`, eventos `EVT-DIS-004..008` |
| Devolución | `RF-DEV-001..008`, `SM-DEV`, `DP-015..016`, `FL-09` |
| Contracargos/riesgo | `RN-020`, `DP-012..013`, retención `CHARGEBACK` |
| Auditoría/operaciones | `RF-ADM-006..010`, `PE-002..006`, FSD §19 |
| Notificación crítica | `RF-CON-003..004`, FSD §10.3/§21, `DP-021` |
| Resiliencia | `RNF-004..005`, `RNF-011`, arquitectura 05 §§12, 15, 16 |

## 24. Checklist de salida a piloto

1. País, moneda, entidad y cuenta del proveedor aprobados.
2. `DP-002/003` documentadas con prueba contractual y técnica de cada movimiento.
3. Plan de cuentas y reconocimiento (`DPF-001/002`) aprobados.
4. Fee policies y ejemplos de redondeo revisados por Finanzas/Fiscal/Legal.
5. Matriz de resolución sin componentes implícitos y tratamiento de fees aprobado.
6. Contracargos, reservas y saldo negativo (`DP-013`) aprobados.
7. Conciliación transaccional, settlement y bancaria probada end-to-end.
8. Carreras, duplicados, fuera de orden y resultado desconocido superan pruebas.
9. Roles, doble aprobación, límites y runbooks ensayados.
10. `DTA-SEC-001` aprobado y acceso administrativo corporativo/MFA/break-glass probado.
11. `DP-021` aprobado y fallback/escalamiento de notificaciones críticas probado.
12. Alertas, dashboards, owners, SLA y on-call activos.
13. Restore/replay probado sin duplicar efectos externos.
14. Operaciones y Soporte pueden explicar cada estado sin prometer un resultado no confirmado.

---

### Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.2 | 2026-08-07 | Define la ruta excepcional R05A para obtener evidencia productiva sin habilitar `TR-FIN-002` ni auto-promover capacidades `UNVERIFIED` |
| 0.1.1 | 2026-08-07 | Alineación de precedencia, acreditación, webhook scope, catálogos, pago tardío, settlement bilateral, identidad administrativa y `DP-021` |
| 0.1.0 | 2026-08-07 | Primera especificación de pagos, ledger, conciliación y disputas derivada de los documentos 01, 02, 03, 05 y 06 |
