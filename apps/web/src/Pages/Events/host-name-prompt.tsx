import { Building2, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { isGeneratedOrganizationName } from '@credopass/lib/schemas/organization-name';
import { Button } from '@credopass/ui/components/button';
import { useActiveOrganizationName } from '../../contexts/session';

const DISMISSED_KEY = 'credopass:host-name-prompt-dismissed';

/**
 * "Your events are going out under a name you did not choose."
 *
 * **Why this exists instead of hiding the name.** `organizations.name` is
 * published — it is on the public event page and on every attendee's pass —
 * and it should be: somebody deciding whether to turn up wants to know who is
 * running the event. For a while the default was `` `${who}'s organization` ``,
 * built from the account's own first name, so hosts who never opened Settings
 * were inviting people under `Israel's organization`. That is not an
 * organisation, it is a person with a noun stapled on, and it reads as a
 * placeholder somebody forgot to fill in.
 *
 * The first attempt withheld the name from the public payload. That solved the
 * wrong problem twice over: the invitee lost information they wanted, and the
 * bad name stayed exactly where it was. The name has to be *chosen*, and the
 * only person who can choose it is the owner — so the product has to ask.
 *
 * It asks **here**, on the screen a host opens every time, rather than in
 * Settings where the people who need it have already demonstrated they do not
 * go. It names the consequence rather than the setting, because "set your
 * organisation name" is a chore and "this is what your invitees see" is a
 * reason.
 *
 * Dismissible, and the dismissal sticks: a banner that cannot be silenced is
 * one people learn to look past, and this one is advice rather than an error.
 * Renaming removes it on its own, since the predicate stops matching.
 */
export function HostNamePrompt() {
  const navigate = useNavigate();
  const organizationName = useActiveOrganizationName();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      // Private window, blocked storage. Showing the prompt is the safe
      // failure: the worst case is one extra banner.
      return false;
    }
  });

  // `null` means the bootstrap has not landed. Never flash a prompt about a
  // name we do not know yet.
  if (organizationName === null) return null;
  if (dismissed || !isGeneratedOrganizationName(organizationName)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* nothing to remember it in; it will ask again next time */
    }
    setDismissed(true);
  };

  return (
    <div className="relative flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Building2 size={14} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">
          Your events are going out as “{organizationName}”
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          That name is on every event page and every pass you send. Give it the name people
          would recognise — your church, your club, your company.
        </p>
        <Button
          size="sm"
          className="mt-2.5 h-7 rounded-full px-3 text-[11px]"
          onClick={() => navigate({ to: '/account', search: { tab: 'settings' } })}
        >
          Set the name
        </Button>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default HostNamePrompt;
