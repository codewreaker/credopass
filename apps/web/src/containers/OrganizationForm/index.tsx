import { useCallback, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { toast } from '@credopass/ui/components/sonner';
import * as z from 'zod';
import {
  Building2,
  Link,
  Crown,
  Trash2
} from 'lucide-react';
import { getCollections } from '@credopass/api-client/collections';
import type { OrgPlan } from '@credopass/lib/schemas';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@credopass/ui/components/field';
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@credopass/ui/components/dialog';
import { handleCollectionDeleteById } from '@credopass/api-client/collections';
import './style.css';
import type { LauncherState } from '@credopass/lib/stores';

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
      };

      try {
        let tx;

        if (isEditing && initialData.id) {
          tx = organizationCollection.update(initialData.id, (draft) => {
            draft.name = organizationData.name;
            draft.slug = organizationData.slug;
            draft.updatedAt = now;
          });
        } else {
          tx = organizationCollection.insert({
            ...organizationData,
            // New organizations always start on the free plan; upgrades go
            // through billing, never through this form (server enforces it).
            plan: 'free' as OrgPlan,
            id: crypto.randomUUID(),
            externalAuthEndpoint: null,
            externalAuthApiKey: null,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
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

  const handleDelete = useCallback(() => {
    if (initialData.id) {
      handleCollectionDeleteById('organizations', initialData.id, onClose)
    }
  }, [initialData.id, onClose]);

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

            {/* Plan is read-only here: upgrades happen through billing */}
            <Field className="form-group full-width">
              <FieldLabel className="form-label">
                <Crown size={14} />
                Plan
              </FieldLabel>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm capitalize">
                {initialData.plan || 'free'}
              </div>
              <FieldDescription>
                Plan changes are handled through billing, not editable here.
              </FieldDescription>
            </Field>
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
