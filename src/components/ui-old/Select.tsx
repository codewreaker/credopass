import React from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { ChevronDown, Check } from 'lucide-react';
import './select.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

/**
 * Select Component using Base UI
 * 
 * A styled select dropdown that maintains the application's design system.
 * Supports options with labels, placeholders, and disabled states.
 */
export const Select: React.FC<SelectProps> = ({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Select...',
  label,
  disabled = false,
  className = '',
  name,
}) => {
  return (
    <div className={`select-field ${className}`}>
      {label && <label className="form-label">{label}</label>}
      <BaseSelect.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
      >
        <BaseSelect.Trigger className="select-trigger">
          <BaseSelect.Value>
            {(displayValue) => displayValue ?? placeholder}
          </BaseSelect.Value>
          <BaseSelect.Icon className="select-icon">
            <ChevronDown size={14} />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
        <BaseSelect.Portal>
          <BaseSelect.Positioner className="select-positioner" sideOffset={4} alignItemWithTrigger={false}>
            <BaseSelect.Popup className="select-popup">
              <BaseSelect.List>
                {options.map((option) => (
                  <BaseSelect.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className="select-item"
                  >
                    <BaseSelect.ItemIndicator className="select-item-indicator">
                      <Check size={14} />
                    </BaseSelect.ItemIndicator>
                    <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                  </BaseSelect.Item>
                ))}
              </BaseSelect.List>
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    </div>
  );
};

export default Select;
