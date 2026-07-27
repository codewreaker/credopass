/**
 * Devices at this event (§2.10).
 *
 * The console never sees a device token. `POST /events/{id}/devices` returns a
 * **pairing code** — the tablet redeems it itself at `/checkin/pair`, and only
 * the tablet ever holds the resulting `cpd_…`. The code expires in 15 minutes
 * and works once, which is why it is displayed large: someone is reading it off
 * this screen onto a device across the room.
 */

import { useState } from 'react';
import { Plus, Tablet, Trash2 } from 'lucide-react';
import {
  useCreateDevice,
  useDevices,
  useRevokeDevice,
  type Device,
} from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { toast } from '@credopass/ui/components/sonner';
import { cn } from '@credopass/ui/lib/utils';
import { useSession } from '../../../contexts/session';
import { errorMessage } from '../../../lib/errors';

const STATUS_STYLE: Record<Device['status'], string> = {
  active: 'text-success',
  pending: 'text-primary',
  revoked: 'text-destructive',
  expired: 'text-muted-foreground',
};

/** "2 min ago", "yesterday" — enough to tell a live door from a dead one. */
function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** Minutes left on a pairing code, so the panel can say when it goes stale. */
function minutesUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
}

export function DevicesPanel({ eventId }: { eventId: string }) {
  const { organizationId } = useSession();
  const { data: devices = [] } = useDevices(organizationId ?? undefined, eventId);
  const revokeDevice = useRevokeDevice(organizationId ?? undefined);
  const [pairOpen, setPairOpen] = useState(false);

  const revoke = async (device: Device) => {
    try {
      await revokeDevice.mutateAsync(device.id);
      toast.success(`${device.label} revoked`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not revoke that device'));
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Devices at this event
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => setPairOpen(true)}>
          <Plus size={14} /> Pair a tablet
        </Button>
      </div>

      {devices.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          No tablets paired. A paired tablet can check people in at this event and can do nothing
          else — it has no account and cannot open the console.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center gap-3 py-2.5">
              <Tablet size={15} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{device.label}</span>
              <span className={cn('shrink-0 text-xs font-medium', STATUS_STYLE[device.status])}>
                {device.status === 'active' ? '●' : '○'} {device.status}
              </span>
              <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:block">
                {device.status === 'pending' && device.pairingCode
                  ? `code ${device.pairingCode} (${minutesUntil(device.expiresAt)}m)`
                  : `last seen ${relativeTime(device.lastUsedAt)}`}
              </span>
              {device.status !== 'revoked' && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => revoke(device)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <PairDeviceDialog open={pairOpen} onOpenChange={setPairOpen} eventId={eventId} />
    </div>
  );
}

function PairDeviceDialog({
  open,
  onOpenChange,
  eventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
}) {
  const { organizationId } = useSession();
  const createDevice = useCreateDevice(eventId, organizationId ?? undefined);
  const [label, setLabel] = useState('');
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);

  const canSubmit = label.trim().length > 0 && !createDevice.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      // Scopes default server-side to what a door needs. Asking for more here
      // would hand a tablet reach it has no use for.
      const device = await createDevice.mutateAsync({ label: label.trim() });
      setIssued({ code: device.pairingCode, expiresAt: device.pairingExpiresAt });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the pairing code'));
    }
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setLabel('');
      setIssued(null);
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={close}
      title={issued ? 'Enter this code on the tablet' : 'Pair a tablet'}
      footer={
        issued ? (
          <Button size="sm" className="rounded-full px-4" onClick={() => close(false)}>
            Done
          </Button>
        ) : (
          <Button size="sm" className="rounded-full px-4" disabled={!canSubmit} onClick={submit}>
            Get a pairing code
          </Button>
        )
      }
      contentClassName="flex flex-col gap-3"
    >
      {issued ? (
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <p className="font-mono text-4xl font-black tracking-[0.2em]">{issued.code}</p>
          <p className="text-sm text-muted-foreground">
            On the tablet, open <span className="font-mono text-foreground">/checkin/pair</span> and
            type this code.
          </p>
          <p className="text-xs text-muted-foreground">
            It expires in {minutesUntil(issued.expiresAt)} minutes and works once.
          </p>
        </div>
      ) : (
        <>
          <Input
            autoFocus
            placeholder="Main door"
            value={label}
            className="h-11 rounded-xl"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <p className="px-1 text-xs text-muted-foreground">
            Name it after where it stands. The label is what you will revoke by later.
          </p>
        </>
      )}
    </SheetDialog>
  );
}
