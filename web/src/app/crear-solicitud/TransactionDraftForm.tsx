"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createDraftAction,
  updateDraftAction,
  type DraftFormState,
  type DraftFormValues,
} from "@/ui/actions/operation-actions";

const EMPTY_VALUES: DraftFormValues = {
  titulo: "",
  descripcion: "",
  monto: "",
  categoria: "GENERAL",
  comprador_email: "",
  enlace: "",
  pais: "AR",
  moneda: "ARS",
};

export function TransactionDraftForm({
  mode = "create",
  initialValues = EMPTY_VALUES,
  embedded = false,
}: {
  mode?: "create" | "edit";
  initialValues?: DraftFormValues;
  embedded?: boolean;
}) {
  const action = mode === "edit" ? updateDraftAction : createDraftAction;
  const initialState: DraftFormState = { error: null, values: initialValues };
  const [state, formAction] = useActionState(action, initialState);
  const values = state.values;

  return (
    <form action={formAction} className={embedded ? "flex-col" : "card flex-col"} encType="multipart/form-data">
      {state.error && (
        <div className="banner banner-danger" role="alert">
          {state.error}
        </div>
      )}
      <div className="field">
        <label htmlFor={`${mode}-titulo`}>Qué vendés *</label>
        <input
          id={`${mode}-titulo`}
          name="titulo"
          required
          defaultValue={values.titulo}
          placeholder="Ej: Cámara Fuji X-T30 con lente 18-55mm"
        />
      </div>
      {mode === "create" && <div className="field"><label htmlFor="create-imagen">Imagen del producto</label><input id="create-imagen" name="imagen" type="file" accept="image/*" /><p className="hint">Opcional. PNG, JPG o WEBP, hasta 10 MB.</p></div>}
      <div className="field">
        <label htmlFor={`${mode}-descripcion`}>Condición y detalles *</label>
        <textarea
          id={`${mode}-descripcion`}
          name="descripcion"
          required
          defaultValue={values.descripcion}
          placeholder="Marca, modelo, estado, defectos conocidos, accesorios incluidos…"
        />
      </div>
      <div className="field">
        <label htmlFor={`${mode}-monto`}>Precio (ARS) *</label>
        <input
          id={`${mode}-monto`}
          name="monto"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          required
          defaultValue={values.monto}
          placeholder="45000"
        />
      </div>
      <div className="field">
        <label htmlFor={`${mode}-comprador-email`}>Correo del comprador *</label>
        <input
          id={`${mode}-comprador-email`}
          name="comprador_email"
          type="email"
          required
          defaultValue={values.comprador_email}
          placeholder="comprador@ejemplo.com"
        />
        <p className="hint">Le llega una invitación cuando envíes la solicitud.</p>
      </div>
      <div className="field">
        <label htmlFor={`${mode}-enlace`}>Enlace a la publicación (opcional)</label>
        <input
          id={`${mode}-enlace`}
          name="enlace"
          type="url"
          defaultValue={values.enlace}
          placeholder="https://…"
        />
      </div>
      <input type="hidden" name="pais" value={values.pais} />
      <input type="hidden" name="moneda" value={values.moneda} />
      <input type="hidden" name="categoria" value={values.categoria} />
      {values.operationId && <input type="hidden" name="operationId" value={values.operationId} />}
      {values.version && <input type="hidden" name="version" value={values.version} />}
      <DraftSubmitButton mode={mode} />
    </form>
  );
}

function DraftSubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  if (mode === "edit") {
    return (
      <button type="submit" className="btn btn-primary btn-block" disabled={pending} aria-disabled={pending}>
        {pending ? "Guardando…" : "Guardar y volver a revisar"}
      </button>
    );
  }
  return (
    <button type="submit" className="btn btn-primary btn-block" disabled={pending} aria-disabled={pending}>
      {pending ? "Guardando…" : "Crear borrador"}
    </button>
  );
}
