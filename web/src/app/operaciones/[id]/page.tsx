import { redirect, notFound } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { getDb } from "@/data/db";
import { getOperationDetail, type OperationDetail } from "@/server/queries";
import { formatDate, formatMoney } from "@/ui/lib/format";
import { t } from "@/ui/lib/i18n";
import {
  cancelOperationAction,
  acceptOperationAction,
  payAction,
  simulateWebhookAction,
  declareShipmentAction,
  confirmReceiptAction,
  openDisputeAction,
  submitRatingAction,
} from "@/ui/actions/operation-actions";
import Link from "next/link";
import { TransactionDraftReview } from "./TransactionDraftReview";
import type { DraftFormValues } from "@/ui/actions/operation-actions";
import { disputeStatusLabel, paymentStatusLabel } from "../transaction-status-labels";
import { TransactionTrackingCode } from "./TransactionTrackingCode";
import { listEvidenceForOperation } from "@/data/repos/evidence-repo";
import { ImageLightbox } from "@/ui/components/ImageLightbox";
import { RatingStars } from "@/ui/components/RatingStars";
import { listRatingsForOperation } from "@/data/repos/rating-repo";

export default async function OperationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string; actualizada?: string; enviada?: string; despachada?: string; confirmada?: string }>;
}) {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const { id } = await params;
  const sp = await searchParams;
  const evidence = listEvidenceForOperation(getDb(), id).filter((item) => item.mime_type?.startsWith("image/"));
  const ratings = listRatingsForOperation(getDb(), id);

  const db = getDb();
  let detail;
  try {
    detail = getOperationDetail(db, id, account.account_id);
  } catch {
    notFound();
  }
  if (!detail) notFound();

  const op = detail.operation;
  const role = detail.role;
  const ag = detail.agreement;
  const myRating = ratings.find((rating) => rating.author_id === account.account_id);
  const ratingEligible = ["COMPLETED", "REFUNDED"].includes(op.state) && (detail.role === "BUYER" || detail.role === "SELLER");

  return (
    <AppShell account={account}>
      <div className="flex-between" style={{ flexWrap: "wrap", gap: 8 }}>
          <div>
            <div className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
              {op.support_code} · {role === "SELLER" ? "Venta" : "Compra"} ·{" "}
              {detail.counterPartyName ?? "—"}
            </div>
            <h1>{op.title}</h1>
          </div>
          <StatusBadge state={op.state} />
        </div>

        {evidence.length > 0 && <section className="card mt-3"><h2>Imágenes adjuntas</h2><div className="evidence-gallery">{evidence.map((item) => <ImageLightbox key={item.evidence_id} src={`/api/evidence/${item.evidence_id}`} alt={item.original_name ?? "Imagen adjunta"} />)}</div></section>}
        {ratingEligible && <section className="card mt-3"><h2>Calificar la operación</h2>{myRating ? <p className="text-secondary">Ya enviaste tu calificación. Se publicará cuando ambas partes califiquen.</p> : <form action={submitRatingAction} className="flex-col"><input type="hidden" name="operationId" value={id} /><RatingStars /><div className="field"><label htmlFor="rating-comment">Comentario</label><textarea className="rating-comment-input" id="rating-comment" name="comment" required minLength={10} rows={5} placeholder="Contá brevemente cómo fue la experiencia" /><p className="hint">Mínimo 10 caracteres.</p></div><button className="btn btn-primary" type="submit">Enviar calificación</button></form>}</section>}

        {sp.creada === "1" && (
          <div className="banner banner-success mt-3" role="status">
            Borrador creado. Revisá los importes y los datos antes de enviarlo.
          </div>
        )}
        {sp.actualizada === "1" && (
          <div className="banner banner-success mt-3" role="status">
            Cambios guardados. Las comisiones y los totales se recalcularon con el nuevo precio.
          </div>
        )}
        {sp.enviada === "1" && (
          <div className="banner banner-success mt-3" role="status">
            Solicitud enviada a {op.buyer_email}. El comprador ya puede revisarla y aceptarla.
          </div>
        )}
        {sp.despachada === "1" && (
          <div className="banner banner-success mt-3" role="status">
            Envío declarado. El comprador ya puede ver el seguimiento y confirmar la recepción.
          </div>
        )}
        {sp.confirmada === "1" && (
          <div className="banner banner-success mt-3" role="status">
            Recepción confirmada. La liberación al vendedor fue procesada.
          </div>
        )}

        <div className="card mt-3">
          <h2>Qué sigue</h2>
          <DeadlineSummary state={op.state} role={role} deadlines={detail.deadlines} />
          <ActionArea
            state={op.state}
            role={role}
            opId={id}
            attemptId={detail.paymentAttempt?.attempt_id ?? null}
            attemptState={detail.paymentAttempt?.state ?? null}
            disputeId={detail.dispute?.dispute_id ?? null}
            sellerName={role === "BUYER" ? detail.counterPartyName : account.display_name}
            baseAmountMinor={ag?.base_amount_minor ?? null}
            buyerFeeMinor={ag?.buyer_fee_minor ?? null}
            buyerTotalMinor={ag?.buyer_total_minor ?? null}
            sellerFeeMinor={ag?.seller_fee_minor ?? null}
            sellerNetMinor={ag?.seller_net_minor ?? null}
            currency={ag?.currency ?? op.currency}
            draftValues={ag ? {
              titulo: ag.title,
              descripcion: ag.description,
              monto: String(ag.base_amount_minor / 100),
              categoria: op.category_code,
              comprador_email: op.buyer_email ?? "",
              enlace: op.external_link ?? "",
              pais: op.country_code,
              moneda: op.currency,
              operationId: op.operation_id,
              version: String(op.version),
            } : null}
          />
        </div>

        {ag && op.state !== "DRAFT" && (
          <div className="card mt-3">
            <h2>{moneySummaryTitle(role, op.state)}</h2>
            <dl className="dl">
              <div><dt>{t.op.amount}</dt><dd className="money">{formatMoney(ag.base_amount_minor, ag.currency)}</dd></div>
              {role === "SELLER" ? (
                <>
                  <div><dt>{t.op.sellerFee}</dt><dd className="money">{formatMoney(ag.seller_fee_minor, ag.currency)}</dd></div>
                  <div><dt>{t.op.netToReceive}</dt><dd className="money amount-lg">{formatMoney(ag.seller_net_minor, ag.currency)}</dd></div>
                </>
              ) : (
                <>
                  <div><dt>{t.op.buyerFee}</dt><dd className="money">{formatMoney(ag.buyer_fee_minor, ag.currency)}</dd></div>
                  <div><dt>{t.op.totalToPay}</dt><dd className="money amount-lg">{formatMoney(ag.buyer_total_minor, ag.currency)}</dd></div>
                </>
              )}
            </dl>
            <h3 className="mt-4">Condición acordada</h3>
            <p>{ag.description}</p>
            {ag.sealed_at ? (
              <p className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
                Acuerdo sellado el {formatDate(ag.sealed_at)} · Los términos son inmutables.
              </p>
            ) : (
              <p className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
                El acuerdo se sella cuando el comprador lo acepta.
              </p>
            )}
          </div>
        )}

        {detail.paymentAttempt && detail.paymentAttempt.state !== "CREATED" && (
          <div className="card mt-3">
            <h2>Pago</h2>
            <dl className="dl">
              <div><dt>Estado del pago</dt><dd>{paymentStatusLabel(detail.paymentAttempt.state)}</dd></div>
              <div><dt>Total</dt><dd className="money">{formatMoney(detail.paymentAttempt.requested_total_minor, op.currency)}</dd></div>
              {detail.paymentAttempt.accredited_at && (
                <div><dt>Acreditado</dt><dd>{formatDate(detail.paymentAttempt.accredited_at)}</dd></div>
              )}
            </dl>
          </div>
        )}

        {detail.shipment && detail.shipment.state !== "NOT_STARTED" && (
          <div className="card mt-3">
            <h2>{t.op.tracking}</h2>
            <dl className="dl">
              <div><dt>Transportista</dt><dd>{detail.shipment.carrier ?? "—"}</dd></div>
              <div><dt>Tracking</dt><dd>{detail.shipment.tracking_code ? <TransactionTrackingCode code={detail.shipment.tracking_code} /> : "—"}</dd></div>
              {detail.shipment.tracking_url && (
                <div><dt>Seguimiento en línea</dt><dd><a href={detail.shipment.tracking_url} target="_blank" rel="noreferrer">Abrir seguimiento</a></dd></div>
              )}
              {detail.shipment.declared_at && (
                <div><dt>Despachado</dt><dd>{formatDate(detail.shipment.declared_at)}</dd></div>
              )}
            </dl>
          </div>
        )}

        {detail.dispute && (
          <div className="card mt-3">
            <h2>Reclamo</h2>
            <dl className="dl">
              <div><dt>Motivo</dt><dd>{t.dispute.reasons[detail.dispute.reason as keyof typeof t.dispute.reasons] ?? detail.dispute.reason}</dd></div>
              <div><dt>Estado</dt><dd>{disputeStatusLabel(detail.dispute.state)}</dd></div>
            </dl>
            <Link href={`/disputas/${detail.dispute.dispute_id}`} className="btn btn-secondary btn-sm mt-3">
              Ver reclamo y aportar evidencia
            </Link>
          </div>
        )}

        <div className="card mt-3">
          <h2>{t.op.timeline}</h2>
          <ol className="timeline">
            {detail.timeline.map((ev) => (
              <li key={ev.event_id}>
                <div className="tl-label">{ev.label}</div>
                <div className="tl-time">{formatDate(ev.created_at)}</div>
              </li>
            ))}
          </ol>
        </div>
    </AppShell>
  );
}

function DeadlineSummary({
  state,
  role,
  deadlines,
}: {
  state: string;
  role: "BUYER" | "SELLER";
  deadlines: OperationDetail["deadlines"];
}) {
  if (state === "DRAFT") {
    return <p className="text-secondary">Este borrador no vence. Podés revisarlo antes de enviarlo.</p>;
  }
  if (["AWAITING_ACCEPTANCE", "ACCEPTED_AWAITING_PAYMENT"].includes(state) && deadlines.requestExpiryAt) {
    return (
      <div className="banner banner-info">
        <strong>La solicitud vence el {formatDate(deadlines.requestExpiryAt)} UTC.</strong>{" "}
        {role === "BUYER" ? "Aceptala y completá el pago antes de esa fecha." : "Si no se paga, quedará expirada sin movimiento de fondos."}
      </div>
    );
  }
  if (["SHIPPED_AWAITING_RECEIPT", "CONFIRMATION_OVERDUE"].includes(state) && deadlines.receiptMilestoneAt) {
    return (
      <div className="banner banner-warning">
        <strong>Fecha estimada para confirmar: {formatDate(deadlines.receiptMilestoneAt)} UTC.</strong>{" "}
        {deadlines.confirmationGraceEndsAt && (
          <>El período de seguimiento termina el {formatDate(deadlines.confirmationGraceEndsAt)} UTC. </>
        )}
        {deadlines.autoReleaseEnabled
          ? "Al terminar ese período, Yanti puede iniciar la liberación si no hay un reclamo ni una retención."
          : "La liberación automática no está habilitada; confirmá la recepción o abrí un reclamo según corresponda."}
      </div>
    );
  }
  if (state === "RETURN_REQUIRED" && deadlines.returnDeadlineAt) {
    return (
      <div className="banner banner-warning">
        <strong>La devolución vence el {formatDate(deadlines.returnDeadlineAt)} UTC.</strong>
      </div>
    );
  }
  return null;
}

function moneySummaryTitle(role: "BUYER" | "SELLER", state: string): string {
  if (["CANCELLED", "EXPIRED", "REFUNDED"].includes(state)) return "Importes del acuerdo";
  if (state === "COMPLETED") return role === "SELLER" ? "Lo que recibiste" : "Lo que pagaste";
  return role === "SELLER" ? "Lo que recibirás" : "Lo que pagarás";
}

/** Renderiza la acción correcta según estado y rol. */
function ActionArea(props: {
  state: string;
  role: "BUYER" | "SELLER";
  opId: string;
  attemptId: string | null;
  attemptState: string | null;
  disputeId: string | null;
  sellerName: string | null;
  baseAmountMinor: number | null;
  buyerFeeMinor: number | null;
  buyerTotalMinor: number | null;
  sellerFeeMinor: number | null;
  sellerNetMinor: number | null;
  currency: string;
  draftValues: DraftFormValues | null;
}) {
  const {
    state, role, opId, attemptId, attemptState, disputeId, sellerName,
    baseAmountMinor, buyerFeeMinor, buyerTotalMinor, sellerFeeMinor, sellerNetMinor,
    currency, draftValues,
  } = props;

  if (role === "SELLER") {
    switch (state) {
      case "DRAFT":
        return (
          <div className="flex-col">
            {draftValues && baseAmountMinor !== null && buyerFeeMinor !== null && buyerTotalMinor !== null && sellerFeeMinor !== null && sellerNetMinor !== null && (
              <TransactionDraftReview
                values={draftValues}
                price={formatMoney(baseAmountMinor, currency)}
                buyerFee={formatMoney(buyerFeeMinor, currency)}
                buyerTotal={formatMoney(buyerTotalMinor, currency)}
                sellerFee={formatMoney(sellerFeeMinor, currency)}
                sellerNet={formatMoney(sellerNetMinor, currency)}
              />
            )}
          </div>
        );
      case "AWAITING_ACCEPTANCE":
      case "ACCEPTED_AWAITING_PAYMENT":
        return (
          <div className="flex-col">
            <p className="text-secondary">
              {state === "AWAITING_ACCEPTANCE"
                ? "Esperando que el comprador acepte el acuerdo."
                : "El comprador aceptó. Esperando su pago."}
            </p>
            {state === "AWAITING_ACCEPTANCE" && (
              <form action={cancelOperationAction}>
                <input type="hidden" name="operationId" value={opId} />
                <button className="btn btn-ghost btn-sm" type="submit">Cancelar solicitud</button>
              </form>
            )}
          </div>
        );
      case "PAID_AWAITING_SHIPMENT":
        return (
          <div className="flex-col">
            <div className="banner banner-success">Pago acreditado. Ahora podés despachar el producto.</div>
            <form action={declareShipmentAction} className="flex-col" encType="multipart/form-data">
              <input type="hidden" name="operationId" value={opId} />
              <div className="field">
                <label htmlFor="carrier">Transportista</label>
                <input id="carrier" name="transportista" required placeholder="Andreani, OCA, Correo Argentino…" />
              </div>
              <div className="field"><label htmlFor="shipment-image">Foto del envío</label><input id="shipment-image" name="imagen_envio" type="file" accept="image/*" /><p className="hint">Opcional. Adjuntá una foto del paquete o comprobante, hasta 10 MB.</p></div>
              <div className="field">
                <label htmlFor="tracking">Código de seguimiento</label>
                <input id="tracking" name="tracking" required placeholder="Ej: AR123456789" />
              </div>
              <div className="field">
                <label htmlFor="tracking-url">Enlace de seguimiento (opcional)</label>
                <input id="tracking-url" name="tracking_url" type="url" placeholder="https://…" />
              </div>
              <button className="btn btn-primary" type="submit">Declarar envío</button>
            </form>
          </div>
        );
      case "SHIPPED_AWAITING_RECEIPT":
      case "CONFIRMATION_OVERDUE":
        return (
          <p className="text-secondary">
            Producto despachado. El comprador debe confirmar la recepción o abrir un reclamo antes de la fecha límite.
          </p>
        );
      case "IN_DISPUTE":
      case "RETURN_REQUIRED":
        return (
          <div className="flex-col">
            <p className="text-secondary">Hay un reclamo en curso. La liberación está suspendida hasta la resolución.</p>
            {disputeId && (
              <Link href={`/disputas/${disputeId}`} className="btn btn-secondary btn-sm">
                Ver reclamo y responder
              </Link>
            )}
          </div>
        );
      case "RELEASE_IN_PROGRESS":
      case "REFUND_IN_PROGRESS":
        return <p className="text-secondary">Procesando el movimiento financiero…</p>;
      case "COMPLETED":
        return <p className="text-secondary">Operación completada: el dinero fue liberado a tu cuenta.</p>;
      case "REFUNDED":
        return <p className="text-secondary">Operación finalizada con reembolso al comprador.</p>;
      case "CANCELLED":
        return <p className="text-secondary">Solicitud cancelada. Sin movimiento de fondos.</p>;
      case "EXPIRED":
        return <p className="text-secondary">La solicitud expiró antes de pagarse.</p>;
      default:
        return null;
    }
  }

  if (role === "BUYER") {
    switch (state) {
      case "AWAITING_ACCEPTANCE":
        return (
          <div className="flex-col">
            <p className="text-secondary">
              Te invitaron a una compraventa protegida. Si el producto coincide con lo acordado, aceptá el acuerdo para continuar al pago.
            </p>
            <form action={acceptOperationAction}>
              <input type="hidden" name="operationId" value={opId} />
              <button className="btn btn-primary" type="submit">Aceptar acuerdo y continuar</button>
            </form>
          </div>
        );
      case "ACCEPTED_AWAITING_PAYMENT":
        return (
          <div className="flex-col">
            <p className="text-secondary">Aceptaste el acuerdo. El total a pagar incluye la comisión del comprador.</p>
            <form action={payAction}>
              <input type="hidden" name="operationId" value={opId} />
              <button className="btn btn-primary" type="submit">Ir a pagar</button>
            </form>
          </div>
        );
      case "PAYMENT_IN_PROGRESS":
        if (attemptState === "ACCREDITED_PENDING_RECONCILIATION" || attemptState === "UNDER_REVIEW") {
          return <p className="text-secondary">El proveedor informó el pago. Yanti está verificando el importe antes de acreditarlo.</p>;
        }
        return (
          <div className="flex-col">
            <p className="text-secondary">Tu pago está pendiente de confirmación del proveedor.</p>
            {attemptId && (
              <>
                <a href={`/pagar/fake?attempt=${attemptId}`} className="btn btn-primary">
                  Completar pago (simulado)
                </a>
                <form action={simulateWebhookAction}>
                  <input type="hidden" name="attemptId" value={attemptId} />
                  <button className="btn btn-secondary btn-sm" type="submit">
                    Simular que el proveedor confirma (demo)
                  </button>
                </form>
              </>
            )}
          </div>
        );
      case "PAID_AWAITING_SHIPMENT":
        return <p className="text-secondary">Pagaste. El vendedor está preparando tu envío.</p>;
      case "SHIPPED_AWAITING_RECEIPT":
      case "CONFIRMATION_OVERDUE":
        return (
          <div className="flex-col">
            <div className="banner banner-warning">
              {state === "CONFIRMATION_OVERDUE"
                ? "La fecha estimada de confirmación ya pasó. Confirmá la recepción o abrí un reclamo si hubo un problema."
                : "El vendedor despachó tu compra. Revisá que esté todo bien y confirmá la recepción."}
            </div>
            {sellerNetMinor !== null && (
              <div className="banner banner-info">
                Al confirmar, autorizás que se liberen {formatMoney(sellerNetMinor, currency)} a {sellerName ?? "la persona vendedora"}.
                La operación quedará completada.
              </div>
            )}
            <form action={confirmReceiptAction}>
              <input type="hidden" name="operationId" value={opId} />
              <button className="btn btn-primary" type="submit">Confirmar recepción conforme</button>
            </form>
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>¿Algo salió mal? Abrir un reclamo</summary>
              <form action={openDisputeAction} className="flex-col" style={{ marginTop: 12 }}>
                <input type="hidden" name="operationId" value={opId} />
                <div className="field">
                  <label htmlFor="motivo">Motivo</label>
                  <select id="motivo" name="motivo" required>
                    {Object.entries(t.dispute.reasons).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="desc">Describí el problema</label>
                  <textarea id="desc" name="descripcion" required placeholder="Qué pasó, qué esperabas y qué recibiste…" />
                </div>
                <button className="btn btn-accent" type="submit">Abrir reclamo</button>
              </form>
            </details>
          </div>
        );
      case "IN_DISPUTE":
      case "RETURN_REQUIRED":
        return (
          <div className="flex-col">
            <p className="text-secondary">Hay un reclamo en curso. El dinero está retenido hasta la resolución.</p>
            {disputeId && (
              <Link href={`/disputas/${disputeId}`} className="btn btn-secondary btn-sm">
                Ver reclamo y aportar evidencia
              </Link>
            )}
          </div>
        );
      case "RELEASE_IN_PROGRESS":
      case "REFUND_IN_PROGRESS":
        return <p className="text-secondary">Procesando el movimiento financiero…</p>;
      case "COMPLETED":
        return <p className="text-secondary">Operación completada. El dinero fue liberado al vendedor.</p>;
      case "REFUNDED":
        return <p className="text-secondary">Operación finalizada: se te reembolsó el pago.</p>;
      case "CANCELLED":
        return <p className="text-secondary">La solicitud fue cancelada. Sin cargo.</p>;
      case "EXPIRED":
        return <p className="text-secondary">La solicitud expiró antes de que pudieras pagar.</p>;
      default:
        return null;
    }
  }
  return null;
}
