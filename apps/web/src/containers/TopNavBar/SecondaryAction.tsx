import React, { useLayoutEffect, useRef, useState } from 'react';
import { useToolbarStore } from '../../stores/toolbar-store';
import { cn } from '@credopass/ui/lib/utils';

/**
 * SecondaryActionButton – a context-aware button that sits next to the Plus
 * button in the top toolbar.  The icon animates (scale + fade) whenever the
 * page context changes.
 *
 * Follows:
 *  - rendering-conditional-render: ternary, not &&
 *  - rerender-derived-state: subscribes only to `action`
 */
const SecondaryActionButton: React.FC = () => {
  const action = useToolbarStore((s) => s.action);

  // Track the previous label to trigger the enter animation via key change
  const [animKey, setAnimKey] = useState(0);
  const prevLabelRef = useRef(action?.label);

  useLayoutEffect(() => {
    if (action?.label !== prevLabelRef.current) {
      prevLabelRef.current = action?.label;
      setAnimKey((k) => k + 1);
    }
  }, [action?.label]);

  if (!action) return null;

  const Icon = action.icon;

  return (
    <button
      key={animKey}
      type="button"
      className={cn('toolbar-secondary-btn')}
      onClick={action.onClick}
      aria-label={action.label}
      title={action.label}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
};

export default SecondaryActionButton;
