import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AiMark } from '../../components';

type Phase = 'reading' | 'writingEn' | 'writingUr' | 'ready';

const TYPE_MS = 34;
const READ_MS = 1300;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// The /sell hero's signature moment: the AI Store Builder's mechanism, dramatised. A product photo
// is "read" (a brass scan sweeps it), then the English and Urdu titles type themselves in, the
// tags settle, and the listing lands in a "ready for you to check" state — with the price left
// for the seller, exactly as in the real flow. Labelled "Example listing"; the content is a
// sample, not a real product. Reduced motion shows the finished listing immediately; Replay
// restarts the sequence. Status changes are announced politely for screen readers.
export function AiListingDemo() {
  const { t } = useTranslation('marketplace');
  const fullEn = t('sell.demo.titleEn');
  const fullUr = t('sell.demo.titleUr');
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'ready' : 'reading'));
  const [en, setEn] = useState(() => (prefersReducedMotion() ? fullEn : ''));
  const [ur, setUr] = useState(() => (prefersReducedMotion() ? fullUr : ''));
  const [run, setRun] = useState(0);
  const [seen, setSeen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  // Start only once the card is at least half on screen — on phones it sits below the fold, and
  // the signature moment shouldn't play out before anyone is looking.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('ready');
      setEn(fullEn);
      setUr(fullUr);
      return;
    }
    if (!seen) return;
    clear();
    setPhase('reading');
    setEn('');
    setUr('');
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

    let clock = READ_MS;
    at(clock, () => setPhase('writingEn'));
    for (let i = 1; i <= fullEn.length; i++) {
      clock += TYPE_MS;
      at(clock, () => setEn(fullEn.slice(0, i)));
    }
    clock += 280;
    at(clock, () => setPhase('writingUr'));
    for (let i = 1; i <= fullUr.length; i++) {
      clock += TYPE_MS;
      at(clock, () => setUr(fullUr.slice(0, i)));
    }
    clock += 380;
    at(clock, () => setPhase('ready'));
    return clear;
  }, [run, seen, fullEn, fullUr]);

  const replay = useCallback(() => setRun((n) => n + 1), []);
  const ready = phase === 'ready';

  return (
    <div className="ai-demo" data-phase={phase} ref={rootRef}>
      <div className="ai-demo__bar">
        <span className="ai-demo__label">{t('sell.demo.label')}</span>
        <button type="button" className="ai-demo__replay" onClick={replay} disabled={!ready}>
          <RotateCcw size={14} aria-hidden="true" />
          {t('sell.demo.replay')}
        </button>
      </div>

      <div className="ai-demo__body">
        <div className="ai-demo__photo">
          <img src="/demo/products/fashion-clothing.svg" alt="" width={400} height={500} />
          <span className="ai-demo__scan" aria-hidden="true" />
        </div>

        <div className="ai-demo__fields">
          <p className="ai-demo__status" aria-live="polite">
            <AiMark size={14} color="var(--accent-marigold-strong)" />
            {t(`sell.demo.${phase}`)}
          </p>

          <div className="ai-demo__field">
            <span className="ai-demo__value ai-demo__value--en" lang="en" dir="ltr">
              {en}
              {phase === 'writingEn' && <span className="ai-demo__caret" aria-hidden="true" />}
            </span>
          </div>
          <div className="ai-demo__field">
            <span className="ai-demo__value ai-demo__value--ur" lang="ur" dir="rtl">
              {ur}
              {phase === 'writingUr' && <span className="ai-demo__caret" aria-hidden="true" />}
            </span>
          </div>

          <ul className="ai-demo__tags" aria-hidden={!ready}>
            {(['tag1', 'tag2', 'tag3'] as const).map((key) => (
              <li key={key}>{t(`sell.demo.${key}`)}</li>
            ))}
          </ul>

          <div className="ai-demo__row">
            <span className="ai-demo__chip">{t('sell.demo.category')}</span>
            <span className="ai-demo__price">
              <span className="ai-demo__price-label">{t('sell.demo.priceLabel')}</span>
              {t('sell.demo.pricePlaceholder')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
