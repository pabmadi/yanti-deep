import { Logo } from "./Logo";
import { NavLinks } from "./Nav";
import { getTranslations } from "@/ui/lib/i18n";
import { currentLocale } from "@/ui/lib/preferences";
import type { AccountRow } from "@/data/repos/account-repo";
import { getDb } from "@/data/db";
import { unreadNotificationCount } from "@/server/notifications";
import { PreferenceControls } from "./PreferenceControls";

/**
 * Barra superior + navegación responsive:
 * - Escritorio: enlaces visibles en línea.
 * - Móvil: menú hamburguesa (detalles nativo, sin JS, accesible por teclado).
 * El botón Salir usa un form POST a /auth/logout (redirige al host actual).
 */
export async function AppShell({ account, children }: { account: AccountRow; children: React.ReactNode }) {
  const t = getTranslations(await currentLocale());
  const isAdmin = account.is_admin === 1;
  const unreadCount = unreadNotificationCount(getDb(), account.account_id);
  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <div className="topbar-actions">
            <PreferenceControls compact />
            {/* Navegación escritorio */}
            <nav aria-label="Principal" className="topnav-desktop">
              <NavLinks isAdmin={isAdmin} unreadCount={unreadCount} />
            </nav>
            {/* Menú hamburguesa móvil (details nativo) */}
            <details className="menu-mobile">
              <summary className="menu-burger" aria-label="Abrir menú de navegación">
                <span className="burger-icon" aria-hidden="true"></span>
                <span className="visually-hidden">Menú</span>
              </summary>
              <nav aria-label="Principal móvil" className="menu-mobile-panel">
                <NavLinks isAdmin={isAdmin} unreadCount={unreadCount} closeMenu />
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
        <PreferenceControls />
        <p>Yanti · Compraventa protegida entre particulares · Demo local</p>
      </footer>
    </>
  );
}
