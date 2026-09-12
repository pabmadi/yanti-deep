"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import type { SupportedLocale } from "@/ui/lib/preferences";

const navCopy: Record<SupportedLocale, { home: string; purchases: string; sales: string; disputes: string; dashboard: string; console: string; audit: string; notices: string; profile: string }> = {
  es: { home: "Inicio", purchases: "Compras", sales: "Ventas", disputes: "Reclamos", dashboard: "Dashboard", console: "Consola", audit: "Auditoría", notices: "Avisos", profile: "Perfil" },
  en: { home: "Home", purchases: "Purchases", sales: "Sales", disputes: "Claims", dashboard: "Dashboard", console: "Console", audit: "Audit", notices: "Alerts", profile: "Profile" },
  pt: { home: "Início", purchases: "Compras", sales: "Vendas", disputes: "Reclamações", dashboard: "Dashboard", console: "Console", audit: "Auditoria", notices: "Avisos", profile: "Perfil" },
  fr: { home: "Accueil", purchases: "Achats", sales: "Ventes", disputes: "Réclamations", dashboard: "Tableau de bord", console: "Console", audit: "Audit", notices: "Avis", profile: "Profil" },
};

const links = (isAdmin: boolean, locale: SupportedLocale) => {
  const copy = navCopy[locale];
  return isAdmin
    ? [
        { href: "/inicio", label: copy.home },
        { href: "/admin/dashboard", label: copy.dashboard },
        { href: "/admin", label: copy.console },
        { href: "/admin/auditoria", label: copy.audit },
      ]
    : [
        { href: "/inicio", label: copy.home },
        { href: "/mis-compras", label: copy.purchases },
        { href: "/mis-ventas", label: copy.sales },
        { href: "/mis-reclamos", label: copy.disputes },
      ];
};

export function NavLinks({ isAdmin, unreadCount = 0, closeMenu = false }: { isAdmin: boolean; unreadCount?: number; closeMenu?: boolean }) {
  const pathname = usePathname();
  const [locale, setLocale] = useState<SupportedLocale>("es");
  useEffect(() => {
    const read = () => {
      const value = window.localStorage.getItem("yanti.locale");
      if (value === "es" || value === "en" || value === "pt" || value === "fr") setLocale(value);
    };
    read();
    window.addEventListener("yanti:locale", read);
    return () => window.removeEventListener("yanti:locale", read);
  }, []);
  const copy = navCopy[locale];
  const navLinks = [...links(isAdmin, locale), { href: "/notificaciones", label: copy.notices }];
  const activeHref = navLinks
    .filter((link) => pathname === link.href || (link.href !== "/inicio" && pathname.startsWith(`${link.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!closeMenu) return;
    const details = event.currentTarget.closest("details");
    if (details instanceof HTMLDetailsElement) details.open = false;
  };

  return (
    <>
      {navLinks.map((link) => {
        const active = activeHref === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-pill${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={handleClick}
          >
            {link.label}
            {link.href === "/notificaciones" && unreadCount > 0 && (
              <>
                <span aria-hidden="true"> ({unreadCount})</span>
                <span className="visually-hidden">, {unreadCount} sin leer</span>
              </>
            )}
          </Link>
        );
      })}
      <Link href="/perfil" className={`nav-pill${pathname === "/perfil" || pathname.startsWith("/perfil/") ? " active" : ""}`} aria-current={pathname === "/perfil" || pathname.startsWith("/perfil/") ? "page" : undefined} onClick={handleClick}>
        {copy.profile}
      </Link>
    </>
  );
}
