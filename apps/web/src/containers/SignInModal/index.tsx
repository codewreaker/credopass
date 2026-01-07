import React, { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import * as z from 'zod';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { 
  Button, 
  Input, 
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel
} from '@dwellpass/ui';
import type { LauncherState } from '../../stores/store';
import './style.css';

interface SignInFormProps {
  onClose?: () => void;
}

// Zod validation schemas
const signInSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address.')
    .min(5, 'Email must be at least 5 characters.'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters.')
    .max(100, 'Password must be at most 100 characters.'),
});

const signUpSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must be at most 100 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes.'),
  email: z.string()
    .email('Please enter a valid email address.')
    .min(5, 'Email must be at least 5 characters.'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .max(100, 'Password must be at most 100 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
});

export const launchSignInForm = (
  args: SignInFormProps = {},
  openLauncher: (args: Omit<LauncherState, "isOpen">) => void
) => {
  openLauncher({
    content: <SignInForm {...args} />,
  });
};

// The actual SignIn form component with all the logic
const SignInForm: React.FC<SignInFormProps> = ({ onClose }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Create separate form instances for sign in and sign up
  const signInForm = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value }) => {
      console.log('Sign in submitted:', value);
      onClose?.();
    },
  });

  const signUpForm = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
    validators: {
      onSubmit: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      console.log('Sign up submitted:', value);
      onClose?.();
    },
  });

  // Use the appropriate form based on mode
  const activeForm = isSignUp ? signUpForm : signInForm;
  const FormField = activeForm.Field as any;

  const PasswordToggleButton = (
    <button
      type="button"
      className="password-toggle"
      onClick={() => setShowPassword(!showPassword)}
    >
      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );

  return (
    <div className="signin-modal-content">
      <div className="modal-header">
        <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        <p>{isSignUp ? 'Sign up to get started' : 'Sign in to your account'}</p>
      </div>

      <div className="modal-body">
        <form 
          className="signin-form" 
          onSubmit={(e) => {
            e.preventDefault();
            activeForm.handleSubmit();
          }}
        >
          <FieldGroup>
            {isSignUp && (
              <FormField name="name">
                {(field: any) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid} className="form-group">
                      <FieldLabel htmlFor={field.name} className="form-label">
                        <User size={14} />
                        Full Name
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="text"
                        placeholder="Enter your name"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </FormField>
            )}

            <FormField name="email">
              {(field: any) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-group">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <Mail size={14} />
                      Email Address
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      placeholder="Enter your email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </FormField>

            <FormField name="password">
              {(field: any) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-group">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <Lock size={14} />
                      Password
                    </FieldLabel>
                    <div className="input-wrapper has-right-element">
                      <Input
                        id={field.name}
                        name={field.name}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {PasswordToggleButton}
                    </div>
                    {isSignUp && (
                      <FieldDescription>
                        Must be at least 8 characters with uppercase, lowercase, and a number
                      </FieldDescription>
                    )}
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </FormField>
          </FieldGroup>

          <Button type="submit" variant="default" className="signin-button">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="signin-footer">
          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              className="toggle-mode"
              onClick={() => {
                setIsSignUp(!isSignUp);
                // Reset forms when switching modes
                signInForm.reset();
                signUpForm.reset();
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
