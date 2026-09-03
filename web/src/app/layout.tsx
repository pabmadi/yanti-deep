import type { Metadata } from "next";
import localFont from "next/font/local";
import "../ui/globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
