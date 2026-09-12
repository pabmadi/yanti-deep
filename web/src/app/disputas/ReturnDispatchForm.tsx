"use client";

import { useActionState } from "react";
import { participantReturnAction } from "@/ui/actions/participant-return-actions";

export function ReturnDispatchForm({ returnId }: { returnId: string }) {
  const [state, action, pending] = useActionState(participantReturnAction, { error: null, carrier: "", tracking: "" });
  return (
    <form action={action} className="flex-col mt-3">
      <input type="hidden" name="returnId" value={returnId} />
      {state.error && <div className="banner banner-danger" role="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="return-carrier">Transportista de la devolución</label>
        <input id="return-carrier" name="carrier" required defaultValue={state.carrier} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="return-tracking">Código de seguimiento</label>
        <input id="return-tracking" name="tracking" required defaultValue={state.tracking} autoComplete="off" />
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Registrando…" : "Registrar devolución despachada"}</button>
    </form>
  );
}
