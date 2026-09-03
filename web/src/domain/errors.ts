/**
 * Errores canónicos del dominio Yanti (alineados a doc 06 §errores y doc 03 ERR-*).
 * La UI y la API traducen `code` a mensajes; nunca se exponen trazas.
 */
export type ErrorCode =
  | "ERR-AUTH-001" // no autenticado / no autorizado (respuesta no enumerativa)
  | "ERR-CONC-001" // VERSION_DESACTUALIZADA (412)
  | "ERR-IDEM-001" // CLAVE_REUTILIZADA_CON_OTRO_PAYLOAD (409)
  | "ERR-POL-009" // DECISION_PENDING (422) — ruta depende de una DP abierta
  | "ERR-RET-001" // ACCION_RETENIDA — hold activo bloquea la acción
  | "ERR-MONEY-001" // inconsistencia monetaria (desglose no reconcilia)
  | "ERR-VALID-001" // validación de entrada
  | "ERR-ENUM-001"; // combinación país/moneda/categoría no habilitada

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, httpStatus = 422, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export const errValidation = (message: string, details?: Record<string, unknown>) =>
  new DomainError("ERR-VALID-001", message, 400, details);

export const errAuth = () => new DomainError("ERR-AUTH-001", "No autorizado", 404);

export const errVersion = () =>
  new DomainError("ERR-CONC-001", "Versión desactualizada", 412);

export const errIdempotencyReused = () =>
  new DomainError("ERR-IDEM-001", "Clave de idempotencia reutilizada con otro payload", 409);

export const errDecisionPending = (what: string) =>
  new DomainError(
    "ERR-POL-009",
    `Decisión pendiente requerida: ${what}`,
    422,
    { decision: what },
  );

export const errHeld = (actions: string[]) =>
  new DomainError("ERR-RET-001", `Acción retenida: ${actions.join(", ")}`, 409, {
    heldActions: actions,
  });

export const errMoney = (message = "Inconsistencia monetaria") =>
  new DomainError("ERR-MONEY-001", message, 409);
