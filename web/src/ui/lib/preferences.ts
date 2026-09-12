export type SupportedLocale = "es" | "en" | "pt" | "fr";
export type ThemePreference = "light" | "dark" | "system";

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
  fr: "Français",
};

export const LOCALE_CODES: SupportedLocale[] = ["es", "en", "pt", "fr"];

export const preferenceText = {
  es: { language: "Idioma", theme: "Tema", light: "Claro", dark: "Oscuro", system: "Sistema", preferences: "Preferencias", saved: "Preferencias guardadas" },
  en: { language: "Language", theme: "Theme", light: "Light", dark: "Dark", system: "System", preferences: "Preferences", saved: "Preferences saved" },
  pt: { language: "Idioma", theme: "Tema", light: "Claro", dark: "Escuro", system: "Sistema", preferences: "Preferências", saved: "Preferências salvas" },
  fr: { language: "Langue", theme: "Thème", light: "Clair", dark: "Sombre", system: "Système", preferences: "Préférences", saved: "Préférences enregistrées" },
} satisfies Record<SupportedLocale, Record<string, string>>;

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value === "es" || value === "en" || value === "pt" || value === "fr";
}

export async function currentLocale(): Promise<SupportedLocale> {
  const { cookies } = await import("next/headers");
  const value = (await cookies()).get("yanti_locale")?.value;
  return isSupportedLocale(value) ? value : "es";
}
