"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "./admin-nav";

/** Subnavegación admin con link activo (usePathname). Cliente mínimo. */
export function AdminSubnav() {
  const pathname = usePathname();
  const isActive = (href: string): boolean => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href.replace(/\/$/, "") + "/");
  };
  return (
    <nav aria-label="Panel de administración" className="subnav">
      {ADMIN_NAV.map((item) => (
        <Link key={item.href} href={item.href} className={`nav-pill${isActive(item.href) ? " active" : ""}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
