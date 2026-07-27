/**
 * `/upgrade/checkout` — a mock checkout.
 *
 * **This screen takes no payment and never will in its current form.** It is
 * scaffolding: it looks like a card form so the upgrade flow can be walked
 * end-to-end before a processor exists, and it is labelled as a mock in the UI
 * so nobody — including a future reader of this file — mistakes it for one.
 *
 * Three properties make it safe to ship:
 *
 *   · **The card is generated, not collected.** The fields are read-only and
 *     pre-filled from `generateFakeCard()`, which only ever emits reserved test
 *     PANs. There is no way to type a real card number into this page.
 *   · **Nothing card-shaped is transmitted.** Submitting calls
 *     `PUT /organizations/{id}/plan` with `{ plan }` and nothing else. The
 *     generated card never leaves the browser; it is discarded on unmount.
 *   · **It is gated on `org:billing`**, the same permission a real checkout
 *     would need, so the authorization path is the one that ships.
 *
 * When Stripe lands, this file is what gets replaced — by a redirect to a
 * Checkout Session, with the plan change moving behind a webhook. The plan
 * picker, the entitlement checks and the API contract stay as they are.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, CreditCard, FlaskConical, Loader2, Lock, ShieldAlert } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import {
  useChangePlan,
  useOrganizations,
  usePlans,
  type PlanId,
} from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { Skeleton } from '@credopass/ui/components/skeleton';
import { toast } from '@credopass/ui/components/sonner';
import { useCan, useSession } from '../../contexts/session';
import { formatPrice, generateFakeCard } from './fake-card';

interface CheckoutPageProps {
  /** Which plan is being bought, from the `?plan=` search param. */
  plan: PlanId;
}

export default function CheckoutPage({ plan: planId }: CheckoutPageProps) {
  const navigate = useNavigate();
  const { organizationId } = useSession();
  const canBill = useCan('org:billing');

  const { data: organizations = [] } = useOrganizations();
  const { data: plans = [], isLoading: plansLoading } = usePlans();
  const changePlan = useChangePlan(organizationId ?? undefined);

  const organization = organizations.find((o) => o.id === organizationId);
  const plan = plans.find((p) => p.id === planId);

  // Generated once per mount. Regenerating on every render would make the
  // fields flicker as you interact with the page.
  const card = useMemo(() => generateFakeCard(), []);
  const [done, setDone] = useState(false);

  const goBack = () => navigate({ to: '/upgrade' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    changePlan.mutate(planId, {
      onSuccess: (result) => {
        setDone(true);
        toast.success(`You’re on ${result.plan}`, {
          description: `Changed from ${result.previousPlan}. No payment was taken — billing isn’t wired up yet.`,
        });
      },
      onError: (err) =>
        toast.error('Couldn’t change the plan', { description: err.message }),
    });
  };

  if (plansLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <Skeleton className="h-[32rem] rounded-2xl" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-12 text-center">
        <p className="text-sm font-semibold">No such plan</p>
        <p className="text-[13px] text-muted-foreground">
          &ldquo;{planId}&rdquo; isn&rsquo;t in the catalogue.
        </p>
        <Button variant="outline" className="mx-auto rounded-full" onClick={goBack}>
          Back to plans
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Check size={24} />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">You&rsquo;re on {plan.name}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {organization?.name} was moved onto {plan.name}. Nothing was charged — this was a mock
            checkout.
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="rounded-full" onClick={() => navigate({ to: '/analytics' })}>
            See analytics
          </Button>
          <Button variant="outline" className="rounded-full" onClick={goBack}>
            Back to plans
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-20">
      <button
        onClick={goBack}
        className="flex w-fit cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back to plans
      </button>

      {/* The label that makes this screen honest. Do not remove it while the
          flow is a mock — it is the only thing separating this from a page that
          impersonates a payment form. */}
      <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/8 p-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <FlaskConical size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Mock checkout — no payment is taken</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            Billing isn&rsquo;t connected yet. The card below is generated from a reserved test
            range, the fields are read-only, and nothing card-shaped is sent to the server —
            confirming just moves your organization onto the plan.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_20rem]">
        {/* Card form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">Card details</h2>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {card.brand}
            </span>
          </div>

          <ReadOnlyField label="Name on card" value={card.name} />
          <ReadOnlyField label="Card number" value={card.number} mono />
          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label="Expires" value={card.expiry} mono />
            <ReadOnlyField label="CVC" value={card.cvc} mono />
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldAlert size={13} className="mt-px shrink-0" />
            These fields are read-only on purpose. A real card typed here would be collected by a
            service that has no way to process it.
          </p>

          {!canBill && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/8 p-3 text-[13px] text-muted-foreground">
              Only an owner of this organization can change its plan.
            </p>
          )}

          <Button
            type="submit"
            className="w-full gap-2 rounded-full font-semibold"
            disabled={!canBill || changePlan.isPending}
          >
            {changePlan.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Lock size={14} />
                Confirm {plan.name}
              </>
            )}
          </Button>
        </form>

        {/* Order summary */}
        <aside className="flex h-fit flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Summary</h2>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] text-muted-foreground">{plan.name}</span>
            <span className="text-lg font-bold tabular-nums">
              {formatPrice(plan.priceMonthly)}
              {plan.priceMonthly ? <span className="text-xs font-normal">/mo</span> : null}
            </span>
          </div>

          <div className="h-px bg-border" />

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium">Due today</span>
            <span className="text-lg font-bold tabular-nums">£0.00</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Zero because no payment processor is connected — not because the plan is free.
          </p>

          <div className="h-px bg-border" />

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Includes
            </p>
            <ul className="flex flex-col gap-1.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                  <Check size={12} className="mt-0.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {organization && (
            <p className="text-[11px] text-muted-foreground">
              Applies to <span className="font-medium text-foreground">{organization.name}</span>
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * A field that looks like an input and is not one.
 *
 * Rendered as text rather than a disabled `<input>` so there is no element on
 * the page that could be re-enabled from devtools and used to type a real PAN.
 */
const ReadOnlyField: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    <div
      className={`rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm ${
        mono ? 'font-mono tracking-wider tabular-nums' : ''
      }`}
    >
      {value}
    </div>
  </div>
);
