import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';
import * as z from 'zod';
import {
  Building2,
  Link,
  Crown,
  Trash2
} from 'lucide-react';
import { getCollections } from '../../lib/tanstack-db';
import type { OrgPlan } from '@credopass/lib/schemas';
import {
  Button,
  Input,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@credopass/ui';
import './style.css';
import type { LauncherState } from '../../stores/store';

// Modal form data type
export interface OrganizationFormData {
  id?: string;
  name: string;
  slug: string;
  plan: OrgPlan;
}

export interface OrganizationFormProps {
  initialData?: Partial<OrganizationFormData>;
  isEditing?: boolean;
  onClose?: () => void;
}

// Plan options for the select
const planOptions = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

// Generate a slug from the name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
};

// Zod validation schema
const organizationFormSchema = z.object({
  name: z.string()
    .min(2, 'Organization name must be at least 2 characters.')
    .max(100, 'Organization name must be at most 100 characters.'),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters.')
    .max(50, 'Slug must be at most 50 characters.')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens.'),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise'] as const),
});

export const launchOrganizationForm = (
  args: Omit<OrganizationFormProps, 'collection'> = {},
  openLauncher: (args: Omit<LauncherState, "isOpen">) => void
) => {
  openLauncher({
    content: <OrganizationForm {...args} />,
  });
};

const { organizations: organizationCollection } = getCollections();

// Organization Form Component
const OrganizationForm = ({ initialData = {}, isEditing = false, onClose }: OrganizationFormProps) => {
  const [isMutating, setIsMutating] = useState(false);

  const form = useForm({
    defaultValues: {
      name: initialData.name || '',
      slug: initialData.slug || '',
      plan: (initialData.plan || 'free') as OrganizationPlan,
    },
    validators: {
      //@ts-ignore
      onChange: organizationFormSchema,
    },
    onSubmit: async ({ value }) => {
      setIsMutating(true);
      const now = new Date();
      const organizationData = {
        name: value.name,
        slug: value.slug,
        plan: value.plan,
      };

      try {
        let tx;

        if (isEditing && initialData.id) {
          tx = organizationCollection.update(initialData.id, (draft) => {
            draft.name = organizationData.name;
            draft.slug = organizationData.slug;
            draft.plan = organizationData.plan;
            draft.updatedAt = now;
          });
        } else {
          tx = organizationCollection.insert({
            ...organizationData,
            id: crypto.randomUUID(),
            externalAuthEndpoint: null,
            stripeCustomerId: null,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          });
        }

        await tx.isPersisted.promise;
        toast.success(isEditing ? 'Organization updated!' : 'Organization created!');
        onClose?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'An unexpected error occurred.');
      } finally {
        setIsMutating(false);
      }
    },
  });

  const handleDelete = async () => {
    if (initialData.id && confirm('Are you sure you want to delete this organization? This cannot be undone.')) {
      setIsMutating(true);
      try {
        organizationCollection?.delete(initialData.id);
        toast.success('Organization deleted');
        onClose?.();
      } catch (error) {
        console.error('Failed to delete organization:', error);
        toast.error('Failed to delete organization');
      } finally {
        setIsMutating(false);
      }
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Organization' : 'New Organization'}</DialogTitle>
        <DialogDescription>
          {isEditing ? 'Update organization details' : 'Create a new organization to manage events and members'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <form
          className="organization-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            {/* Organization Name */}
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-group full-width">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <Building2 size={14} />
                      Organization Name
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      placeholder="Enter organization name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                        // Auto-generate slug if not editing and slug hasn't been manually changed
                        if (!isEditing && !form.getFieldValue('slug')) {
                          form.setFieldValue('slug', generateSlug(e.target.value));
                        }
                      }}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            {/* Slug */}
            <form.Field
              name="slug"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-group full-width">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <Link size={14} />
                      URL Slug
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      placeholder="organization-slug"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value.toLowerCase())}
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription>
                      Used in URLs: credopass.com/org/{field.state.value || 'your-slug'}
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            {/* Plan */}
            <form.Field
              name="plan"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-group full-width">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <Crown size={14} />
                      Plan
                    </FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as OrganizationPlan)}
                    >
                      <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {planOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {field.state.value === 'free' && 'Free tier with basic features'}
                      {field.state.value === 'starter' && 'Starter tier with extended limits'}
                      {field.state.value === 'pro' && 'Pro tier with analytics and advanced features'}
                      {field.state.value === 'enterprise' && 'Enterprise tier with custom integrations'}
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
          </FieldGroup>

          <DialogFooter>
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isMutating}
              >
                <Trash2 size={14} />
              </Button>
            )}
            <DialogClose>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isMutating}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="default"
              disabled={isMutating}
            >
              {isMutating ? 'Saving...' : isEditing ? 'Update' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </div>
    </>
  );
};

export default OrganizationForm;
