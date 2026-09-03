import { t } from "@/ui/lib/i18n";
import { formatMinorWithCode } from "@/ui/lib/format";

/** Desglose de dinero (obligatorio en toda pantalla financiera, doc FSD §24.1). */
export function MoneyBreakdown({
  baseMinor,
  currency,
  buyerFeeMinor,
  sellerFeeMinor,
  buyerTotalMinor,
  sellerNetMinor,
}: {
  baseMinor: number;
  currency: string;
  buyerFeeMinor: number;
  sellerFeeMinor: number;
  buyerTotalMinor: number;
  sellerNetMinor: number;
}) {
  return (
    <dl className="dl" aria-label="Desglose de dinero">
      <div>
        <dt>{t.op.amount}</dt>
        <dd className="money">{formatMinorWithCode(baseMinor, currency)}</dd>
      </div>
      <div>
        <dt>{t.op.buyerFee}</dt>
        <dd className="money">{formatMinorWithCode(buyerFeeMinor, currency)}</dd>
      </div>
      <div>
        <dt>{t.op.totalToPay}</dt>
        <dd className="money amount-lg">{formatMinorWithCode(buyerTotalMinor, currency)}</dd>
      </div>
      <div>
        <dt>{t.op.sellerFee}</dt>
        <dd className="money">{formatMinorWithCode(sellerFeeMinor, currency)}</dd>
      </div>
      <div>
        <dt>{t.op.netToReceive}</dt>
        <dd className="money">{formatMinorWithCode(sellerNetMinor, currency)}</dd>
      </div>
      <div>
        <dt>{t.op.currency}</dt>
        <dd>{currency}</dd>
      </div>
    </dl>
  );
}

/** Cantidad simple en moneda con código ISO (cifra tabular). */
export function Money({ amountMinor, currency }: { amountMinor: number; currency: string }) {
  return <span className="money">{formatMinorWithCode(amountMinor, currency)}</span>;
}
