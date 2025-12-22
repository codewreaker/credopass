import React, { useId } from 'react';
import { Field } from '@base-ui/react/field';
import './input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Input Component using Base UI Field
 * 
 * A styled input component that integrates with Base UI's Field for validation.
 * Supports icons, error states, and full-width layouts.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      rightElement,
      fullWidth = true,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;

    return (
      <Field.Root className={`form-field ${fullWidth ? 'full-width' : ''} ${className}`}>
        {label && (
          <Field.Label htmlFor={inputId} className="form-label">
            {label}
          </Field.Label>
        )}
        <div className={`input-wrapper ${error ? 'has-error' : ''}`}>
          {leftIcon && <span className="input-icon input-icon-left">{leftIcon}</span>}
          <Field.Control
            ref={ref}
            id={inputId}
            className={`form-input ${leftIcon ? 'has-left-icon' : ''} ${rightIcon || rightElement ? 'has-right-icon' : ''}`}
            {...props}
          />
          {rightIcon && <span className="input-icon input-icon-right">{rightIcon}</span>}
          {rightElement && <span className="input-element-right">{rightElement}</span>}
        </div>
        {error && (
          <Field.Error className="form-error">
            {error}
          </Field.Error>
        )}
      </Field.Root>
    );
  }
);

Input.displayName = 'Input';

export default Input;
