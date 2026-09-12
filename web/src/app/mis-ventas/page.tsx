import Link from "next/link";
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

export default async function MisVentasPage({ searchParams }: { searchParams: Promise<{ q?: string; group?: string }> }) {
  const t = getTranslations(await currentLocale());
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const params = await searchParams;
  const q = params.q ?? "";
  const group = params.group ?? "all";
  const sales = listOperationItemsForAccount(getDb(), account).filter((item) => item.role === "SELLER");
  const items = filterOperationItems(sales, { q, group });
  const filtered = Boolean(q.trim() || group !== "all");

  return (
    <AppShell account={account}>
      <div className="flex-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <h1>{t.nav.sales}</h1>
        <Link href="/crear-solicitud" className="btn btn-primary btn-sm">+ {t.home.newSale}</Link>
      </div>
      <OperationFilters q={q} group={group} />
      {items.length > 0 ? <OperationList items={items} /> : (
        <div className="empty card">
          <p>{filtered ? "No encontramos ventas con esos filtros." : "No tenés ventas todavía."}</p>
          <p className="text-secondary">{filtered ? "Probá con parte del título, el código de soporte o elegí otro estado." : "Creá una solicitud para empezar una venta protegida."}</p>
          {filtered ? <a href="?" className="btn btn-secondary btn-sm">Ver todas las ventas</a> : <Link href="/crear-solicitud" className="btn btn-primary">{t.home.newSale}</Link>}
        </div>
      )}
    </AppShell>
  );
}
