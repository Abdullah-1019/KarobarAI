import type { PaymentMethod } from '@prisma/client';

import { CODAdapter } from './cod.adapter';
import { EasyPaisaAdapter, JazzCashAdapter } from './local-gateway.adapter';
import type { PaymentAdapter } from './payment.adapter';
import { StripeAdapter } from './stripe.adapter';

export function getPaymentGatewayAdapter(method: PaymentMethod): PaymentAdapter {
  switch (method) {
    case 'COD': return new CODAdapter();
    case 'STRIPE': return new StripeAdapter();
    case 'JAZZCASH': return new JazzCashAdapter();
    case 'EASYPAISA': return new EasyPaisaAdapter();
  }
}
