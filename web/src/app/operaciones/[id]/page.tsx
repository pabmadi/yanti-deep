import { redirect, notFound } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { getDb } from "@/data/db";
import { getOperationDetail } from "@/server/queries";
import { formatDate, formatMoney } from "@/ui/lib/format";
import { t } from "@/ui/lib/i18n";
import {
  sendOperationAction,
  cancelOperationAction,
  acceptOperationAction,
  payAction,
  simulateWebhookAction,
  declareShipmentAction,
  confirmReceiptAction,
  openDisputeAction,
} from "@/ui/actions/operation-actions";
import Link from "next/link";

export default async function OperationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const { id } = await params;

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

        {ag && (
          <div className="card mt-3">
            <h2>{t.op.amount} y comisiones</h2>
            <dl className="dl">
              <div><dt>{t.op.amount}</dt><dd className="money">{formatMoney(ag.base_amount_minor, ag.currency)}</dd></div>
              <div><dt>{t.op.buyerFee}</dt><dd className="money">{formatMoney(ag.buyer_fee_minor, ag.currency)}</dd></div>
              <div><dt>{t.op.totalToPay}</dt><dd className="money">{formatMoney(ag.buyer_total_minor, ag.currency)}</dd></div>
              <div><dt>{t.op.sellerFee}</dt><dd className="money">{formatMoney(ag.seller_fee_minor, ag.currency)}</dd></div>
              <div><dt>{t.op.netToReceive}</dt><dd className="money">{formatMoney(ag.seller_net_minor, ag.currency)}</dd></div>
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

        <div className="card mt-3">
          <h2>{t.op.actions}</h2>
          <ActionArea
            state={op.state}
            role={role}
            opId={id}
            attemptId={detail.paymentAttempt?.attempt_id ?? null}
            disputeId={detail.dispute?.dispute_id ?? null}
          />
        </div>

        {detail.paymentAttempt && detail.paymentAttempt.state !== "CREATED" && (
          <div className="card mt-3">
            <h2>Pago</h2>
            <dl className="dl">
              <div><dt>Estado del pago</dt><dd>{detail.paymentAttempt.state.replace(/_/g, " ").toLowerCase()}</dd></div>
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
              <div><dt>Tracking</dt><dd>{detail.shipment.tracking_code ?? "—"}</dd></div>
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
              <div><dt>Estado</dt><dd>{detail.dispute.state.replace(/_/g, " ").toLowerCase()}</dd></div>
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

/** Renderiza la acción correcta según estado y rol. */
function ActionArea(props: {
  state: string;
  role: "BUYER" | "SELLER";
  opId: string;
  attemptId: string | null;
  disputeId: string | null;
}) {
  const { state, role, opId, attemptId, disputeId } = props;

  if (role === "SELLER") {
    switch (state) {
      case "DRAFT":
        return (
          <div className="flex-col">
            <p className="text-secondary">La solicitud está en borrador. Al enviarla se congela el acuerdo y se notifica al comprador.</p>
            <form action={sendOperationAction}>
              <input type="hidden" name="operationId" value={opId} />
              <button className="btn btn-primary" type="submit">Enviar solicitud</button>
            </form>
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
            <form action={declareShipmentAction} className="flex-col">
              <input type="hidden" name="operationId" value={opId} />
              <div className="field">
                <label htmlFor="carrier">Transportista</label>
                <input id="carrier" name="transportista" required placeholder="Andreani, OCA, Correo Argentino…" />
              </div>
              <div className="field">
                <label htmlFor="tracking">Código de seguimiento</label>
                <input id="tracking" name="tracking" required placeholder="Ej: AR123456789" />
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
                ? "La fecha de entrega estimada venció. Confirmá la recepción o abrí un reclamo antes de que se libere el dinero."
                : "El vendedor despachó tu compra. Revisá que esté todo bien y confirmá la recepción."}
            </div>
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
