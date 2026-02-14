import { useMemo } from 'react';
import Analytics from '../Analytics/index';
import Tables from '../Tables';
import { useEventSessionStore } from '../../stores/store';

const GREETINGS: Record<string, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return GREETINGS.morning;
  if (hour < 17) return GREETINGS.afternoon;
  return GREETINGS.evening;
}

export default function HomePage() {
  const userName = useEventSessionStore((s) => s.session.currentUserName);
  const firstName = useMemo(() => userName?.split(' ')[0] || 'there', [userName]);
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header -- Luma-inspired: warm greeting, minimal info */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {'Here\u2019s what\u2019s happening with your events today.'}
        </p>
      </div>

      {/* Analytics grid */}
      <Analytics />

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Recent data tables */}
      <Tables />
    </div>
  );
}
