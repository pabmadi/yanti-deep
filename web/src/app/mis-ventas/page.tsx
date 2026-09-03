import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { Money } from "@/ui/components/Money";
import { getDb } from "@/data/db";
import { listOperationsForAccount, resolveRoleForOperation } from "@/data/repos/operation-repo";
import { formatDate } from "@/ui/lib/format";
import { t } from "@/ui/lib/i18n";

export default async function MisVentasPage() {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const db = getDb();
  const all = listOperationsForAccount(db, account.account_id);
  const ops = all.filter(
    (op) => resolveRoleForOperation(db, op, account.account_id, account.email_canonical) === "SELLER",
  );

  return (
    <AppShell account={account}>
      <div className="flex-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <h1>{t.nav.sales}</h1>
        <Link href="/crear-solicitud" className="btn btn-primary btn-sm">
          + {t.home.newSale}
        </Link>
      </div>
      {ops.length === 0 ? (
        <div className="empty card">
          <p>No tenés ventas todavía.</p>
          <Link href="/crear-solicitud" className="btn btn-primary">
            {t.home.newSale}
          </Link>
        </div>
      ) : (
        <div className="flex-col">
          {ops.map((op) => (
            <Link key={op.operation_id} href={`/operaciones/${op.operation_id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="flex-between" style={{ flexWrap: "wrap", gap: 8 }}>
                <strong>{op.title}</strong>
                <StatusBadge state={op.state} />
              </div>
              <div className="flex-between mt-2" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="text-secondary">{op.support_code} · {formatDate(op.created_at)}</span>
                <Money amountMinor={op.base_amount_minor} currency={op.currency} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
