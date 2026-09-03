"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveal al hacer scroll: fade + desplazamiento suave cuando el elemento entra
 * al viewport. Sin dependencias; usa IntersectionObserver.
 *
 * Robustez:
 * - Si el elemento ya está en pantalla al montar, se muestra de inmediato.
 * - Si IntersectionObserver no está disponible (SSR/JS off/edge), se muestra.
 * - Fallback: pasados `fallbackMs` sin ser observado, se fuerza visible
 *   (evita contenido invisible si algo falla o en capturas full-page).
 * - `prefers-reduced-motion` lo anula vía CSS (visible sin transición).
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section" | "li" | "span";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    // ¿Ya está en pantalla? Mostrar ya (no esperar scroll).
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -24px 0px" },
    );
    io.observe(el);

    // Fallback de seguridad: forzar visible si el observer no disparó.
    const fallback = window.setTimeout(() => {
      setShown(true);
      io.disconnect();
    }, 2500);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`landing-reveal${shown ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
