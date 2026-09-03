import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/ui/lib/session";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { getDb } from "@/data/db";
import { getOperation } from "@/data/repos/operation-repo";
import { getLatestAttempt } from "@/data/repos/payment-repo";
import { getDisputeByOperation, listSubmissions, getResolution } from "@/data/repos/dispute-repo";
import { getShipment } from "@/data/repos/shipment-repo";
import { asRows } from "@/data/db";
import { balancesByAccount } from "@/data/repos/ledger-repo";
import { getOrdersByOperation } from "@/data/repos/financial-order-repo";
import { formatDate, formatMoney } from "@/ui/lib/format";
import { t } from "@/ui/lib/i18n";
import {
  adminProposeResolutionAction,
  adminConfirmResolutionAction,
} from "@/ui/actions/admin-actions";
import { adminCompleteReturnAction } from "@/ui/actions/admin-return-actions";

export default async function AdminOperationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ devuelta?: string }> }) {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const op = getOperation(db, id);
  if (!op) notFound();

  const attempt = getLatestAttempt(db, id);
  const shipment = getShipment(db, id);
  const dispute = getDisputeByOperation(db, id);
  const submissions = dispute ? listSubmissions(db, dispute.dispute_id, false) : [];
  const resolution = dispute?.resolution_id ? getResolution(db, dispute.resolution_id) : undefined;
  const returnCase = (() => {
    const row = db.prepare("SELECT * FROM return_case WHERE operation_id=? ORDER BY created_at DESC LIMIT 1").get(id);
    return row
      ? (row as { return_id: string; state: string; deadline: string | null; carrier: string | null; tracking_code: string | null; created_at: string })
      : undefined;
  })();
  const balances = balancesByAccount(db, id);
  const orders = getOrdersByOperation(db, id);

  const timeline = asRows<{ event_id: string; label: string; created_at: string }>(
    db.prepare("SELECT event_id, label, created_at FROM operation_event WHERE operation_id=? ORDER BY created_at ASC").all(id),
  );

  const disputeOpen = dispute ? !dispute.state.startsWith("RESOLVED") : false;
  const hasPendingResolution =
    dispute && resolution && (resolution.state === "PROPOSED" || resolution.state === "PENDING_SECOND_APPROVAL");

  return (
    <>
      <Link href="/admin" className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>← Consola</Link>
      {sp.devuelta && <div className="banner banner-success mt-3">Devolución recibida conforme y reembolso ejecutado.</div>}
        <div className="flex-between mt-2" style={{ flexWrap: "wrap" }}>
          <h1>{op.title}</h1>
          <StatusBadge state={op.state} />
        </div>
        <p className="text-secondary">{op.support_code} · {op.operation_id}</p>

        <dl className="dl card mt-3">
          <div><dt>Vendedor</dt><dd>{op.seller_id}</dd></div>
          <div><dt>Comprador</dt><dd>{op.buyer_email ?? op.buyer_id ?? "—"}</dd></div>
          <div><dt>Monto</dt><dd className="money">{formatMoney(op.base_amount_minor, op.currency)}</dd></div>
          <div><dt>Moneda</dt><dd>{op.currency}</dd></div>
          <div><dt>Categoría</dt><dd>{op.category_code}</dd></div>
          <div><dt>Creada</dt><dd>{formatDate(op.created_at)}</dd></div>
        </dl>

        {attempt && (
          <div className="card mt-3">
            <h2>Pago</h2>
            <dl className="dl">
              <div><dt>Intento</dt><dd>{attempt.attempt_id}</dd></div>
              <div><dt>Estado</dt><dd>{attempt.state.replace(/_/g, " ")}</dd></div>
              <div><dt>Total</dt><dd className="money">{formatMoney(attempt.requested_total_minor, attempt.currency)}</dd></div>
              {attempt.observed_total_minor !== null && (
                <div><dt>Observado</dt><dd className="money">{formatMoney(attempt.observed_total_minor, attempt.currency)}</dd></div>
              )}
              {attempt.provider_ref && <div><dt>Ref proveedor</dt><dd>{attempt.provider_ref}</dd></div>}
            </dl>
          </div>
        )}

        {shipment && shipment.state !== "NOT_STARTED" && (
          <div className="card mt-3">
            <h2>Envío</h2>
            <dl className="dl">
              <div><dt>Transportista</dt><dd>{shipment.carrier ?? "—"}</dd></div>
              <div><dt>Tracking</dt><dd>{shipment.tracking_code ?? "—"}</dd></div>
              <div><dt>Estado</dt><dd>{shipment.state.replace(/_/g, " ")}</dd></div>
            </dl>
          </div>
        )}

        {dispute && (
          <div className="card mt-3">
            <div className="flex-between" style={{ flexWrap: "wrap" }}>
              <h2>Reclamo · {dispute.dispute_id}</h2>
              <span className="badge">{dispute.state.replace(/_/g, " ").toLowerCase()}</span>
            </div>
            <dl className="dl">
              <div><dt>Motivo</dt><dd>{t.dispute.reasons[dispute.reason as keyof typeof t.dispute.reasons] ?? dispute.reason}</dd></div>
              <div><dt>Abierto</dt><dd>{formatDate(dispute.opened_at)}</dd></div>
            </dl>
            <p><strong>Descripción:</strong> {dispute.description}</p>

            <h3>Aportes de las partes</h3>
            {submissions.length === 0 && <p className="text-secondary">Sin aportes.</p>}
            <div className="flex-col">
              {submissions.map((s) => (
                <div key={s.submission_id} className="evidence-thumb">
                  <strong>{s.author_id}</strong>
                  <span className="text-secondary" style={{ fontSize: "var(--text-xs)" }}> · {formatDate(s.created_at)}</span>
                  <p className="mt-2" style={{ whiteSpace: "pre-wrap" }}>{s.body}</p>
                </div>
              ))}
            </div>

            {hasPendingResolution && resolution && (
              <div className="card mt-3" style={{ background: "var(--surface-subtle)" }}>
                <h3>Resolución propuesta</h3>
                <p><strong>Resultado:</strong> {resolution.outcome.replace(/_/g, " ").toLowerCase()}</p>
                <p><strong>Fundamento:</strong> {resolution.rationale}</p>
                <p className="text-secondary">
                  Estado: {resolution.state.replace(/_/g, " ").toLowerCase()} · Autor: {resolution.author_id}
                </p>
                <form action={adminConfirmResolutionAction} className="mt-2">
                  <input type="hidden" name="operationId" value={id} />
                  <input type="hidden" name="resolutionId" value={resolution.resolution_id} />
                  <button className="btn btn-primary" type="submit">
                    {resolution.state === "PENDING_SECOND_APPROVAL" ? "Aprobar (segundo control)" : "Confirmar resolución y ejecutar"}
                  </button>
                </form>
              </div>
            )}

            {disputeOpen && !hasPendingResolution && (
              <form action={adminProposeResolutionAction} className="card mt-3 flex-col" style={{ background: "var(--surface-subtle)" }}>
                <h3>Preparar resolución</h3>
                <input type="hidden" name="operationId" value={id} />
                <div className="field">
                  <label htmlFor="outcome">Resultado</label>
                  <select id="outcome" name="outcome">
                    <option value="RELEASE_TO_SELLER">Liberar al vendedor</option>
                    <option value="REFUND_WITHOUT_RETURN">Reembolsar al comprador (sin devolución)</option>
                    <option value="REQUIRE_RETURN">Exigir devolución y luego reembolsar</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="rationale">Fundamento (motivo estructurado)</label>
                  <textarea id="rationale" name="rationale" required placeholder="Análisis del acuerdo, evidencia y tracking…" />
                </div>
                <button className="btn btn-accent" type="submit">Proponer resolución</button>
              </form>
            )}
            {!disputeOpen && (
              <p className="text-secondary mt-3">Disputa resuelta.</p>
            )}
          </div>
        )}

        {returnCase && (
          <div className="card mt-3">
            <h2>Devolución · {returnCase.return_id}</h2>
            <dl className="dl">
              <div><dt>Estado</dt><dd>{returnCase.state.replace(/_/g, " ")}</dd></div>
              <div><dt>Vence</dt><dd>{returnCase.deadline ? formatDate(returnCase.deadline) : "—"}</dd></div>
              <div><dt>Transportista</dt><dd>{returnCase.carrier ?? "—"}</dd></div>
              <div><dt>Tracking</dt><dd>{returnCase.tracking_code ?? "—"}</dd></div>
            </dl>
            {(returnCase.state === "DISPATCHED" || returnCase.state === "IN_TRANSIT") && (
              <form action={adminCompleteReturnAction} className="mt-3">
                <input type="hidden" name="returnId" value={returnCase.return_id} />
                <button className="btn btn-primary" type="submit">
                  Registrar recepción conforme y reembolsar
                </button>
              </form>
            )}
          </div>
        )}

        <div className="card mt-3">
          <h2>Ledger (doble entrada)</h2>
          {balances.length === 0 ? (
            <p className="text-secondary">Sin asientos.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <caption>Balance por cuenta lógica</caption>
                <thead><tr><th>Cuenta</th><th>Débito</th><th>Crédito</th><th>Neto</th></tr></thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.account}>
                      <td>{b.account}</td>
                      <td className="money">{b.debitMinor}</td>
                      <td className="money">{b.creditMinor}</td>
                      <td className="money">{b.netMinor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="mt-3">Órdenes financieras</h3>
          {orders.length === 0 && <p className="text-secondary">Sin órdenes.</p>}
          <div className="flex-col">
            {orders.map((o) => (
              <div key={o.order_id} className="evidence-thumb">
                <strong>{o.order_type}</strong> · {o.state.replace(/_/g, " ")} ·{" "}
                <span className="money">{formatMoney(o.amount_minor, o.currency)}</span>
                <div className="text-secondary" style={{ fontSize: "var(--text-xs)" }}>{o.idempotency_key}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card mt-3">
          <h2>Línea de tiempo</h2>
          <ol className="timeline">
            {timeline.map((ev) => (
              <li key={ev.event_id}>
                <div className="tl-label">{ev.label}</div>
                <div className="tl-time">{formatDate(ev.created_at)}</div>
              </li>
            ))}
          </ol>
        </div>
    </>
  );
}
