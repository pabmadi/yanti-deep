"use client";

import { useEffect, useRef, useState } from "react";

export interface StatItem {
  /** Valor final del contador (número puro, sin formato). */
  value: number;
  prefix?: string;
  suffix?: string;
  /** Cantidad de decimales a mostrar (p. ej. 98.5). */
  decimals?: number;
  label: string;
  sub?: string;
  /** Progreso de la mini-gráfica de evolución (0-100 por período). */
  bars: number[];
}

function format(n: number, decimals = 0): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/**
 * Tarjetas de "Yanti en números" con animación al hacer scroll:
 * contador (count-up con requestAnimationFrame) + mini gráfico de barras
 * que crece cuando la tarjeta entra al viewport. Sin dependencias.
 */
export function LandingStats({ items }: { items: StatItem[] }) {
  return (
    <ul className="landing-stats-grid">
      {items.map((it) => (
        <StatCard key={it.label} item={it} />
      ))}
    </ul>
  );
}

function StatCard({ item }: { item: StatItem }) {
  const ref = useRef<HTMLLIElement | null>(null);
  const [inView, setInView] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Count-up animado cuando entra en view.
  useEffect(() => {
    if (!inView) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplay(item.value);
      return;
    }
    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(item.value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(item.value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, item.value]);

  return (
    <li ref={ref} className={`landing-stat${inView ? " is-visible" : ""}`}>
      <div className="landing-stat-value">
        {item.prefix ?? ""}
        {format(display, item.decimals ?? 0)}
        {item.suffix ?? ""}
      </div>
      <div className="landing-stat-label">{item.label}</div>
      {item.sub && <div className="landing-stat-sub">{item.sub}</div>}
    </li>
  );
}
