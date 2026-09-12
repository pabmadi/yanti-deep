import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { OperationFilters } from "@/ui/components/OperationFilters";
import { OperationList } from "@/ui/components/OperationList";
import { getDb } from "@/data/db";
import { listOperationItemsForAccount } from "@/server/operation-list-query";
import { filterOperationItems } from "@/ui/lib/operation-list";
import { getTranslations } from "@/ui/lib/i18n";
import { currentLocale } from "@/ui/lib/preferences";

export default async function MisComprasPage({ searchParams }: { searchParams: Promise<{ q?: string; group?: string }> }) {
  const t = getTranslations(await currentLocale());
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const params = await searchParams;
  const q = params.q ?? "";
  const group = params.group ?? "all";
  const purchases = listOperationItemsForAccount(getDb(), account).filter((item) => item.role === "BUYER");
  const items = filterOperationItems(purchases, { q, group });
  const filtered = Boolean(q.trim() || group !== "all");

  return (
    <AppShell account={account}>
      <h1>{t.nav.purchases}</h1>
      <OperationFilters q={q} group={group} />
      {items.length > 0 ? <OperationList items={items} /> : (
        <div className="empty card">
          <p>{filtered ? "No encontramos compras con esos filtros." : "No participaste en compras todavía."}</p>
          <p className="text-secondary">{filtered ? "Probá con parte del título, el código de soporte o elegí otro estado." : "Cuando alguien te envíe una solicitud de pago, va a aparecer acá."}</p>
          {filtered && <a href="?" className="btn btn-secondary btn-sm">Ver todas las compras</a>}
        </div>
      )}
    </AppShell>
  );
}
