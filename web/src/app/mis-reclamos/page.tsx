import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { getDb } from "@/data/db";
import { asRows } from "@/data/db";
import { listOperationsForAccount } from "@/data/repos/operation-repo";
import { formatDate } from "@/ui/lib/format";
import { getTranslations } from "@/ui/lib/i18n";
import { currentLocale } from "@/ui/lib/preferences";

export default async function MisReclamosPage() {
  const t = getTranslations(await currentLocale());
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const db = getDb();
  const myOps = listOperationsForAccount(db, account.account_id).map((o) => o.operation_id);
  if (myOps.length === 0) {
    return (
      <AppShell account={account}>
        <h1>{t.nav.disputes}</h1>
        <div className="empty card"><p>No tenés reclamos.</p></div>
      </AppShell>
    );
  }
  const marks = myOps.map(() => "?").join(",");
  const disputes = asRows<{ dispute_id: string; operation_id: string; reason: string; state: string; opened_at: string }>(
    db.prepare(`SELECT dispute_id, operation_id, reason, state, opened_at FROM dispute WHERE operation_id IN (${marks}) ORDER BY opened_at DESC`).all(...myOps),
  );

  return (
    <AppShell account={account}>
      <h1>{t.nav.disputes}</h1>
      {disputes.length === 0 ? (
        <div className="empty card"><p>No participaste en ningún reclamo.</p></div>
      ) : (
        <div className="flex-col">
          {disputes.map((d) => (
            <Link key={d.dispute_id} href={`/disputas/${d.dispute_id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="flex-between" style={{ flexWrap: "wrap" }}>
                <strong>{t.dispute.reasons[d.reason as keyof typeof t.dispute.reasons] ?? d.reason}</strong>
                <span className="badge">{d.state.replace(/_/g, " ").toLowerCase()}</span>
              </div>
              <div className="text-secondary mt-2" style={{ fontSize: "var(--text-sm)" }}>{formatDate(d.opened_at)}</div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
