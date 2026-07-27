/**
 * `/upgrade` — what plan this organization is on.
 *
 * This page used to be a guest-conversion screen: *"You're in guest mode.
 * Create a free account to save your check-ins"*, with a **"Continue as guest
 * instead"** button and a sign-up form whose submit was a one-second
 * `setTimeout` standing in for an API call that was never wired.
 *
 * Nothing ever linked to it that way. Its two callers — the org switcher and
 * the spotlight on `/events` — both mean *upgrade your plan*, so every
 * signed-in person who clicked Upgrade was told they were a guest and offered a
 * mode that does not exist (D20).
 *
 * What it shows now is the truth and no more than the truth. Stripe is deferred
 * (D15) and there is no billing endpoint, so there is no button here that
 * pretends to charge anyone. The tier limits are deliberately not restated:
 * `services/core/src/authz/permissions.ts` and `authz/plans.ts` own those
 * numbers, they move with pricing, and a copy of them here would be wrong on
 * the day pricing changes.
 */

import { ArrowLeft, Mail, Sparkles } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useOrganizations } from '@credopass/api-client'
import { Button } from '@credopass/ui/components/button'
import { useSession } from '../../contexts/session'

export default function UpgradePage() {
  const navigate = useNavigate()
  const { organizationId } = useSession()
  const { data: organizations = [], isLoading } = useOrganizations()

  const organization = organizations.find((o) => o.id === organizationId) ?? organizations[0]
  const goBack = () => navigate({ to: '/events' })

  return (
    <div className="flex min-h-svh items-start justify-center bg-background p-6 sm:items-center">
      <div className="flex w-full max-w-md flex-col gap-6">
        <button
          onClick={goBack}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to app
        </button>

        <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
              Current plan
            </span>
            <Sparkles size={14} />
          </div>
          <p className="truncate text-2xl font-semibold capitalize tracking-tight">
            {isLoading ? '—' : (organization?.plan ?? 'free')}
          </p>
          <p className="mt-1 truncate text-[13px] font-medium opacity-70">
            {organization?.name ?? 'No organization selected'}
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Changing plans isn&rsquo;t self-service yet</h2>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Billing isn&rsquo;t wired up, so there is nothing to click here that would move you to
            another tier. Get in touch and we&rsquo;ll change it on our side.
          </p>
          <Button
            variant="outline"
            className="w-fit gap-2 rounded-full"
            render={(props) => <a {...props} href="mailto:hello@credopass.com?subject=Plan%20change" />}
          >
            <Mail size={14} /> hello@credopass.com
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} CredoPass
        </p>
      </div>
    </div>
  )
}
