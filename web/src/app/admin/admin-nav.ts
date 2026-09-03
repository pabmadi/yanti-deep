import { t } from "@/ui/lib/i18n";

export interface AdminNavItem {
  href: string;
  label: string;
}

/** Subnavegación del panel admin (hub + secciones). */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin", label: "Consola" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/catalogos", label: "Catálogos" },
  { href: "/admin/configuracion", label: "Configuración" },
  { href: "/admin/auditoria", label: t.admin.audit },
];
