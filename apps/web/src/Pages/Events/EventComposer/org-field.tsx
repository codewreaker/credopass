import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import { useOrganizationStore } from '@credopass/lib/stores';
import type { Organization } from '@credopass/lib/schemas';
import { Building2, CheckIcon, ChevronDown } from 'lucide-react';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';

/**
 * Pill that picks which organization the event belongs to. Deliberately local
 * to the form — it does not switch the app-wide active organization.
 *
 * When no org is chosen yet (a fresh create), it defaults to the app's active
 * organization — or the first available — so the event is pre-scoped to the org
 * the user is working in, unless they pick another.
 */
export function OrgField({ value, onChange }: { value: string; onChange: (organizationId: string) => void }) {
  const [open, setOpen] = useState(false);
  const { organizations: organizationCollection } = getCollections();
  const orgsQuery = useLiveQuery((query) => query.from({ organizationCollection }));
  const organizations = useMemo(() => (orgsQuery.data ?? []) as Organization[], [orgsQuery.data]);
  const activeOrganizationId = useOrganizationStore((s) => s.activeOrganizationId);
  const current = organizations.find((org) => org.id === value);

  // Seed the default once orgs are available and nothing is selected.
  useEffect(() => {
    if (value || organizations.length === 0) return;
    const preferred =
      activeOrganizationId && organizations.some((o) => o.id === activeOrganizationId)
        ? activeOrganizationId
        : organizations[0].id;
    onChange(preferred);
  }, [value, organizations, activeOrganizationId, onChange]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-primary-foreground/20"
      >
        <Building2 size={13} />
        <span className="max-w-40 truncate">{current?.name ?? 'Select organization'}</span>
        <ChevronDown size={13} className="opacity-70" />
      </button>

      <SheetDialog open={open} onOpenChange={setOpen} title="Organization" contentClassName="px-2 pb-3">
        <div className="flex flex-col">
          {organizations.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No organizations yet.</p>
          )}
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => {
                onChange(org.id);
                setOpen(false);
              }}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-muted/50"
            >
              <span className="truncate">{org.name}</span>
              {org.id === value && <CheckIcon size={16} className="shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      </SheetDialog>
    </>
  );
}
