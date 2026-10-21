import type { Payer, Quote } from '../api/types';
import { formatMoney, humanize } from '../utils/format';

interface Props {
  quote: Quote;
  requestedPayer?: Payer;
}

export default function PriceQuote({ quote, requestedPayer }: Props) {
  const fellBackToSelfPay = requestedPayer === 'INSURANCE' && quote.payer === 'SELF_PAY';

  return (
    <div className="price-quote">
      <dl>
        <div>
          <dt>List price</dt>
          <dd>{formatMoney(quote.listPrice)}</dd>
        </div>
        <div>
          <dt>Paid by insurer</dt>
          <dd>{formatMoney(quote.insurerShare)}</dd>
        </div>
        <div className="total">
          <dt>You pay</dt>
          <dd>{formatMoney(quote.patientShare)}</dd>
        </div>
      </dl>

      {quote.capExceeded && (
        <p className="banner banner-warning">Annual insurance visit limit reached — self-pay price applies</p>
      )}
      {!quote.capExceeded && fellBackToSelfPay && (
        <p className="banner banner-warning">
          Your insurance won’t cover this visit, so the self-pay price applies.
          {quote.payerReason && <span className="muted"> ({humanize(quote.payerReason)})</span>}
        </p>
      )}
    </div>
  );
}
