import { useState, type ReactNode } from 'react';
import { Alert, Button, Input } from 'antd';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, MessageSquareText, PackageX, ScanSearch, ShieldAlert, Undo2,
  type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { ReturnDetailDTO } from '@karobarai/shared';
import { PriceDisplay, ProductThumbnail, SkeletonLoader } from '../../components';
import { getProduct, productQueryKey } from '../catalog/catalogApi';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { PrivateEvidenceImage } from './PrivateEvidenceImage';
import { ReturnImageUploader } from './ReturnImageUploader';
import { createReturn, submitReturn } from './returnsApi';
import { formatReturnsError } from './returnsErrors';
import '../orders/orders.css';
import './returns.css';
import './returnBuyer.css';

const REASON_KEYS = ['WRONG_ITEM', 'DAMAGED', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER'] as const;
type ReasonKey = (typeof REASON_KEYS)[number];
const REASON_ICONS: Record<ReasonKey, LucideIcon> = {
  WRONG_ITEM: PackageX,
  DAMAGED: ShieldAlert,
  NOT_AS_DESCRIBED: ScanSearch,
  CHANGED_MIND: Undo2,
  OTHER: MessageSquareText,
};
const STEP_KEYS = ['item', 'reason', 'photos', 'review'] as const;

// SCR-B10 — the return record is created (Step 1 -> 2, via createReturn) as soon as a reason is
// picked, since POST /returns requires {orderId, reason} together — there's no "empty" return to
// create earlier. That's also the earliest point eligibility (RETURN_WINDOW_CLOSED,
// RETURN_ALREADY_EXISTS) can be checked server-side; Step 0 only picks the item, no call.
// Once the record exists there is no way back to the reason step, so step 2 has no Back.
export function ReturnWizardPage() {
  const { t } = useTranslation(['returns', 'orders', 'common']);
  const navigate = useNavigate();
  const { id: orderId = '' } = useParams<{ id: string }>();

  const [step, setStep] = useState(0);
  const [reasonKey, setReasonKey] = useState<ReasonKey | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [returnRecord, setReturnRecord] = useState<ReturnDetailDTO | null>(null);
  const [blockedError, setBlockedError] = useState<string | null>(null);

  const orderQuery = useQuery({ queryKey: orderQueryKey(orderId), queryFn: () => getOrder(orderId), enabled: !!orderId });
  const order = orderQuery.data;

  // Product photos for the item tiles — the same per-product reads the order detail makes.
  const productQueries = useQueries({
    queries: (order?.items ?? []).map((item) => ({
      queryKey: productQueryKey(item.productId),
      queryFn: () => getProduct(item.productId),
      retry: false,
      staleTime: 5 * 60_000,
    })),
  });
  const imageFor = (index: number) => {
    const images = productQueries[index]?.data?.images ?? [];
    return [...images].sort((a, b) => a.position - b.position)[0]?.url ?? null;
  };

  const eligibleItems = order?.items.filter((item) => item.returnEligible) ?? [];
  const reasonText = reasonKey === 'OTHER' ? otherReason.trim() : reasonKey ? t(`reasons.${reasonKey}`) : '';
  const chosenProductId = selectedProductId || (eligibleItems.length === 1 ? eligibleItems[0]!.productId : '');
  const selectedItemEligible = eligibleItems.some((item) => item.productId === chosenProductId);
  const chosenIndex = order?.items.findIndex((item) => item.productId === chosenProductId) ?? -1;
  const chosenItem = chosenIndex >= 0 ? order?.items[chosenIndex] : undefined;

  const createMutation = useMutation({
    mutationFn: () => createReturn(orderId, reasonKey!, chosenProductId, otherReason.trim()),
    onSuccess: (data) => {
      setReturnRecord(data);
      setBlockedError(null);
      setStep(2);
    },
    onError: (err) => setBlockedError(formatReturnsError(t, err)),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitReturn(returnRecord!.id),
    onSuccess: () => navigate(`/orders/${orderId}/return/${returnRecord!.id}/status`),
    onError: (err) => setBlockedError(formatReturnsError(t, err)),
  });

  const imageCount = returnRecord?.images.length ?? 0;
  const referenceCount = returnRecord?.referenceImages.length ?? 0;
  const requiredCount = referenceCount || 3;

  if (orderQuery.isPending) {
    return (
      <div className="rwPage">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="rwPage">
        <Alert type="error" showIcon message={t('buyerFlow.loadError')} description={formatReturnsError(t, orderQuery.error)}
          action={<Button shape="round" onClick={() => void orderQuery.refetch()}>{t('common:actions.retry')}</Button>} />
      </div>
    );
  }

  let body: ReactNode = null;
  let actions: ReactNode = null;

  if (step === 0) {
    body = (
      <>
        <h2 className="rwStepTitle">{t('buyerFlow.itemTitle')}</h2>
        <p className="rwStepHelp">{t('buyerFlow.itemHelp')}</p>
        <div className="rwItems" role="radiogroup" aria-label={t('buyerFlow.itemTitle')}>
          {order.items.map((item, index) => {
            const selected = item.productId === chosenProductId;
            return (
              <button key={item.productId} type="button" role="radio" aria-checked={selected}
                className="rwItem" disabled={!item.returnEligible}
                onClick={() => setSelectedProductId(item.productId)}>
                <ProductThumbnail src={imageFor(index)} size={64} radius="md" />
                <span className="rwItemMain">
                  <span className="rwItemTitle">{item.titleSnapshot}</span>
                  <span className="rwItemMeta">
                    {item.variantLabel && <span>{item.variantLabel}</span>}
                    <span>{t('buyerFlow.itemQty', { count: item.quantity })}</span>
                    <PriceDisplay amount={Number(item.unitPrice) * item.quantity} size="sm" muted />
                  </span>
                  {!item.returnEligible && <span className="rwItemNote">{t('wizard.itemUnavailable')}</span>}
                </span>
                <span className="rwCheck" aria-hidden="true">{selected && <Check size={14} strokeWidth={3} />}</span>
              </button>
            );
          })}
        </div>
        {eligibleItems.length === 0 && <p className="rwEmptyNote">{t('buyerFlow.noEligible')}</p>}
      </>
    );
    actions = (
      <Button type="primary" shape="round" size="large" disabled={!selectedItemEligible} onClick={() => setStep(1)}>
        {t('wizard.next')}
      </Button>
    );
  }

  if (step === 1) {
    body = (
      <>
        <h2 className="rwStepTitle">{t('buyerFlow.reasonTitle')}</h2>
        <p className="rwStepHelp">{t('buyerFlow.reasonHelp')}</p>
        <div className="rwReasons" role="radiogroup" aria-label={t('wizard.reasonLabel')}>
          {REASON_KEYS.map((key) => {
            const Icon = REASON_ICONS[key];
            const selected = reasonKey === key;
            return (
              <button key={key} type="button" role="radio" aria-checked={selected} className="rwReason"
                onClick={() => setReasonKey(key)}>
                <span className="rwReasonIcon" aria-hidden="true"><Icon size={18} /></span>
                <span className="rwReasonText">
                  <span className="rwReasonLabel">{t(`reasons.${key}`)}</span>
                  <span className="rwReasonHint">{t(`buyerFlow.reasonHints.${key}`)}</span>
                </span>
                <span className="rwCheck" aria-hidden="true">{selected && <Check size={14} strokeWidth={3} />}</span>
              </button>
            );
          })}
        </div>
        {reasonKey === 'OTHER' && (
          <div className="rwOther">
            <label htmlFor="rw-other">{t('wizard.otherReasonLabel')}</label>
            <Input.TextArea id="rw-other" value={otherReason} onChange={(e) => setOtherReason(e.target.value)}
              maxLength={200} showCount rows={3} autoFocus />
          </div>
        )}
      </>
    );
    actions = (
      <>
        <Button shape="round" size="large" onClick={() => setStep(0)}>{t('wizard.back')}</Button>
        <Button type="primary" shape="round" size="large" loading={createMutation.isPending}
          disabled={!reasonText || !selectedItemEligible} onClick={() => createMutation.mutate()}>
          {t('wizard.next')}
        </Button>
      </>
    );
  }

  if (step === 2 && returnRecord) {
    body = (
      <>
        <h2 className="rwStepTitle">{t('buyerFlow.photosTitle')}</h2>
        <p className="rwStepHelp">{t('buyerFlow.photosHelp')}</p>
        {referenceCount === 0 && <Alert type="warning" showIcon message={t('wizard.noListingReference')} className="rwAlert" />}
        <ReturnImageUploader
          returnId={returnRecord.id}
          images={returnRecord.images}
          references={returnRecord.referenceImages}
          maxImages={requiredCount}
          onChange={(images) => setReturnRecord((prev) => (prev ? { ...prev, images } : prev))}
        />
      </>
    );
    actions = (
      <Button type="primary" shape="round" size="large" disabled={imageCount !== requiredCount} onClick={() => setStep(3)}>
        {t('wizard.next')}
      </Button>
    );
  }

  if (step === 3 && returnRecord) {
    body = (
      <>
        <h2 className="rwStepTitle">{t('buyerFlow.reviewTitle')}</h2>
        <dl className="rwSummary">
          <div>
            <dt>{t('buyerFlow.reviewItem')}</dt>
            <dd className="rwSummaryItem">
              <ProductThumbnail src={chosenIndex >= 0 ? imageFor(chosenIndex) : null} size={48} radius="md" />
              <span>{chosenItem?.titleSnapshot}</span>
            </dd>
          </div>
          <div>
            <dt>{t('buyerFlow.reviewReason')}</dt>
            <dd>{reasonKey === 'OTHER' ? `${t('reasons.OTHER')}: ${reasonText}` : reasonText}</dd>
          </div>
          <div>
            <dt>{t('buyerFlow.reviewPhotos')}</dt>
            <dd className="rwSummaryPhotos">
              {returnRecord.images.map((img) => <PrivateEvidenceImage key={img.id} url={img.cdnUrl} size={64} />)}
            </dd>
          </div>
        </dl>
        <div className="rwAfter">
          <h3>{t('buyerFlow.afterTitle')}</h3>
          <ol>
            {referenceCount > 0 && <li>{t('buyerFlow.afterAi')}</li>}
            <li>{t('buyerFlow.afterSeller')}</li>
            <li>{t('buyerFlow.afterPickup')}</li>
          </ol>
        </div>
      </>
    );
    actions = (
      <>
        <Button shape="round" size="large" onClick={() => setStep(2)}>{t('wizard.back')}</Button>
        <Button type="primary" shape="round" size="large" loading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
          {submitMutation.isPending ? t('wizard.submitting') : t('wizard.submit')}
        </Button>
      </>
    );
  }

  return (
    <div className="rwPage">
      <header className="odHead">
        <div>
          <h1 className="odTitle">{t('buyerFlow.wizardTitle')}</h1>
          {order.orderNumber && <p className="odSub">{t('buyerFlow.orderSub', { number: order.orderNumber })}</p>}
        </div>
        <Link to={`/orders/${orderId}`} className="odGhostLink">
          {t('buyerFlow.viewOrder')} <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <ol className="rwSteps">
        {STEP_KEYS.map((key, index) => (
          <li key={key} className="rwStep" aria-current={index === step ? 'step' : undefined}
            data-state={index < step ? 'done' : index === step ? 'current' : 'upcoming'}>
            <span className="rwStepDot">{index < step ? <Check size={13} strokeWidth={3} /> : index + 1}</span>
            <span className="rwStepLabel">{t(`buyerFlow.steps.${key}`)}</span>
          </li>
        ))}
      </ol>

      {blockedError && (
        <Alert type="error" showIcon message={t('wizard.blockedTitle')} description={blockedError} className="rwAlert" />
      )}

      <section className="rwCard" key={step}>{body}</section>

      <div className="rwBar">{actions}</div>
    </div>
  );
}
