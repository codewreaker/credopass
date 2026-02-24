import * as React from 'react';
import { cn } from '../lib/utils';

export interface ChipFilterOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface ChipFilterProps<T extends string = string> {
  options: ChipFilterOption<T>[];
  value?: T | T[];
  defaultValue?: T | T[];
  onValueChange?: (value: T | T[]) => void;
  mode?: 'single' | 'multiple';
  className?: string;
  chipClassName?: string;
  activeChipClassName?: string;
}

function ChipFilterBase<T extends string = string>(
  {
    options,
    value: controlledValue,
    defaultValue,
    onValueChange,
    mode = 'single',
    className,
    chipClassName,
    activeChipClassName,
  }: ChipFilterProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const [internalValue, setInternalValue] = React.useState<T | T[]>(
    defaultValue ?? (mode === 'multiple' ? [] : ('' as T))
  );

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const isSelected = React.useCallback(
    (optionValue: T) => {
      if (mode === 'multiple') {
        return Array.isArray(value) && value.includes(optionValue);
      }
      return value === optionValue;
    },
    [value, mode]
  );

  const handleClick = React.useCallback(
    (optionValue: T) => {
      let newValue: T | T[];

      if (mode === 'multiple') {
        const currentArray = (Array.isArray(value) ? value : []) as T[];
        if (currentArray.includes(optionValue)) {
          newValue = currentArray.filter((v) => v !== optionValue);
        } else {
          newValue = [...currentArray, optionValue];
        }
      } else {
        newValue = optionValue;
      }

      setInternalValue(newValue);
      onValueChange?.(newValue);
    },
    [value, mode, onValueChange]
  );

  return (
    <div
      ref={ref}
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="radiogroup"
      aria-orientation="horizontal"
    >
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role={mode === 'multiple' ? 'checkbox' : 'radio'}
            aria-checked={selected}
            onClick={() => handleClick(option.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all',
              'hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              selected
                ? cn(
                    'bg-foreground text-background shadow-sm',
                    activeChipClassName
                  )
                : cn(
                    'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                    chipClassName
                  )
            )}
          >
            {option.icon && (
              <span className="inline-flex shrink-0">{option.icon}</span>
            )}
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                  selected
                    ? 'bg-background/20 text-background'
                    : 'bg-foreground/10 text-foreground'
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const ChipFilter = React.forwardRef(ChipFilterBase) as <
  T extends string = string
>(
  props: ChipFilterProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof ChipFilterBase>;
