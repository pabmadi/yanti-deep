"use client";

import { useEffect, useState } from "react";
import { LOCALE_CODES, LOCALE_LABELS, preferenceText, type SupportedLocale, type ThemePreference } from "@/ui/lib/preferences";

const LOCALE_KEY = "yanti.locale";
const THEME_KEY = "yanti.theme";

function readLocale(): SupportedLocale {
  if (typeof window === "undefined") return "es";
  const value = window.localStorage.getItem(LOCALE_KEY);
  return LOCALE_CODES.includes(value as SupportedLocale) ? value as SupportedLocale : "es";
}

function readTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

function applyTheme(theme: ThemePreference) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function PreferenceControls({ compact = false }: { compact?: boolean }) {
  const [locale, setLocale] = useState<SupportedLocale>("es");
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    const nextLocale = readLocale();
    const nextTheme = readTheme();
    setLocale(nextLocale);
    setTheme(nextTheme);
    applyTheme(nextTheme);
    document.documentElement.lang = nextLocale === "pt" ? "pt-BR" : nextLocale;
  }, []);

  const text = preferenceText[locale];
  const updateLocale = (next: SupportedLocale) => {
    setLocale(next);
    window.localStorage.setItem(LOCALE_KEY, next);
    document.cookie = `yanti_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next === "pt" ? "pt-BR" : next;
    window.dispatchEvent(new CustomEvent("yanti:locale", { detail: next }));
  };
  const updateTheme = (next: ThemePreference) => {
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  };

  return (
    <div className={`preference-controls${compact ? " preference-controls-compact" : ""}`} aria-label={text.preferences}>
      <label className="preference-field">
        <span>{text.language}</span>
        <select value={locale} onChange={(event) => updateLocale(event.target.value as SupportedLocale)} aria-label={text.language}>
          {LOCALE_CODES.map((code) => <option key={code} value={code}>{LOCALE_LABELS[code]}</option>)}
        </select>
      </label>
      <label className="preference-field">
        <span>{text.theme}</span>
        <select value={theme} onChange={(event) => updateTheme(event.target.value as ThemePreference)} aria-label={text.theme}>
          <option value="system">{text.system}</option>
          <option value="light">{text.light}</option>
          <option value="dark">{text.dark}</option>
        </select>
      </label>
      <span className="visually-hidden" role="status" aria-live="polite">{text.saved}</span>
    </div>
  );
}
