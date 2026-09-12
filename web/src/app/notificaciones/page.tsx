import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/ui/components/AppShell";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { currentSession } from "@/ui/lib/session";
import { getDb } from "@/data/db";
import { listNotificationsForAccount } from "@/server/notifications";
import { formatDate } from "@/ui/lib/format";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/ui/actions/notification-actions";

export default async function NotificationsPage() {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const notifications = listNotificationsForAccount(getDb(), account);
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <AppShell account={account}>
      <div className="flex-between" style={{ gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1>Notificaciones</h1>
          <p className="text-secondary">Estos avisos registran lo ocurrido. Abrí la operación para ver su estado actual.</p>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button className="btn btn-secondary btn-sm" type="submit">Marcar todas como leídas</button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty card"><p>No tenés notificaciones todavía.</p></div>
      ) : (
        <div className="flex-col">
          {notifications.map((notification) => (
            <article key={notification.notificationId} className="card" aria-label={notification.readAt ? "Notificación leída" : "Notificación no leída"}>
              <div className="flex-between" style={{ gap: 12, flexWrap: "wrap" }}>
                <div>
                  {!notification.readAt && <span className="badge" style={{ marginRight: 8 }}>Nueva</span>}
                  <span className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
                    Aviso registrado el {formatDate(notification.createdAt)} UTC
                  </span>
                </div>
                {notification.operationState && <StatusBadge state={notification.operationState} />}
              </div>
              <p style={{ marginBottom: 8 }}>{notification.body}</p>
              {notification.deadline && (
                <p className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
                  Fecha informada en el aviso: {formatDate(notification.deadline)} UTC
                </p>
              )}
              <div className="flex" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {notification.operationHref && (
                  <Link href={notification.operationHref} className="btn btn-primary btn-sm">
                    Ver estado actual{notification.operationTitle ? ` de ${notification.operationTitle}` : ""}
                  </Link>
                )}
                {!notification.readAt && (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={notification.notificationId} />
                    <button className="btn btn-ghost btn-sm" type="submit">Marcar como leída</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
