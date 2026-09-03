import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { getDb } from "@/data/db";
import { getAttempt } from "@/data/repos/payment-repo";
import { getOperation } from "@/data/repos/operation-repo";
import { simulateWebhookAction, processFakePaymentReturn } from "@/ui/actions/operation-actions";
import { Money } from "@/ui/components/Money";

/**
 * "Checkout" del proveedor simulado (Mercado Pago fake). El retorno del navegador
 * NUNCA acredita (RF-PAG-002): es informativo. La acreditación llega por webhook
 * simulado o por consulta/reconciliación.
 */
export default async function FakeCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const sp = await searchParams;
  const attemptId = sp.attempt ?? "";
  const db = getDb();
  const attempt = attemptId ? getAttempt(db, attemptId) : undefined;
  if (!attempt) {
    return (
      <AppShell account={account}>
        <div className="card">
          <h1>Pago no encontrado</h1>
          <a href="/inicio" className="btn btn-primary">Volver al inicio</a>
        </div>
      </AppShell>
    );
  }
  const op = getOperation(db, attempt.operation_id)!;
  const isBuyer = op.buyer_id === account.account_id;

  return (
    <AppShell account={account}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="card">
          <div className="banner banner-info">
            <strong>Entorno de prueba.</strong> Este es el proveedor de pago simulado. No se mueve
            dinero real. El botón “Confirmar pago” representa completar el pago en Mercado Pago.
          </div>
          <h1>Completar el pago</h1>
          <p className="text-secondary">{op.title}</p>
          <div className="flex-between" style={{ padding: "12px 0", borderBottom: "1px dashed var(--yanti-border-default)" }}>
            <span>Total a pagar</span>
            <Money amountMinor={attempt.requested_total_minor} currency={attempt.currency} />
          </div>

          {!isBuyer && (
            <div className="banner banner-danger mt-3">Solo el comprador puede completar este pago.</div>
          )}

          {isBuyer && (
            <form action={processFakePaymentReturn} className="mt-4 flex-col">
              <input type="hidden" name="attemptId" value={attempt.attempt_id} />
              <button type="submit" className="btn btn-primary btn-block">
                Confirmar pago (simulado)
              </button>
            </form>
          )}

          <div className="card mt-3" style={{ background: "var(--surface-subtle)" }}>
            <h2>Panel de la demo</h2>
            <p className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
              En producción, un webhook autenticado de Mercado Pago acredita el pago. Acá podés
              simular ese evento:
            </p>
            <form action={simulateWebhookAction} className="flex-col">
              <input type="hidden" name="attemptId" value={attempt.attempt_id} />
              <button className="btn btn-secondary btn-block" type="submit">
                Simular webhook de acreditación
              </button>
            </form>
            <p className="text-secondary mt-3" style={{ fontSize: "var(--text-sm)" }}>
              Después de acreditar, un administrador debe <strong>reconciliar</strong> el pago desde la
              consola para habilitar el envío.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
