import type { ReactNode } from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface BilingualFieldProps {
  enLabel: ReactNode;
  urLabel: ReactNode;
  enField: ReactNode;
  urField: ReactNode;
}

// UIUX §33 names this component explicitly ("a thin in-house component set... BilingualField").
// §14: "Bilingual fields (Store Builder) show EN and UR in a paired layout, each independently
// editable, each labelled by script." The connector icon is a small, literal expression of the
// brand's own stated signature (§0: "the EN ⇄ اردو duality") — decorative/aria-hidden, and hidden
// on narrow screens where the pair stacks instead of sitting side by side.
export function BilingualField({ enLabel, urLabel, enField, urField }: BilingualFieldProps) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 240px' }}>
        <label>{enLabel}</label>
        {enField}
      </div>
      <ArrowLeftRight
        size={16}
        aria-hidden="true"
        className="karobarai-bilingual-connector"
        style={{ color: 'var(--text-disabled)', marginTop: 'var(--sp-10)', flexShrink: 0 }}
      />
      <div style={{ flex: '1 1 240px' }}>
        <label>{urLabel}</label>
        {urField}
      </div>
    </div>
  );
}
