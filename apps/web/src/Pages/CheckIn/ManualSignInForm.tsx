import { useForm } from '@tanstack/react-form';
import * as z from 'zod';
import { Button, Input, FieldError, FieldGroup, FieldLabel } from '@credopass/ui';
import { UserPlus } from 'lucide-react';
import type { User } from '@credopass/lib/schemas';

interface ManualSignInFormProps {
  onSubmit: (userData: Partial<User>) => void;
}

const manualSignInSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters.')
    .max(50, 'First name must be at most 50 characters.'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters.')
    .max(50, 'Last name must be at most 50 characters.'),
  email: z
    .string()
    .email('Please enter a valid email address.')
    .min(5, 'Email must be at least 5 characters.'),
});

const ManualSignInForm: React.FC<ManualSignInFormProps> = ({ onSubmit }) => {
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
      <form.Field
        name="firstName"
        children={(field) => (
          <FieldGroup>
            <FieldLabel htmlFor="firstName">First Name</FieldLabel>
            <Input
              id="firstName"
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="John"
            />
            <FieldError>{field.state.meta.errors[0]}</FieldError>
          </FieldGroup>
        )}
      />

      <form.Field
        name="lastName"
        children={(field) => (
          <FieldGroup>
            <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
            <Input
              id="lastName"
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Doe"
            />
            <FieldError>{field.state.meta.errors[0]}</FieldError>
          </FieldGroup>
        )}
      />

      <form.Field
        name="email"
        children={(field) => (
          <FieldGroup>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="john@example.com"
            />
            <FieldError>{field.state.meta.errors[0]}</FieldError>
          </FieldGroup>
        )}
      />

      <Button
        type="submit"
        className="w-full"
        disabled={form.state.isSubmitting}
      >
        <UserPlus className="w-4 h-4 mr-2" />
        {form.state.isSubmitting ? 'Checking In...' : 'Check In'}
      </Button>
    </form>
  );
};

export default ManualSignInForm;
