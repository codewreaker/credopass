import { useForm } from '@tanstack/react-form';
import * as z from 'zod';
import { Button, Input, FieldError, FieldLabel, Field } from '@credopass/ui';
import { UserPlus, Mail, User as UserIcon } from 'lucide-react';
import type { User } from '@credopass/lib/schemas';

interface ManualSignInFormProps {
  onSubmit: (userData: Partial<User>) => void;
  onBack: () => void;
}

const manualSignInSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters.')
    .max(50, 'First name must be at most 50 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters.'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters.')
    .max(50, 'Last name must be at most 50 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters.'),
  email: z
    .string()
    .email('Please enter a valid email address.')
    .min(5, 'Email must be at least 5 characters.'),
});

const ManualSignInForm: React.FC<ManualSignInFormProps> = ({ onSubmit, onBack }) => {
  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
    },
    validators: {
      onChange: ({ value }) => {
        const result = manualSignInSchema.safeParse(value);
        if (!result.success) {
          return result.error.flatten().fieldErrors;
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      try {
        onSubmit({
          firstName: value.firstName,
          lastName: value.lastName,
          email: value.email,
        });

        form.reset();
      } catch (error) {
        console.error('Sign-in failed:', error);
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <form.Field
          name="firstName"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="firstName" className="flex items-center gap-1.5 text-sm">
                  <UserIcon className="w-3.5 h-3.5" />
                  First Name
                </FieldLabel>
                <Input
                  id="firstName"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="John"
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError>{field.state.meta.errors[0]}</FieldError>}
              </Field>
            );
          }}
        />

        <form.Field
          name="lastName"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="lastName" className="flex items-center gap-1.5 text-sm">
                  <UserIcon className="w-3.5 h-3.5" />
                  Last Name
                </FieldLabel>
                <Input
                  id="lastName"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Doe"
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError>{field.state.meta.errors[0]}</FieldError>}
              </Field>
            );
          }}
        />
      </div>

      <form.Field
        name="email"
        children={(field) => {
          const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor="email" className="flex items-center gap-1.5 text-sm">
                <Mail className="w-3.5 h-3.5" />
                Email Address
              </FieldLabel>
              <Input
                id="email"
                name={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="john@example.com"
                aria-invalid={isInvalid}
              />
              {isInvalid && <FieldError>{field.state.meta.errors[0]}</FieldError>}
            </Field>
          );
        }}
      />

      <Button
        type="submit"
        className="w-full gap-2"
        size="lg"
        disabled={form.state.isSubmitting}
      >
        <UserPlus className="w-4 h-4" />
        {form.state.isSubmitting ? 'Checking In...' : 'Check In Attendee'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onBack}
        className="w-full"
      >
        Qr Code
      </Button>
    </form>
  );
};

export default ManualSignInForm;
