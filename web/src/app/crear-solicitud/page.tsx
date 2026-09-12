import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { TransactionDraftForm } from "./TransactionDraftForm";

export default async function NuevaSolicitudPage() {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;

  return (
    <AppShell account={account}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1>Nueva solicitud de pago</h1>
        <p className="text-secondary">
          Completá los datos para crear un borrador. Después vas a revisar el acuerdo y las
          comisiones antes de enviárselo al comprador.
        </p>

        <TransactionDraftForm />
      </div>
    </AppShell>
  );
}
