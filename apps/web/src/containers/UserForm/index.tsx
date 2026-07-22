/* eslint-disable no-useless-escape */
import { useState, useCallback } from 'react';
import { useForm } from '@tanstack/react-form';
import * as z from 'zod';
import {
  UserPlus,
  Mail,
  Phone,
  User as UserIcon,
  Trash2,
  Star,
  ScanLine,
  CalendarHeart,
  XIcon
} from 'lucide-react';
import { getCollections } from '@credopass/api-client/collections';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { Field, FieldError, FieldGroup, FieldLabel } from '@credopass/ui/components/field';
import { DialogClose, DialogHeader, DialogTitle } from '@credopass/ui/components/dialog';
import type { LauncherState } from '@credopass/lib/stores';
import { handleCollectionDeleteById } from '@credopass/api-client/collections';

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
  openLauncher: (args: Omit<LauncherState, "isOpen">) => void,
  closeLauncher?: () => void
) => {
  openLauncher({
    content: <UserForm {...args} onClose={closeLauncher} />,
  });
};

const PERKS = [
  { icon: ScanLine, label: 'QR check-in' },
  { icon: Star, label: 'Earn points' },
  { icon: CalendarHeart, label: 'Event invites' },
] as const;

// User Form Component
const UserForm = ({ initialData = {}, isEditing = false, onClose }: UserFormProps) => {
  const [isMutating, setIsMutating] = useState(false);
  const { users: userCollection } = getCollections();

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
        alert('An error occurred while saving the user. Please try again.');
        console.error(`Failed to save user: ${(error as Error).message}`);
      } finally {
        setIsMutating(false);
      }
    },
  });


  const handleDelete = useCallback(() => {
    if (initialData.id) {
      handleCollectionDeleteById('users', initialData.id, onClose)
    }
  }, [initialData.id, onClose]);

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {isEditing ? 'Edit member' : 'Add a member'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {isEditing
                ? 'Update this member’s information.'
                : 'They’ll be part of the community in seconds.'}
            </p>
          </div>
          <DialogClose
            render={(props) => (
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground hover:text-foreground shrink-0"
                disabled={isMutating}
                onClick={onClose}
              >
                <XIcon />
              </Button>
            )}
          />
        </div>
      </DialogHeader>

      {/* Live membership-card preview — fills in as they type */}
      <form.Subscribe selector={(state) => state.values}>
        {(values) => {
          const initials = `${values.firstName?.charAt(0) || ''}${values.lastName?.charAt(0) || ''}`.toUpperCase();
          const fullName = `${values.firstName || ''} ${values.lastName || ''}`.trim();
          return (
            <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-4 flex items-center gap-3.5">
              <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full border-[10px] border-primary-foreground/8" />
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-foreground text-primary text-sm font-bold relative z-10">
                {initials || <UserPlus size={16} />}
              </div>
              <div className="min-w-0 flex-1 relative z-10">
                <p className="text-sm font-semibold truncate">{fullName || 'New member'}</p>
                <p className="text-xs text-primary-foreground/65 truncate">{values.email || 'their@email.com'}</p>
              </div>
              <span className="relative z-10 shrink-0 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]">
                Bronze · 0 pts
              </span>
            </div>
          );
        }}
      </form.Subscribe>

      <form
        className="user-form"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
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
                      className="h-10 rounded-xl"
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
                      className="h-10 rounded-xl"
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
                    className="h-10 rounded-xl"
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

          {/* Phone Number */}
          <form.Field
            name="phone"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid} className="form-field-wrapper">
                  <FieldLabel htmlFor={field.name} className="form-label">
                    <Phone size={14} />
                    Phone <span className="text-[10px] font-normal text-muted-foreground normal-case">(optional)</span>
                  </FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    className="h-10 rounded-xl"
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
        </FieldGroup>

        {/* Perks strip */}
        {!isEditing && (
          <div className="grid grid-cols-3 gap-2">
            {PERKS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card/60 py-2.5">
                <Icon size={14} className="text-primary" />
                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
              onClick={handleDelete}
              disabled={isMutating}
            >
              <Trash2 size={15} />
            </Button>
          )}
          <Button
            type="submit"
            variant="default"
            disabled={isMutating}
            className="flex-1 h-11 rounded-full font-semibold"
          >
            {!isMutating && <UserPlus size={14} />}
            {isMutating ? 'Saving...' : isEditing ? 'Save changes' : 'Add to community'}
          </Button>
        </div>
      </form>
    </div>
  )
};

export default UserForm;
