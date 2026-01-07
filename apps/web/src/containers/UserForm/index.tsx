/* eslint-disable no-useless-escape */
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import * as z from 'zod';
import {
  UserPlus,
  Mail,
  Phone,
  User as UserIcon,
  Trash2,
  Sparkles
} from 'lucide-react';
import { userCollection } from '@dwellpass/tanstack-db';
import { Button, Input, Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@dwellpass/ui';
import type { LauncherState } from '../../stores/store';
import './style.css';


// Modal form data type - exported for type safety
export interface UserFormData {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface UserFormProps {
  initialData?: Partial<UserFormData>;
  isEditing?: boolean;
  onClose?: () => void;
}

// Zod validation schema
const userFormSchema = z.object({
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters.')
    .max(50, 'First name must be at most 50 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes.'),
  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters.')
    .max(50, 'Last name must be at most 50 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes.'),
  email: z.string()
    .email('Please enter a valid email address.')
    .min(5, 'Email must be at least 5 characters.')
    .max(100, 'Email must be at most 100 characters.'),
  phone: z.string()
    .regex(/^[\d\s\-\+\(\)]+$/, 'Phone number can only contain numbers, spaces, hyphens, and parentheses.')
    .min(10, 'Phone number must be at least 10 characters.')
    .or(z.literal(''))
    .default(''),
});

export const launchUserForm = (
  args: UserFormProps = {},
  openLauncher: (args: Omit<LauncherState, "isOpen">) => void
) => {
  openLauncher({
    content: <UserForm {...args} />,
  });
};

// User Form Component
const UserForm = ({ initialData = {}, isEditing = false, onClose }: UserFormProps) => {
  const [isMutating, setIsMutating] = useState(false);

  const form = useForm({
    defaultValues: {
      firstName: initialData.firstName || '',
      lastName: initialData.lastName || '',
      email: initialData.email || '',
      phone: initialData.phone || '',
    },
    validators: {
      onChange: ({ value }) => {
        const result = userFormSchema.safeParse(value);
        if (!result.success) {
          return result.error.flatten().fieldErrors;
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setIsMutating(true);
      const now = new Date();
      const userData = {
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        phone: value.phone || null,
      };

      try {
        if (isEditing && initialData.id) {
          userCollection?.update(initialData.id, (draft) => {
            draft.firstName = userData.firstName;
            draft.lastName = userData.lastName;
            draft.email = userData.email;
            draft.phone = userData.phone;
            draft.updatedAt = now;
          });
        } else {
          userCollection?.insert({
            ...userData,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          });
        }
        onClose?.();
      } catch (error) {
        console.error('Failed to save user:', error);
      } finally {
        setIsMutating(false);
      }
    },
  });

  const handleDelete = async () => {
    if (initialData.id && confirm('Are you sure you want to delete this user?')) {
      setIsMutating(true);
      try {
        userCollection?.delete(initialData.id);
        onClose?.();
      } catch (error) {
        console.error('Failed to delete user:', error);
      } finally {
        setIsMutating(false);
      }
    }
  };

  return (
    <div className="user-modal">
      <div className="modal-header">
        <div className="header-icon">
          <UserPlus size={24} />
        </div>
        <div className="header-text">
          <h2>{isEditing ? 'Edit Attendee' : 'Register New Attendee'}</h2>
          <p>{isEditing ? 'Update attendee information' : 'Add a new community member to your events'}</p>
        </div>
      </div>

      <div className="modal-body">
        <form 
          className="user-form" 
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          {/* Welcome Message for New Users */}
          {!isEditing && (
            <div className="welcome-banner">
              <Sparkles size={16} />
              <span>Welcome! Let's get you registered for our community events</span>
            </div>
          )}

          <FieldGroup>
            {/* First Name & Last Name */}
            <div className="form-row">
              <form.Field
                name="firstName"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid} className="form-group">
                      <FieldLabel htmlFor={field.name} className="form-label">
                        <UserIcon size={14} />
                        First Name
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="text"
                        placeholder="John"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <form.Field
                name="lastName"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid} className="form-group">
                      <FieldLabel htmlFor={field.name} className="form-label">
                        <UserIcon size={14} />
                        Last Name
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="text"
                        placeholder="Doe"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
            </div>

            {/* Email */}
            <form.Field
              name="email"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-field-wrapper">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <Mail size={14} />
                      Email Address
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      placeholder="john.doe@example.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription className="field-hint">
                      We'll use this to send you event updates
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            {/* Phone Number */}
            <form.Field
              name="phone"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-field-wrapper">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <Phone size={14} />
                      Phone Number
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription className="field-hint">
                      Optional - For important event notifications
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
          </FieldGroup>

          {/* Info Box */}
          {!isEditing && (
            <div className="info-box">
              <div className="info-icon">ℹ️</div>
              <div className="info-text">
                <strong>What happens next?</strong>
                <p>You'll be added to our community and can start attending events immediately. Track your attendance and earn loyalty rewards!</p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isMutating}
              >
                <Trash2 size={14} />
                Delete
              </Button>
            )}
            <div className="actions-right">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isMutating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={isMutating}
              >
                {!isMutating && <UserPlus size={14} />}
                {isMutating ? 'Saving...' : isEditing ? 'Update Attendee' : 'Register Attendee'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;