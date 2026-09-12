import { redirect, notFound } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { getDb } from "@/data/db";
import { getOperation } from "@/data/repos/operation-repo";
import { getPartyRole } from "@/data/repos/operation-repo";
import { getResolution, listSubmissions, type DisputeRow } from "@/data/repos/dispute-repo";
import { formatDate, formatMoney } from "@/ui/lib/format";
import { t } from "@/ui/lib/i18n";
import { addEvidenceAction } from "@/ui/actions/operation-actions";
import { disputeStatusLabel } from "@/app/operaciones/transaction-status-labels";
import { ReturnDispatchForm } from "../ReturnDispatchForm";
import { listEvidenceForOperation } from "@/data/repos/evidence-repo";
import { ImageLightbox } from "@/ui/components/ImageLightbox";

export default async function DisputePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ devolucion?: string; evidencia?: string }> }) {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const { id } = await params;
  const sp = await searchParams;

  const db = getDb();
  const dispute = db.prepare("SELECT * FROM dispute WHERE dispute_id=?").get(id) as DisputeRow | undefined;
  if (!dispute) notFound();
  const op = getOperation(db, dispute.operation_id);
  if (!op) notFound();
  const role = getPartyRole(db, dispute.operation_id, account.account_id);
  if (!role) notFound();

  const isAdmin = account.is_admin === 1;
  const submissions = listSubmissions(db, id, !isAdmin);
  const images = listEvidenceForOperation(db, dispute.operation_id).filter((item) => item.purpose === "DISPUTE_EVIDENCE" && item.mime_type?.startsWith("image/"));
  const isParticipant = role === "BUYER" || role === "SELLER";
  const disputeOpen = !dispute.state.startsWith("RESOLVED");
  const candidateResolution = dispute.resolution_id ? getResolution(db, dispute.resolution_id) : undefined;
  const resolution = candidateResolution?.state === "CONFIRMED" ? candidateResolution : undefined;
  const returnCase = resolution ? db.prepare("SELECT * FROM return_case WHERE resolution_id=? ORDER BY created_at DESC LIMIT 1").get(resolution.resolution_id) as {
    return_id: string; state: string; deadline: string | null; carrier: string | null; tracking_code: string | null;
  } | undefined : undefined;
  const movement = db.prepare(
    "SELECT order_type, amount_minor, currency FROM financial_order WHERE operation_id=? AND state='CONFIRMED' ORDER BY created_at DESC LIMIT 1",
  ).get(op.operation_id) as { order_type: string; amount_minor: number; currency: string } | undefined;

  const names = new Map<string, string>();
  const seller = db.prepare("SELECT account_id, display_name FROM account WHERE account_id=?").get(op.seller_id) as { account_id: string; display_name: string } | undefined;
  if (seller) names.set(seller.account_id, seller.display_name);
  if (op.buyer_id) {
    const buyer = db.prepare("SELECT account_id, display_name FROM account WHERE account_id=?").get(op.buyer_id) as { account_id: string; display_name: string } | undefined;
    if (buyer) names.set(buyer.account_id, buyer.display_name);
  }

  return (
    <AppShell account={account}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <LinkBack href={`/operaciones/${op.operation_id}`} label={`Volver a ${op.title}`} />
        <h1>Reclamo · {op.support_code}</h1>
        <p className="text-secondary">{op.title}</p>
        {sp.devolucion === "1" && returnCase && <div className="banner banner-success" role="status">Devolución registrada. Podés consultar el seguimiento debajo.</div>}
        {sp.evidencia === "1" && <div className="banner banner-success" role="status">Tu aporte fue guardado y está disponible para la otra parte.</div>}

        <dl className="dl card mt-3">
          <div><dt>Motivo</dt><dd>{t.dispute.reasons[dispute.reason as keyof typeof t.dispute.reasons] ?? dispute.reason}</dd></div>
          <div><dt>Estado</dt><dd>{disputeStatusLabel(dispute.state)}</dd></div>
          <div><dt>Descripción del comprador</dt><dd>{dispute.description}</dd></div>
        </dl>

        {resolution && (
          <section className="card mt-3" aria-labelledby="resolution-heading">
            <h2 id="resolution-heading">Resolución</h2>
            <p>{resolution.outcome === "REQUIRE_RETURN" ? "Devolución del producto antes del reembolso" : resolution.outcome === "RELEASE_TO_SELLER" ? "Liberación al vendedor" : resolution.outcome === "AGREEMENT" ? "Acuerdo entre las partes" : "Reembolso sin devolución"}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{resolution.rationale}</p>
            {resolution.confirmed_at && <p className="text-secondary">Confirmada el {formatDate(resolution.confirmed_at)} UTC.</p>}
            {movement ? (
              <p><strong>{movement.order_type === "REFUND" ? "Reembolso confirmado" : "Liberación confirmada"}: {formatMoney(movement.amount_minor, movement.currency)} ({movement.currency})</strong></p>
            ) : <p className="text-secondary">Todavía no hay un movimiento final confirmado. Consultá el estado de la operación para seguir el pago.</p>}
          </section>
        )}

        {returnCase && (
          <section className="card mt-3" aria-labelledby="return-heading">
            <h2 id="return-heading">Devolución del producto</h2>
            {returnCase.state === "INSTRUCTIONS_ISSUED" && op.state === "RETURN_REQUIRED" ? (
              <>
                <p>{role === "BUYER" ? "Te corresponde devolver el producto. Antes de despacharlo, confirmá el destino y las condiciones indicadas por Operaciones; conservá el comprobante del envío." : "El comprador debe despachar la devolución. Cuando la recibas, informá a Operaciones para que valide la recepción."}</p>
                {returnCase.deadline && <p><strong>Plazo para despachar: {formatDate(returnCase.deadline)} UTC.</strong></p>}
                <p className="text-secondary">El despacho no confirma el reembolso: Operaciones valida la recepción antes de ejecutarlo.</p>
                {role === "BUYER" && <ReturnDispatchForm returnId={returnCase.return_id} />}
              </>
            ) : (
              <>
                <p>{returnCase.state === "RECIBIDA_CONFORME" || op.state === "REFUNDED" ? "La devolución fue recibida y validada." : "Devolución despachada. Operaciones debe validar la recepción para continuar con el reembolso."}</p>
                <dl className="dl">
                  <div><dt>Transportista</dt><dd>{returnCase.carrier ?? "Por informar"}</dd></div>
                  <div><dt>Código de seguimiento</dt><dd>{returnCase.tracking_code ?? "Por informar"}</dd></div>
                </dl>
              </>
            )}
          </section>
        )}

        <div className="card mt-3">
          <h2>Evidencia y respuestas</h2>
          {submissions.length === 0 && <p className="text-secondary">Todavía no hay aportes.</p>}
          <div className="flex-col">
            {submissions.map((s) => (
              <div key={s.submission_id} className="evidence-thumb">
                <div className="flex-between">
                  <strong>{names.get(s.author_id) ?? s.author_id}</strong>
                  <span className="text-secondary" style={{ fontSize: "var(--text-xs)" }}>{formatDate(s.created_at)}</span>
                </div>
                <p className="mt-2" style={{ whiteSpace: "pre-wrap" }}>{s.body}</p>
              </div>
            ))}
          </div>
          {images.length > 0 && <div className="evidence-gallery">{images.map((image) => <ImageLightbox key={image.evidence_id} src={`/api/evidence/${image.evidence_id}`} alt={image.original_name ?? "Evidencia adjunta"} />)}</div>}

          {isParticipant && disputeOpen && (
            <form action={addEvidenceAction} className="flex-col mt-4" encType="multipart/form-data">
              <input type="hidden" name="disputeId" value={id} />
              <div className="field">
                <label htmlFor="evidencia">Aportar evidencia o respuesta</label>
                <textarea
                  id="evidencia"
                  name="evidencia"
                  required
                  placeholder="Fotos, seguimiento, capturas, descripción de lo ocurrido… (en la demo, texto)"
                />
                <p className="hint">La otra parte podrá ver tu aporte.</p>
              </div>
              <div className="field"><label htmlFor="imagen">Adjuntar imagen</label><input id="imagen" name="imagen" type="file" accept="image/*" /><p className="hint">PNG, JPG o WEBP, hasta 10 MB.</p></div>
              <button className="btn btn-primary" type="submit">Enviar aporte</button>
            </form>
          )}
          {isParticipant && !disputeOpen && (
            <p className="text-secondary mt-3">Este reclamo ya fue resuelto.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function LinkBack({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="text-secondary" style={{ fontSize: "var(--text-sm)", display: "inline-block", marginBottom: 8 }}>
      ← {label}
    </a>
  );
}
