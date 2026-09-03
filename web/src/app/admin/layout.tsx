import { redirect } from "next/navigation";
import { currentAdmin } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { AdminSubnav } from "./_subnav";

/**
 * Layout del área admin: protege con currentAdmin(), envuelve en el AppShell
 * común y muestra la subnavegación (dashboard, consola, usuarios, catálogos,
 * configuración, auditoría). Las páginas hijas NO repiten <AppShell>.
 * El guard de rol real también se refuerza en cada server action (requireAdmin).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  return (
    <AppShell account={account}>
      <AdminSubnav />
      {children}
    </AppShell>
  );
}
