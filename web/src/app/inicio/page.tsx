import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { OperationList } from "@/ui/components/OperationList";
import { getTranslations } from "@/ui/lib/i18n";
import { currentLocale } from "@/ui/lib/preferences";
import { getDb } from "@/data/db";
import { listOperationItemsForAccount } from "@/server/operation-list-query";
import { type OperationGroup } from "@/ui/lib/operation-list";

const GROUPS: OperationGroup[] = ["action", "waiting", "finished"];

export default async function InicioPage() {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const t = getTranslations(await currentLocale());
  if (account.is_admin === 1) redirect("/admin");
  const items = listOperationItemsForAccount(getDb(), account);

  return (
    <AppShell account={account}>
      <div className="flex-between" style={{ marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>{t.home.welcome.replace("{name}", account.display_name.split(" ")[0])}</h1>
          <p className="text-secondary">Tu actividad, ordenada por lo que necesita atención.</p>
        </div>
        <Link href="/crear-solicitud" className="btn btn-primary">+ {t.home.newSale}</Link>
      </div>
      {items.length === 0 ? (
        <div className="empty card"><p>{t.home.empty}</p><Link href="/crear-solicitud" className="btn btn-primary">{t.home.newSale}</Link></div>
      ) : (
        <div className="flex-col" style={{ gap: 28 }}>
          {GROUPS.map((group) => {
            const grouped = items.filter((item) => item.group === group);
            if (grouped.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`group-${group}`}>
                <div className="flex-between" style={{ marginBottom: 12 }}>
                  <h2 id={`group-${group}`} style={{ margin: 0 }}>{group === "action" ? t.home.needsAction : group === "waiting" ? "Esperando" : "Finalizadas"}</h2>
                  <span className="badge" aria-label={`${grouped.length} operaciones`}>{grouped.length}</span>
                </div>
                <OperationList items={grouped.slice(0, group === "finished" ? 3 : 6)} />
                {grouped.length > (group === "finished" ? 3 : 6) && (
                  <div className="flex" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <Link href={`/mis-compras?group=${group}`} className="btn btn-secondary btn-sm">Ver compras</Link>
                    <Link href={`/mis-ventas?group=${group}`} className="btn btn-secondary btn-sm">Ver ventas</Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
