import { useLayoutEffect, useRef, useState } from 'react';

interface UnderlineTabsProps<K extends string> {
  tabs: Array<{ key: K; label: string }>;
  active: K;
  onChange: (key: K) => void;
  label?: string;
}

// Underline tabs with an ink bar that slides to the active tab (profile + settings). Styles live
// in profile.css (pfTabs / pfTab / pfTabInk); the bar is measured so any label length or language fits.
export function UnderlineTabs<K extends string>({ tabs, active, onChange, label }: UnderlineTabsProps<K>) {
  const ref = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<{ left: number; width: number } | null>(null);
  const labels = tabs.map((tab) => tab.label).join('|');

  useLayoutEffect(() => {
    const measure = () => {
      const current = ref.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (current) setInk({ left: current.offsetLeft, width: current.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, labels]);

  return (
    <div className="pfTabs" role="tablist" aria-label={label} ref={ref}>
      {tabs.map((tab) => (
        <button key={tab.key} type="button" role="tab" className="pfTab" aria-selected={active === tab.key} onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
      {ink && <span className="pfTabInk" style={{ left: ink.left, width: ink.width }} aria-hidden="true" />}
    </div>
  );
}
