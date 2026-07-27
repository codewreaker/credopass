/**
 * `/upgrade` — the plan picker.
 *
 * **No money changes hands anywhere in this flow.** Billing is deferred (D15).
 * Picking a plan opens `/upgrade/checkout`, which is an openly-labelled mock
 * that pre-fills a reserved test card and then calls
 * `PUT /organizations/{id}/plan` — an endpoint that writes a column. When a real
 * processor is wired in, the checkout screen is what gets replaced; this page
 * and the entitlement checks downstream do not change.
 *
 * The tiers, prices and limits come from `GET /plans`, not from a constant in
 * this file. That is the same reason the previous version of this page refused
 * to restate them: `services/core/src/authz/plans.ts` owns those numbers, they
 * move with pricing, and a second copy here would be wrong on the day it does.
 *
 * Only an owner holds `org:billing`, so a non-owner sees the plans and is told
 * who can change them rather than being handed a button that 403s.
 */

import { useMemo } from 'react';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useOrganizations, usePlans, type Plan } from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { Skeleton } from '@credopass/ui/components/skeleton';
import { cn } from '@credopass/ui/lib/utils';
import { useCan, useSession } from '../../contexts/session';
import { formatPrice } from './fake-card';

export default function UpgradePage() {
  const navigate = useNavigate();
  const { organizationId } = useSession();
  const canBill = useCan('org:billing');

  const { data: organizations = [], isLoading: orgsLoading } = useOrganizations();
  const { data: plans = [], isLoading: plansLoading } = usePlans();

  const organization = organizations.find((o) => o.id === organizationId) ?? organizations[0];
  const currentPlan = organization?.plan ?? 'free';

  // Rank by the org limit so "is this an upgrade or a downgrade?" follows the
  // catalogue's own ordering rather than a hard-coded list of tier names.
  const rankOf = useMemo(() => {
    const map = new Map(plans.map((p) => [p.id, p.ownedOrgLimit]));
    return (id: string) => map.get(id) ?? 0;
  }, [plans]);

  const isLoading = orgsLoading || plansLoading;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-20">
      <button
        onClick={() => navigate({ to: '/events' })}
        className="flex w-fit cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back to app
      </button>

      {/* Current plan billboard */}
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
            Current plan
          </span>
          <Sparkles size={14} />
        </div>
        <p className="truncate text-3xl font-semibold capitalize tracking-tight">
          {isLoading ? '—' : currentPlan}
        </p>
        <p className="mt-1 truncate text-[13px] font-medium opacity-70">
          {organization?.name ?? 'No organization selected'}
        </p>
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight">Choose a plan</h1>
        <p className="text-sm text-muted-foreground">
          {canBill
            ? 'Change takes effect immediately.'
            : 'Only an owner of this organization can change the plan.'}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlan}
              isDowngrade={rankOf(plan.id) < rankOf(currentPlan)}
              canBill={canBill}
              onChoose={() =>
                navigate({ to: '/upgrade/checkout', search: { plan: plan.id } })
              }
            />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CredoPass
      </p>
    </div>
  );
}

const PlanCard: React.FC<{
  plan: Plan;
  isCurrent: boolean;
  isDowngrade: boolean;
  canBill: boolean;
  onChoose: () => void;
}> = ({ plan, isCurrent, isDowngrade, canBill, onChoose }) => {
  // "Talk to us" tiers have no price, so they get a mailto rather than checkout.
  const isCustom = plan.priceMonthly === null;

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-colors',
        isCurrent ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/30'
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">{plan.name}</h2>
          {isCurrent && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              Current
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{plan.tagline}</p>
      </div>

      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold tracking-tight tabular-nums">
          {formatPrice(plan.priceMonthly)}
        </span>
        {!isCustom && plan.priceMonthly !== 0 && (
          <span className="mb-1 text-xs text-muted-foreground">/month</span>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-[13px]">
            <Check size={14} className="mt-0.5 shrink-0 text-primary" />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <Button variant="outline" className="w-full rounded-full" disabled>
          Your plan
        </Button>
      ) : isCustom ? (
        <Button
          variant="outline"
          className="w-full rounded-full"
          render={(props) => (
            <a {...props} href="mailto:hello@credopass.com?subject=Enterprise%20plan" />
          )}
        >
          Talk to us
        </Button>
      ) : (
        <Button
          className="w-full rounded-full font-semibold"
          variant={isDowngrade ? 'outline' : 'default'}
          disabled={!canBill}
          onClick={onChoose}
        >
          {isDowngrade ? 'Switch to ' + plan.name : 'Upgrade to ' + plan.name}
        </Button>
      )}
    </div>
  );
};
