/**
 * The invitation, as a lime CredoPass billboard — at two sizes.
 *
 * **One component, two variants, on purpose.** The inline invite panel and the
 * maximised door screen used to be separate blocks of JSX that happened to
 * show the same code: one on a dark card, one on lime, each with its own
 * framing, caption and copy. They drifted, and they looked like two different
 * things because they were. `variant` is the only difference now — everything
 * either shares or scales.
 *
 * - `panel` — inside the kiosk's Invite tab, and anywhere else an invite needs
 *   to sit in a column of other controls.
 * - `fullscreen` — the door tablet. Adds the brand lockup, the Minimise
 *   control, the decorative rings and the footer, because it is the whole
 *   screen and nothing else on it says what it is.
 *
 * **Why lime in both.** The panel used to be a dark card, which made the
 * invite look like a component of the console. It is not: it is a thing you
 * point a stranger's phone at. Giving it the same billboard treatment at both
 * sizes means the organiser is always looking at the artefact itself, and
 * "Maximise" becomes a change of scale rather than a change of design.
 *
 * The dark QR pane is load-bearing, not decoration: the blue invitation ring
 * (`kind="invitation"`) needs something dark to read against — straight onto
 * lime it would be invisible.
 */

import { CalendarCheck, MapPin, Minimize2, Users } from 'lucide-react';
import { GlowingQRCode } from '@credopass/ui/components/glowing-qr-code';
import { Button } from '@credopass/ui/components/button';
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon';
import { cn } from '@credopass/ui/lib/utils';

export interface InviteBillboardProps {
  variant: 'panel' | 'fullscreen';
  /** The `/e/{id}` share link. The one code everybody scans. */
  shareUrl: string;
  eventName: string;
  eventStatus: string;
  eventLocation?: string | null;
  startAt: Date;
  checkedIn: number;
  qrSize: number;
  /** `fullscreen` only — the Minimise control. */
  onMinimise?: () => void;
  /** `panel` only — rendered under the copy, e.g. the Maximise button. */
  action?: React.ReactNode;
  className?: string;
}

export function InviteBillboard({
  variant,
  shareUrl,
  eventName,
  eventStatus,
  eventLocation,
  startAt,
  checkedIn,
  qrSize,
  onMinimise,
  action,
  className,
}: InviteBillboardProps) {
  const isFull = variant === 'fullscreen';

  const dateLabel = startAt.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = startAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const chip = 'inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 font-medium';

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-primary text-primary-foreground',
        isFull ? 'fixed inset-0 z-50 flex flex-col p-6 md:p-10' : 'rounded-3xl p-5',
        className
      )}
      {...(isFull
        ? { role: 'dialog' as const, 'aria-modal': true, 'aria-label': `${eventName} invitation QR` }
        : {})}
    >
      {/* The same decorative rings as the auth screen and the event hero, so a
          tablet on a door is recognisably the same product. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute rounded-full border-primary-foreground/8',
          isFull ? '-right-24 -top-24 size-72 border-28' : '-right-16 -top-20 size-56 border-16'
        )}
      />
      {isFull && (
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -bottom-16 size-64 rounded-full border-22 border-primary-foreground/6"
        />
      )}

      {isFull && (
        <div className="relative z-10 flex shrink-0 items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary">
            <CredoPassLogoIcon className="size-8 bg-transparent! text-primary!" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={onMinimise}
          >
            <Minimize2 size={15} /> Minimise
          </Button>
        </div>
      )}

      <div
        className={cn(
          'relative z-10 flex flex-col items-center',
          isFull
            ? 'min-h-0 flex-1 justify-center gap-6 lg:flex-row lg:gap-14'
            : 'gap-4 text-center'
        )}
      >
        {/* Dark glass pane. The blue invitation ring needs this to read
            against — on lime it would disappear. */}
        <div
          className={cn(
            'relative shrink-0 bg-primary-foreground/25 shadow-2xl ring-1 ring-primary-foreground/15 backdrop-blur-xl',
            isFull ? 'rounded-[2rem] p-5 md:p-7' : 'rounded-[1.75rem] p-4'
          )}
        >
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 bg-linear-to-br from-primary-foreground/10 to-transparent',
              isFull ? 'rounded-[2rem]' : 'rounded-[1.75rem]'
            )}
          />
          <GlowingQRCode
            value={shareUrl}
            size={qrSize}
            kind="invitation"
            caption="Scan to register"
            showGlow={false}
            ariaLabel="Event registration QR"
          />
        </div>

        <div className={cn('min-w-0', isFull ? 'max-w-lg text-center lg:text-left' : 'w-full')}>
          <p
            className={cn(
              'font-bold uppercase tracking-[0.16em] text-primary-foreground/60',
              isFull ? 'text-[11px]' : 'text-[10px]'
            )}
          >
            {eventStatus === 'ongoing' ? 'Checking in now' : 'Check in here'}
          </p>
          <h2
            className={cn(
              'mt-2 font-semibold leading-[1.08] tracking-tight',
              isFull ? 'text-3xl md:text-4xl lg:text-5xl' : 'text-xl'
            )}
          >
            {eventName}
          </h2>

          <div
            className={cn(
              'mt-4 flex flex-wrap items-center gap-2',
              isFull ? 'mt-5 justify-center lg:justify-start' : 'justify-center'
            )}
          >
            <span className={cn(chip, isFull ? 'px-3.5 py-1.5 text-[13px]' : 'px-3 py-1 text-[11px]')}>
              <CalendarCheck size={isFull ? 14 : 12} />
              {dateLabel} · {timeLabel}
            </span>
            {eventLocation && (
              <span
                className={cn(
                  chip,
                  'min-w-0',
                  isFull ? 'px-3.5 py-1.5 text-[13px]' : 'px-3 py-1 text-[11px]'
                )}
              >
                <MapPin size={isFull ? 14 : 12} className="shrink-0" />
                <span className="truncate">{eventLocation}</span>
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full bg-primary-foreground font-bold text-primary',
                isFull ? 'px-3.5 py-1.5 text-[13px]' : 'px-3 py-1 text-[11px]'
              )}
            >
              <Users size={isFull ? 14 : 12} />
              <span className="tabular-nums">{checkedIn}</span> checked in
            </span>
          </div>

          {/* Says what it is NOT, at both sizes. The kiosk's own scanner tab
              refuses this exact code, and a staff member who tries it deserves
              to have been told why beforehand (F8/U2). */}
          <p
            className={cn(
              'font-medium text-primary-foreground/70',
              isFull ? 'mt-6 text-base md:text-lg' : 'mt-3 text-xs'
            )}
          >
            Guests scan this with their own phone camera to register and get their pass.
            {!isFull && ' It is not a pass — don’t scan it with the scanner.'}
          </p>

          {!isFull && action && <div className="mt-4 flex justify-center">{action}</div>}
        </div>
      </div>

      {isFull && (
        <p className="relative z-10 shrink-0 pt-4 text-center text-[11px] text-primary-foreground/45">
          Press Esc to minimise · credopass.com
        </p>
      )}
    </div>
  );
}
