/**
 * "Who is in?" — the kiosk's counter, opened up (F10).
 *
 * The ask was: tapping the counter should get you to the attendance list fast,
 * *and* let you get back to scanning. Those two halves pull against each
 * other, which is why this is a sheet and not a navigation.
 *
 * **Why not just route to `/attendees?eventId=`.** That page exists and shows
 * the same people. But leaving `/checkin/$eventId` unmounts the scanner, and
 * coming back re-requests the camera and re-initialises `html5-qrcode` —
 * seconds of black rectangle with a queue at the door. A sheet leaves the
 * kiosk mounted underneath, so "back to scanning" is a dismiss, not a cold
 * start. The full attendee page is still one tap away for anyone who wants it.
 *
 * **No new endpoint.** `GET /people?eventId=&standing=attended` already
 * answers exactly this question — scoping to an event changes `standing` from
 * lifetime to that event — so this is a query, not a feature.
 */

import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, ScanLine, UserRound } from 'lucide-react';
import { usePeople } from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';

interface CheckedInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  /** The live counter, so the sheet header agrees with the chip that opened it. */
  checkedIn: number;
}

const initialsOf = (first: string, last: string) =>
  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';

const timeOf = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

export function CheckedInSheet({
  open,
  onOpenChange,
  eventId,
  eventName,
  checkedIn,
}: CheckedInSheetProps) {
  const navigate = useNavigate();

  // Only fetched while the sheet is open — the kiosk already polls the counter
  // every 5s and does not need a second list running behind a closed sheet.
  const { data, isLoading } = usePeople(
    { eventId, standing: 'attended', limit: 200 },
    { enabled: open }
  );

  const people = data?.data ?? [];

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${checkedIn} checked in · ${eventName}`}
      footer={
        <div className="flex w-full gap-2">
          {/* The primary action is getting back to the door. The feedback asked
              for this explicitly, and it is also the only one that is urgent. */}
          <Button className="flex-1 gap-2 rounded-full" onClick={() => onOpenChange(false)}>
            <ScanLine size={15} />
            Back to scanning
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 rounded-full"
            onClick={() => navigate({ to: '/attendees', search: { eventId } })}
          >
            Full list <ArrowUpRight size={14} />
          </Button>
        </div>
      }
      contentClassName="flex flex-col gap-2"
    >
      {isLoading ? (
        // Three bars, not "0 people" — a count we do not have yet is not zero
        // (UI-REDESIGN R2).
        <div className="flex flex-col gap-2" aria-label="Loading who is in">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <UserRound size={22} className="text-muted-foreground" />
          <p className="text-sm font-semibold">Nobody has checked in yet</p>
          <p className="max-w-64 text-xs text-muted-foreground">
            Scan a guest&apos;s pass, or use manual check-in, and they will appear here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map((person) => {
            const at = timeOf(person.checkInTime);
            return (
              <li
                key={person.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {initialsOf(person.firstName, person.lastName)}
                </span>
                <div className="min-w-0 flex-1">
                  {/* Wrap, do not truncate. A clipped name on a door screen is
                      the one place it actually costs you something (R6). */}
                  <p className="text-sm font-semibold leading-tight">
                    {person.firstName} {person.lastName}
                  </p>
                  {person.email && (
                    <p className="break-all text-[11px] leading-tight text-muted-foreground">
                      {person.email}
                    </p>
                  )}
                </div>
                {at && (
                  <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
                    {at}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SheetDialog>
  );
}
