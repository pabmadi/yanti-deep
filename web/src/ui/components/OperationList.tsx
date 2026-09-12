import Link from "next/link";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { Money } from "@/ui/components/Money";
import { formatDate } from "@/ui/lib/format";
import type { OperationListItem } from "@/ui/lib/operation-list";

export function OperationList({ items }: { items: OperationListItem[] }) {
  return (
    <div className="flex-col">
      {items.map((item) => (
        <Link key={item.operationId} href={`/operaciones/${item.operationId}`} className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <div className="flex-between" style={{ flexWrap: "wrap", gap: 8 }}>
            <div>
              <strong style={{ fontSize: "var(--text-lg)" }}>{item.title}</strong>
              <div className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
                {item.role === "BUYER" ? "Compra a" : "Venta a"} {item.counterparty ?? "persona por confirmar"} · {item.supportCode}
              </div>
            </div>
            <StatusBadge state={item.state} />
          </div>
          <div className="grid-2 mt-3">
            <div>
              <div style={{ fontWeight: 700 }}>Siguiente paso</div>
              <div className="text-secondary">{item.nextStep}</div>
              {item.deadline && item.deadlineLabel && (
                <div className="text-secondary" style={{ fontSize: "var(--text-sm)", marginTop: 4 }}>
                  {item.deadlineLabel}: {formatDate(item.deadline)} UTC
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>{item.amountLabel}</div>
              <Money amountMinor={item.amountMinor} currency={item.currency} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
