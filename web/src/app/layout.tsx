import type { Metadata } from "next";
import localFont from "next/font/local";
import "../ui/globals.css";
import { currentLocale } from "@/ui/lib/preferences";

const nunito = localFont({
  src: "../ui/fonts/Nunito-VariableFont_wght.ttf",
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yanti — Compraventa protegida entre particulares",
  description:
    "Protege tus compraventas entre particulares: acuerdo claro, pago seguro, envío con evidencia y resolución de reclamos.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  return (
    <html lang={locale === "pt" ? "pt-BR" : locale} className={nunito.variable} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('yanti.theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})()` }} />
        {children}
      </body>
    </html>
  );
}
