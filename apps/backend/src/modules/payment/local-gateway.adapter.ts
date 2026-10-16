import type { PaymentMethod, PaymentStatus } from '@prisma/client';

import { prisma } from '../../core/prisma';
import { PaymentGatewayUnavailableError } from '../../core/errors/AppError';
import { config } from '../../core/config';
import type { PaymentAdapter, PaymentInitiationInput, PaymentInitiationResult, PaymentRefundResult } from './payment.adapter';

abstract class DisabledLocalGatewayAdapter implements PaymentAdapter {
  abstract readonly method: 'JAZZCASH' | 'EASYPAISA';
  protected abstract readonly flagKey: string;
  protected abstract hasMerchantCredentials(): boolean;
  protected abstract providerName: string;

  async assertAvailable(): Promise<void> {
    const flag = await prisma.platformConfig.findUnique({ where: { configKey: this.flagKey }, select: { value: true } });
    if (flag?.value !== true || !this.hasMerchantCredentials()) {
      throw new PaymentGatewayUnavailableError(`${this.providerName} is disabled or merchant credentials are missing.`);
    }
    throw new PaymentGatewayUnavailableError(`${this.providerName} live protocol is not implemented; no transaction was started.`);
  }

  async initiate(_input: PaymentInitiationInput, _idempotencyKey: string): Promise<PaymentInitiationResult> {
    await this.assertAvailable();
    throw new PaymentGatewayUnavailableError(`${this.providerName} is unavailable.`);
  }

  async confirm(_paymentReference: string, _confirmation?: unknown): Promise<PaymentStatus> {
    await this.assertAvailable();
    return 'PENDING';
  }

  async refund(
    _paymentReference: string,
    _amountPkr: string,
    _originalAmountPkr: string,
    _idempotencyKey: string,
  ): Promise<PaymentRefundResult> {
    await this.assertAvailable();
    throw new PaymentGatewayUnavailableError(`${this.providerName} is unavailable.`);
  }
}

export class JazzCashAdapter extends DisabledLocalGatewayAdapter {
  readonly method = 'JAZZCASH' as const;
  protected readonly flagKey = 'jazzcash_enabled';
  protected readonly providerName = 'JazzCash';
  protected hasMerchantCredentials(): boolean {
    return Boolean(config.jazzCash.merchantId && config.jazzCash.password && config.jazzCash.secretKey);
  }
}

export class EasyPaisaAdapter extends DisabledLocalGatewayAdapter {
  readonly method = 'EASYPAISA' as const;
  protected readonly flagKey = 'easypaisa_enabled';
  protected readonly providerName = 'EasyPaisa';
  protected hasMerchantCredentials(): boolean {
    return Boolean(config.easyPaisa.storeId && config.easyPaisa.hashKey);
  }
}
