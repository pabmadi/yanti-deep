import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { Reveal } from "@/ui/components/landing/Reveal";
import { LandingStats } from "@/ui/components/landing/LandingStats";

export const metadata = {
  title: "Yanti — Comprá entre personas con más confianza",
  description:
    "Yanti vuelve seguras las compras entre desconocidos. Comprá con confianza en Marketplaces, grupos de WhatsApp, foros y más.",
};

/* Copy de la landing (UX-HOME aprobado, master v2). El acceso es vía /ingresar. */

const STEPS = [
  {
    n: 1,
    title: "Acuerdan las condiciones",
    body: "Comprador y vendedor definen el producto, precio, forma de pago y condiciones de envío.",
  },
  {
    n: 2,
    title: "Yanti acompaña el pago y previene riesgos",
    body: "El comprador realiza el pago y Yanti avisa al vendedor que puede despachar.",
  },
  {
    n: 3,
    title: "Entregan y confirman",
    body: "El vendedor registra la entrega y el comprador confirma que recibió el producto.",
  },
  {
    n: 4,
    title: "Yanti libera el pago",
    body: "Cuando se cumplen las condiciones y ambas partes confirman, Yanti procede a la liberación del pago al vendedor.",
  },
  {
    n: 5,
    title: "Yanti resuelve las disputas",
    body: "Si hay algún problema, Yanti analiza las evidencias y puede devolver el importe al comprador.",
  },
];

/* Métricas ilustrativas de la demo (evolución de Yanti en números). */
const STATS = [
  {
    value: 48250,
    label: "Usuarios",
    sub: "Personas que ya compran con confianza",
    bars: [12, 18, 22, 30, 38, 46, 55, 64, 74, 85, 93, 100],
  },
  {
    value: 128400,
    label: "Operaciones protegidas",
    sub: "Compraventas completadas de punta a punta",
    bars: [8, 14, 20, 27, 34, 45, 52, 61, 70, 82, 90, 100],
  },
  {
    value: 21450,
    label: "Monto transaccionado",
    prefix: "$ ",
    suffix: " M",
    sub: "En compraventas protegidas",
    bars: [10, 15, 24, 29, 40, 48, 60, 66, 78, 86, 95, 100],
  },
  {
    value: 18,
    label: "Disputas resueltas",
    sub: "Con devolución al comprador cuando correspondió",
    bars: [15, 20, 28, 36, 44, 52, 61, 68, 76, 85, 93, 100],
  },
  {
    value: 5,
    label: "Países",
    sub: "Argentina, Brasil, México, Chile y Uruguay",
    bars: [20, 20, 20, 40, 40, 40, 60, 60, 60, 80, 100, 100],
  },
];

export default async function LandingPage() {
  const session = await currentSession();
  if (session) redirect("/inicio");

  return (
    <div className="landing">
      {/* Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-logo" aria-label="Yanti — inicio">
            <Image src="/brand/yanti-isotype-color.svg" alt="" width={30} height={30} className="landing-logo-mark" priority />
            <span aria-hidden="true">Yanti</span>
          </Link>
          <nav aria-label="Principal" className="landing-nav-links">
            <a href="#como-funciona" className="landing-nav-link">
              Cómo funciona
            </a>
          </nav>
          <Link href="/ingresar" className="btn btn-primary landing-nav-cta">
            Ingresar
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="landing-hero" aria-labelledby="hero-title">
          <Reveal className="landing-hero-inner">
            <p className="landing-eyebrow">
              <span className="landing-eyebrow-dot" aria-hidden="true" />
              La confianza también se puede construir
            </p>
            <h1 id="hero-title" className="landing-hero-title">
              Comprá entre personas con más confianza
            </h1>
            <p className="landing-hero-sub">
              Yanti vuelve seguras las compras entre desconocidos.
            </p>
            <p className="landing-hero-sub2">
              Comprá con confianza en Marketplaces, grupos de WhatsApp, foros, etc.
            </p>
            <div className="landing-hero-actions">
              <Link href="/ingresar" className="btn btn-primary btn-lg">
                Ingresar
              </Link>
              <a href="#como-funciona" className="btn btn-secondary btn-lg">
                Cómo funciona
              </a>
            </div>
          </Reveal>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="landing-steps" aria-labelledby="steps-title">
          <div className="landing-steps-inner">
            <Reveal>
              <h2 id="steps-title" className="landing-section-title">
                Así de simple
              </h2>
            </Reveal>
            <ol className="landing-steps-grid">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.n} delay={i * 120} className="landing-step">
                  <span className="landing-step-num" aria-hidden="true">
                    {s.n}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Confianza / Yanti en números */}
        <section className="landing-trust" aria-labelledby="trust-title">
          <Reveal className="landing-trust-inner">
            {/* Escudo (check) — símbolo de protección */}
            <svg
              className="landing-trust-icon"
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 2 4 5.5v5.2c0 4.6 3.4 8.6 8 9.8 4.6-1.2 8-5.2 8-9.8V5.5L12 2Z"
                fill="currentColor"
                opacity="0.16"
              />
              <path
                d="M12 2 4 5.5v5.2c0 4.6 3.4 8.6 8 9.8 4.6-1.2 8-5.2 8-9.8V5.5L12 2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="m8.5 11.8 2.4 2.4 4.6-4.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 id="trust-title" className="landing-section-title">
              Claridad para ambas partes, de principio a fin.
            </h2>
          </Reveal>

          {/* Yanti en números */}
          <Reveal className="landing-stats-inner">
            <LandingStats items={STATS} />
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="landing-footer-logo">Yanti</span>
          <p>© Yanti. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
