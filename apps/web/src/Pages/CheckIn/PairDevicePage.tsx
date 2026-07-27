/**
 * `/checkin/pair` — turning a tablet into a door.
 *
 * Unauthenticated, and it has to be: the device has no account and never will.
 * It types a pairing code someone read to it off the console, and gets back a
 * `cpd_…` token scoped to one event.
 *
 * The token is returned **once**. It is persisted before anything else happens
 * with the response, because there is no endpoint that will hand it over again —
 * losing it means a new pairing code (§2.6).
 */

import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ShieldOff, Tablet } from 'lucide-react';
import { usePairDevice } from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { toast } from '@credopass/ui/components/sonner';
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon';
import { storeDeviceCredential } from '../../lib/device-token';
import { errorMessage } from '../../lib/errors';

export default function PairDevicePage() {
  const navigate = useNavigate();
  const { revoked } = useSearch({ from: '/checkin/pair' });
  const pairDevice = usePairDevice();
  const [code, setCode] = useState('');

  const canSubmit = code.trim().length >= 4 && !pairDevice.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      const device = await pairDevice.mutateAsync(code.trim().toUpperCase());

      // Persist before navigating. Everything downstream — the API client's auth
      // header included — reads the token from storage.
      storeDeviceCredential({
        token: device.token,
        deviceId: device.deviceId,
        label: device.label,
        eventId: device.eventId,
        organizationId: device.organizationId,
        scopes: device.scopes,
        expiresAt: device.expiresAt,
      });

      toast.success(`Paired as ${device.label}`);

      if (device.eventId) {
        // A full reload, not a route change: the API client picks the credential
        // up at configure time, and this tablet has just become a different
        // caller than the one that rendered this page.
        window.location.href = `/checkin/${device.eventId}`;
        return;
      }
      navigate({ to: '/events' });
    } catch (error) {
      toast.error(errorMessage(error, 'That code did not work'));
    }
  };

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden bg-primary px-5 py-10 text-primary-foreground">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-28 border-primary-foreground/8" />
      <div aria-hidden className="pointer-events-none absolute -left-20 -bottom-16 size-64 rounded-full border-22 border-primary-foreground/6" />

      <div className="relative z-10 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary">
          <CredoPassLogoIcon className="size-8 bg-transparent! text-primary!" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center">
        {revoked ? (
          <>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-foreground/10">
              <ShieldOff className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">This device was revoked</h1>
              <p className="mt-1.5 text-sm text-primary-foreground/70">
                An admin turned it off from the console. Ask them for a new pairing code.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-foreground/10">
              <Tablet className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Pair this device</h1>
              <p className="mt-1.5 text-sm text-primary-foreground/70">
                Enter the pairing code from the event page. It expires in 15 minutes.
              </p>
            </div>
          </>
        )}

        <Input
          autoFocus
          value={code}
          placeholder="K7QM4XPD"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-14 rounded-2xl border-primary-foreground/20 bg-primary-foreground/10 text-center font-mono text-2xl font-black tracking-[0.3em] text-primary-foreground placeholder:text-primary-foreground/30"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <Button
          className="h-12 w-full rounded-full bg-primary-foreground font-semibold text-primary hover:bg-primary-foreground/90"
          disabled={!canSubmit}
          onClick={submit}
        >
          {pairDevice.isPending ? 'Pairing…' : 'Pair device'}
        </Button>

        <p className="text-[11px] text-primary-foreground/45">
          A paired device can check people in at one event. It cannot open the console, see your
          attendee list, or sign in as anyone.
        </p>
      </div>
    </div>
  );
}
