import * as React from 'react';
import { cn } from '../lib/utils';
import { Badge } from './badge';

export interface ChipFilterOption<T extends string | boolean = string> {
  value: T;
  label?: string;
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

export const divider: ChipFilterOption<'divider'> = {
  value: 'divider'
};


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
      className={cn('flex flex-nowrap items-center gap-2', className)}
      role="radiogroup"
      aria-orientation="horizontal"
    >
      {options.map((option, idx) => {
        const selected = isSelected(option.value);
        return option.value === 'divider' ? <div
          key={`divider-${idx}`}
          className="h-6 w-px bg-border"
          role="separator"
          aria-orientation="vertical"
        /> : (
          <Badge
            key={`${option.value}-${option.label ?? React.useId}`}
            render={<button type="button" />}
            variant={selected ? 'default' : 'secondary'}
            role={mode === 'multiple' ? 'checkbox' : 'radio'}
            aria-checked={selected}
            onClick={() => handleClick(option.value)}
            className={cn(
              'h-auto cursor-pointer bg-secondary text-forground px-1.5 md:px-2.5 py-1.5',
              selected
                ? cn('border-primary bg-primary/15', activeChipClassName)
                : chipClassName
            )}
          >
            {option.icon && option.icon}
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
          </Badge>
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
