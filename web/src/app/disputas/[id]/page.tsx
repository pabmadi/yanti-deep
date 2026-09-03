import { redirect, notFound } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { getDb } from "@/data/db";
import { getOperation } from "@/data/repos/operation-repo";
import { getPartyRole } from "@/data/repos/operation-repo";
import { listSubmissions, type DisputeRow } from "@/data/repos/dispute-repo";
import { formatDate } from "@/ui/lib/format";
import { t } from "@/ui/lib/i18n";
import { addEvidenceAction } from "@/ui/actions/operation-actions";

export default async function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const { id } = await params;

  const db = getDb();
  const dispute = db.prepare("SELECT * FROM dispute WHERE dispute_id=?").get(id) as DisputeRow | undefined;
  if (!dispute) notFound();
  const op = getOperation(db, dispute.operation_id);
  if (!op) notFound();
  const role = getPartyRole(db, dispute.operation_id, account.account_id);
  if (!role) notFound();

  const isAdmin = account.is_admin === 1;
  const submissions = listSubmissions(db, id, !isAdmin);
  const isParticipant = role === "BUYER" || role === "SELLER";
  const disputeOpen = !dispute.state.startsWith("RESOLVED");

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

        <dl className="dl card mt-3">
          <div><dt>Motivo</dt><dd>{t.dispute.reasons[dispute.reason as keyof typeof t.dispute.reasons] ?? dispute.reason}</dd></div>
          <div><dt>Estado</dt><dd>{dispute.state.replace(/_/g, " ").toLowerCase()}</dd></div>
          <div><dt>Descripción del comprador</dt><dd>{dispute.description}</dd></div>
        </dl>

        <div className="card mt-3">
          <h2>Evidencia y alegaciones</h2>
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

          {isParticipant && disputeOpen && (
            <form action={addEvidenceAction} className="flex-col mt-4">
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
