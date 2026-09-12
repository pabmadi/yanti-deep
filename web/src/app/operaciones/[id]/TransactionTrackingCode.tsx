"use client";

import { useState } from "react";

export function TransactionTrackingCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }

  return (
    <span className="flex" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span>{code}</span>
      <button className="btn btn-ghost btn-sm" type="button" onClick={copy}>
        {copied ? "Copiado" : "Copiar código"}
      </button>
    </span>
  );
}
