/**
 * `/analytics` — deliberately empty.
 *
 * `GET /analytics/overview` and `/analytics/export` do not exist. The page they
 * used to fill rendered ~750 lines of charts driven by
 * `services/core/src/analytics/`, which returns deterministic placeholder
 * numbers — real-looking trends, tier upgrades and streaks, all invented. A
 * "Sample data" badge did not make that honest: people screenshot dashboards.
 *
 * So the route stays (the nav item, the bookmark and the muscle memory all
 * survive) and says plainly that there is nothing to show yet. When the
 * endpoints land, this file is where they go — the contract already exists as
 * `AnalyticsResponse` in `@credopass/lib/analytics`.
 */

import { BarChart3, CalendarRange, Users } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useToolbarContext } from '@credopass/lib/hooks';
import { Button } from '@credopass/ui/components/button';

const WHAT_EXISTS = [
  {
    icon: CalendarRange,
    title: 'Per-event counts',
    body: 'Registered and attended, on every event page.',
    to: '/events' as const,
    cta: 'Open events',
  },
  {
    icon: Users,
    title: 'Attendee standings',
    body: 'Who attended, who signed up, who did not turn up — with lifetime totals.',
    to: '/attendees' as const,
    cta: 'Open attendees',
  },
];

export default function AnalyticsPage() {
  const navigate = useNavigate();
  useToolbarContext({ action: null, search: { enabled: false, placeholder: '' } });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Attendance trends across your events.</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full border-18 border-primary/6"
        />
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <BarChart3 className="size-5 text-primary" />
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Not built yet</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            There is no analytics endpoint. Rather than show numbers we made up, this page shows
            nothing until the API can answer honestly — every figure here will come from your real
            attendance records.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          What you can see today
        </span>
        <div className="grid gap-2 sm:grid-cols-2">
          {WHAT_EXISTS.map(({ icon: Icon, title, body, to, cta }) => (
            <div key={title} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
              <Icon size={16} className="text-primary" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-1 w-fit rounded-full"
                onClick={() => navigate({ to })}
              >
                {cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
