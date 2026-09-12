"use client";

import { useState } from "react";
import { TransactionDraftForm } from "@/app/crear-solicitud/TransactionDraftForm";
import { sendOperationAction, type DraftFormValues } from "@/ui/actions/operation-actions";

export function TransactionDraftReview({
  values,
  price,
  sellerFee,
  sellerNet,
  buyerFee,
  buyerTotal,
}: {
  values: DraftFormValues;
  price: string;
  sellerFee: string;
  sellerNet: string;
  buyerFee: string;
  buyerTotal: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex-col">
        <div className="flex-between" style={{ flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Editar borrador</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
            Volver sin guardar
          </button>
        </div>
        <TransactionDraftForm mode="edit" initialValues={values} embedded />
      </div>
    );
  }

  return (
    <div className="flex-col">
      <p className="text-secondary">Revisá el acuerdo y sus importes antes de enviarlo. Si cambiás el precio, guardá y volvé a esta revisión para ver los nuevos totales.</p>
      <dl className="dl">
        <div><dt>Producto</dt><dd>{values.titulo}</dd></div>
        <div><dt>Comprador</dt><dd>{values.comprador_email}</dd></div>
        <div><dt>Precio</dt><dd className="money">{price}</dd></div>
        <div><dt>Comisión del comprador</dt><dd className="money">{buyerFee}</dd></div>
        <div><dt>Total del comprador</dt><dd className="money">{buyerTotal}</dd></div>
        <div><dt>Comisión del vendedor</dt><dd className="money">{sellerFee}</dd></div>
        <div><dt>Neto para vos</dt><dd className="money">{sellerNet}</dd></div>
      </dl>
      <div>
        <strong>Condición informada</strong>
        <p>{values.descripcion}</p>
      </div>
      <button type="button" className="btn btn-secondary btn-block" onClick={() => setEditing(true)}>
        Editar borrador
      </button>
      <div className="banner banner-info">
        Al enviar, se notifica al comprador. Después podrás cancelarla mientras siga pendiente de aceptación, pero ya no editar el acuerdo.
      </div>
      <form action={sendOperationAction}>
        <input type="hidden" name="operationId" value={values.operationId} />
        <button className="btn btn-primary btn-block" type="submit">Enviar solicitud al comprador</button>
      </form>
    </div>
  );
}
