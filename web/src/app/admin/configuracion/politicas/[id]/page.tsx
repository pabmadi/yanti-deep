import { notFound, redirect } from "next/navigation";
import { currentAdmin } from "@/ui/lib/session";
import { getDb } from "@/data/db";
import { getPolicy, validatePolicy, simulatePolicy } from "@/server/admin-policy";
import { publishPolicyAction, retirePolicyAction } from "@/ui/actions/admin-policy-actions";
import { formatDate } from "@/ui/lib/format";
import { formatMoney } from "@/ui/lib/format";
import { StatusBadge } from "@/ui/components/StatusBadge";

export default async function PoliticaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string; publicada?: string; retirada?: string; simulada?: string; base?: string }>;
}) {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();

  const policy = getPolicy(db, id);
  if (!policy) notFound();
  const { ok, conflicts } = validatePolicy(db, id);
  const buyerPct = ((policy.buyer_rate_num / policy.buyer_rate_den) * 100).toFixed(2);
  const sellerPct = ((policy.seller_rate_num / policy.seller_rate_den) * 100).toFixed(2);
  const isDraft = policy.status === "DRAFT";
  const isActive = policy.status === "ACTIVE";

  // Simulación (RF-ADM-004): muestra el desglose para un monto de ejemplo.
  const baseMinor = Number(sp.base ?? "100000");
  const sim = simulatePolicy(db, {
    scope: { countryCode: policy.country_code, currency: policy.currency, categoryCode: policy.category_code },
    baseMinor,
    policyId: policy.policy_id,
  });

  return (
    <>
      <h1>Política {policy.policy_id}</h1>
      <p className="text-secondary"><a href="/admin/configuracion">← Volver a configuración</a></p>
      {sp.creada && <div className="banner banner-info">Borrador creado. Validá el solapamiento y publicá cuando corresponda.</div>}
      {sp.publicada && <div className="banner banner-success">Política publicada (ACTIVE). Solo afecta operaciones futuras.</div>}
      {sp.retirada && <div className="banner banner-warning">Política retirada.</div>}

      <div className="card">
        <dl className="dl">
          <div><dt>Ámbito</dt><dd>{policy.country_code}/{policy.currency}/{policy.category_code}</dd></div>
          <div><dt>Versión</dt><dd>v{policy.version}</dd></div>
          <div><dt>Estado</dt><dd><StatusBadge state={policy.status === "ACTIVE" ? "COMPLETED" : policy.status === "DRAFT" ? "PAYMENT_IN_PROGRESS" : "CANCELLED"} /></dd></div>
          <div><dt>Comprador</dt><dd>{buyerPct}% {policy.buyer_fixed_minor ? `+ fijo ${formatMoney(policy.buyer_fixed_minor, policy.currency)}` : ""}</dd></div>
          <div><dt>Vendedor</dt><dd>{sellerPct}% {policy.seller_fixed_minor ? `+ fijo ${formatMoney(policy.seller_fixed_minor, policy.currency)}` : ""}</dd></div>
          <div><dt>Vigente desde</dt><dd>{formatDate(policy.effective_from)}</dd></div>
          <div><dt>Creada por</dt><dd>{policy.created_by ?? "—"} · {formatDate(policy.created_at)}</dd></div>
          <div><dt>Motivo</dt><dd>{policy.reason ?? "—"}</dd></div>
        </dl>
      </div>

      {isDraft && !ok && (
        <div className="banner banner-warning mt-3">{conflicts.join(". ")}</div>
      )}

      <div className="card mt-3">
        <h2>Simulación de desglose (RF-ADM-004)</h2>
        <form method="get" className="flex" style={{ gap: 8 }}>
          <div className="field">
            <label className="visually-hidden" htmlFor="base">Monto base (unidades menores)</label>
            <input id="base" name="base" type="number" min={1} defaultValue={baseMinor} />
          </div>
          <button className="btn btn-secondary btn-sm" type="submit" style={{ alignSelf: "flex-end" }}>Simular</button>
        </form>
        <dl className="dl mt-3">
          <div><dt>Monto base</dt><dd className="money">{formatMoney(sim.baseMinor, sim.currency)}</dd></div>
          <div><dt>Comisión comprador</dt><dd className="money">{formatMoney(sim.buyerFeeMinor, sim.currency)}</dd></div>
          <div><dt>Comisión vendedor</dt><dd className="money">{formatMoney(sim.sellerFeeMinor, sim.currency)}</dd></div>
          <div><dt>Total a pagar (comprador)</dt><dd className="money">{formatMoney(sim.buyerTotalMinor, sim.currency)}</dd></div>
          <div><dt>Neto a recibir (vendedor)</dt><dd className="money">{formatMoney(sim.sellerNetMinor, sim.currency)}</dd></div>
        </dl>
      </div>

      <div className="card mt-3">
        <h2>Acciones</h2>
        <div className="flex-col" style={{ gap: 12, maxWidth: 420 }}>
          {isDraft && (
            <form action={publishPolicyAction} className="flex-col" style={{ gap: 8 }}>
              <input type="hidden" name="policyId" value={policy.policy_id} />
              <div className="field">
                <label htmlFor="pub-reason">Motivo de publicación (obligatorio)</label>
                <input id="pub-reason" name="reason" required placeholder="Aprobación comercial" />
              </div>
              <button className="btn btn-primary btn-sm" type="submit" disabled={!ok} style={{ alignSelf: "flex-start" }}>Publicar política</button>
              {!ok && <p className="text-secondary" style={{ fontSize: "var(--text-xs)" }}>Corregí el solapamiento antes de publicar.</p>}
            </form>
          )}
          {(isActive || isDraft) && (
            <form action={retirePolicyAction} className="flex-col" style={{ gap: 8 }}>
              <input type="hidden" name="policyId" value={policy.policy_id} />
              <div className="field">
                <label htmlFor="ret-reason">Motivo de retiro (obligatorio)</label>
                <input id="ret-reason" name="reason" required placeholder="Motivo del retiro" />
              </div>
              <button className="btn btn-danger btn-sm" type="submit" style={{ alignSelf: "flex-start" }}>Retirar política</button>
            </form>
          )}
          {policy.status === "RETIRED" && <p className="text-secondary">Política retirada. Se conserva como referencia histórica.</p>}
        </div>
      </div>
    </>
  );
}
