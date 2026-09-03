import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { Money } from "@/ui/components/Money";
import { t } from "@/ui/lib/i18n";
import { getDb } from "@/data/db";
import { listOperationsForAccount, resolveRoleForOperation, type OperationRow } from "@/data/repos/operation-repo";
import { formatDate } from "@/ui/lib/format";

function isActionable(state: string): boolean {
  return [
    "AWAITING_ACCEPTANCE",
    "ACCEPTED_AWAITING_PAYMENT",
    "PAID_AWAITING_SHIPMENT",
    "SHIPPED_AWAITING_RECEIPT",
    "CONFIRMATION_OVERDUE",
    "IN_DISPUTE",
    "RETURN_REQUIRED",
    "RELEASE_IN_PROGRESS",
    "REFUND_IN_PROGRESS",
    "PAYMENT_IN_PROGRESS",
    "DRAFT",
  ].includes(state);
}

function roleOf(
  db: ReturnType<typeof getDb>,
  op: OperationRow,
  accountId: string,
  accountEmail: string,
): "BUYER" | "SELLER" | undefined {
  return resolveRoleForOperation(db, op, accountId, accountEmail);
}

export default async function InicioPage() {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const db = getDb();
  const ops = listOperationsForAccount(db, account.account_id);

  // Destacadas (requieren acción) primero
  const sorted = [...ops].sort((a, b) => {
    const aAction = isActionable(a.state) ? 0 : 1;
    const bAction = isActionable(b.state) ? 0 : 1;
    if (aAction !== bAction) return aAction - bAction;
    return b.created_at.localeCompare(a.created_at);
  });

  return (
    <AppShell account={account}>
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <h1>{t.home.welcome.replace("{name}", account.display_name.split(" ")[0])}</h1>
        <Link href="/crear-solicitud" className="btn btn-primary">
          + {t.home.newSale}
        </Link>
      </div>

      <div className="flex" style={{ gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <Link href="/dev/buzon" className="btn btn-secondary btn-sm">
          {t.home.viewInbox}
        </Link>
        <Link href="/perfil" className="btn btn-secondary btn-sm">
          Perfil
        </Link>
      </div>

      <h2>{t.home.recent}</h2>
      {sorted.length === 0 ? (
        <div className="empty card">
          <p>{t.home.empty}</p>
          <Link href="/crear-solicitud" className="btn btn-primary">
            {t.home.newSale}
          </Link>
        </div>
      ) : (
        <div className="flex-col">
          {sorted.slice(0, 10).map((op) => {
            const role = roleOf(db, op, account.account_id, account.email_canonical);
            return (
              <Link
                key={op.operation_id}
                href={`/operaciones/${op.operation_id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div className="flex-between" style={{ flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong style={{ fontSize: "var(--text-lg)" }}>{op.title}</strong>
                    <div className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
                      {role === "SELLER" ? `${t.role.SELLER} · ` : `${t.role.BUYER} · `}
                      {op.support_code} · {formatDate(op.created_at)}
                    </div>
                  </div>
                  <StatusBadge state={op.state} />
                </div>
                <div className="flex-between mt-2" style={{ flexWrap: "wrap", gap: 8 }}>
                  <span className="text-secondary">
                    {op.buyer_email ? `Comprador: ${op.buyer_email}` : "Sin comprador asignado"}
                  </span>
                  <Money amountMinor={op.base_amount_minor} currency={op.currency} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
