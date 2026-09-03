import { getDb } from "@/data/db";
import { formatDate } from "@/ui/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buzón local — Yanti" };

/**
 * Buzón de correo simulado (R00-R02). Solo visible en local/demo.
 * Muestra los correos "enviados" por el sistema (magic links, avisos).
 */
export default async function MailboxPage({
  searchParams,
}: {
  searchParams: Promise<{ para?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const emails = (db
    .prepare("SELECT * FROM email ORDER BY created_at DESC LIMIT 40")
    .all() as Array<{ email_id: string; to_email: string; subject: string; body_text: string; purpose: string; created_at: string }>).filter(
    (e) => !sp.para || e.to_email === sp.para,
  );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>Buzón local (demo)</h1>
      <p className="text-secondary">
        Estos son los correos que el sistema "enviaría" por Resend. En esta demo podés abrir los
        enlaces directamente.
      </p>
      {emails.length === 0 && (
        <div className="empty">
          <p>No hay correos todavía.</p>
          <p>Pedí un magic link desde /ingresar o iniciá una operación.</p>
        </div>
      )}
      <div className="flex-col">
        {emails.map((e) => {
          const match = e.body_text.match(/https?:\/\/[^\s]+/);
          const link = match ? match[0] : null;
          return (
            <div key={e.email_id} className="card" style={{ padding: "var(--space-4)" }}>
              <div className="flex-between">
                <strong>{e.subject}</strong>
                <span className="text-secondary" style={{ fontSize: "var(--text-xs)" }}>
                  {formatDate(e.created_at)}
                </span>
              </div>
              <div className="text-secondary mt-2" style={{ fontSize: "var(--text-sm)", overflowWrap: "anywhere" }}>
                Para: {e.to_email}
              </div>
              {link ? (
                <div className="mt-2">
                  <a href={link} className="btn btn-primary btn-sm">
                    Abrir enlace mágico
                  </a>
                </div>
              ) : (
                <p className="mt-2 text-secondary" style={{ fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>
                  {e.body_text}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
