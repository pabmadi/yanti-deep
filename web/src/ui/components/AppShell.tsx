import Link from "next/link";
import { Logo } from "./Logo";
import { t } from "@/ui/lib/i18n";
import type { AccountRow } from "@/data/repos/account-repo";

function NavLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  // El admin operativo no participa como comprador/vendedor: solo ve Inicio,
  // su consola y Perfil. (Los roles transaccionales y administrativos están separados.)
  return (
    <>
      <Link href="/" className="nav-pill" onClick={onNavigate}>
        {t.nav.home}
      </Link>
      {isAdmin ? (
        <>
          <Link href="/admin/dashboard" className="nav-pill" onClick={onNavigate}>
            Dashboard
          </Link>
          <Link href="/admin" className="nav-pill" onClick={onNavigate}>
            {t.nav.admin}
          </Link>
          <Link href="/admin/auditoria" className="nav-pill" onClick={onNavigate}>
            Auditoría
          </Link>
        </>
      ) : (
        <>
          <Link href="/mis-compras" className="nav-pill" onClick={onNavigate}>
            {t.nav.purchases}
          </Link>
          <Link href="/mis-ventas" className="nav-pill" onClick={onNavigate}>
            {t.nav.sales}
          </Link>
          <Link href="/mis-reclamos" className="nav-pill" onClick={onNavigate}>
            {t.nav.disputes}
          </Link>
        </>
      )}
      <Link href="/perfil" className="nav-pill" onClick={onNavigate}>
        {t.nav.profile}
      </Link>
    </>
  );
}

/**
 * Barra superior + navegación responsive:
 * - Escritorio: enlaces visibles en línea.
 * - Móvil: menú hamburguesa (detalles nativo, sin JS, accesible por teclado).
 * El botón Salir usa un form POST a /auth/logout (redirige al host actual).
 */
export function AppShell({ account, children }: { account: AccountRow; children: React.ReactNode }) {
  const isAdmin = account.is_admin === 1;
  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <div className="topbar-actions">
            {/* Navegación escritorio */}
            <nav aria-label="Principal" className="topnav-desktop">
              <NavLinks isAdmin={isAdmin} />
            </nav>
            {/* Menú hamburguesa móvil (details nativo) */}
            <details className="menu-mobile">
              <summary className="menu-burger" aria-label="Abrir menú de navegación">
                <span className="burger-icon" aria-hidden="true"></span>
                <span className="visually-hidden">Menú</span>
              </summary>
              <nav aria-label="Principal móvil" className="menu-mobile-panel">
                <NavLinks isAdmin={isAdmin} />
                <form action="/auth/logout" method="post">
                  <button type="submit" className="nav-pill nav-pill-logout">
                    {t.nav.logout}
                  </button>
                </form>
              </nav>
            </details>
            {/* Logout escritorio */}
            <form action="/auth/logout" method="post" className="logout-desktop">
              <button type="submit" className="btn btn-ghost btn-sm">
                {t.nav.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="page-wrap">
        {children}
      </main>
      <footer className="site">
        <p>Yanti · Compraventa protegida entre particulares · Demo local</p>
      </footer>
    </>
  );
}
