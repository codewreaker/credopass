import {
  ArrowRight,
  CalendarPlus,
  Share2,
  ScanLine,
  BarChart3,
  QrCode,
  Smartphone,
  UserCheck,
  Ticket,
  Bell,
  DoorOpen,
  type LucideIcon,
} from 'lucide-react';

interface Step {
  icon: LucideIcon;
  label: string;
}

interface Journey {
  persona: string;
  tag: string;
  icon: LucideIcon;
  /** The lime lane — the host, our primary user. */
  accent?: boolean;
  steps: Step[];
}

const JOURNEYS: Journey[] = [
  {
    persona: 'Host',
    tag: 'Organiser',
    icon: CalendarPlus,
    accent: true,
    steps: [
      { icon: CalendarPlus, label: 'Create event' },
      { icon: Share2, label: 'Share QR / link' },
      { icon: QrCode, label: 'Open kiosk' },
      { icon: ScanLine, label: 'Scan or check in' },
      { icon: BarChart3, label: 'See analytics' },
    ],
  },
  {
    persona: 'Attendee',
    tag: 'No app',
    icon: QrCode,
    steps: [
      { icon: QrCode, label: 'Scan event QR' },
      { icon: Smartphone, label: 'Opens event page' },
      { icon: UserCheck, label: 'Check in (name + email)' },
      { icon: Ticket, label: 'Show ticket QR' },
    ],
  },
  {
    persona: 'Attendee',
    tag: 'App user',
    icon: Smartphone,
    steps: [
      { icon: Bell, label: 'Gets the link' },
      { icon: UserCheck, label: 'RSVP in app' },
      { icon: Ticket, label: 'Personal ticket' },
      { icon: DoorOpen, label: 'Present at door' },
    ],
  },
];

/** A single step node — icon tile + label. */
function StepNode({ step, accent }: { step: Step; accent?: boolean }) {
  const Icon = step.icon;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background px-3 py-2.5 shadow-sm">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          accent ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium leading-tight">{step.label}</span>
    </div>
  );
}

/** One persona lane: header + a wrapping sequence of connected steps. */
function Lane({ journey }: { journey: Journey }) {
  const PersonaIcon = journey.icon;
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        journey.accent
          ? 'border-primary/30 bg-primary/4 shadow-[0_8px_40px_-12px_rgba(212,255,0,0.15)]'
          : 'border-border/50 bg-card'
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            journey.accent ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
          }`}
        >
          <PersonaIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-bold leading-tight tracking-tight">{journey.persona}</p>
          <p className="text-xs text-muted-foreground">{journey.tag}</p>
        </div>
      </div>

      {/* Steps: a horizontal chain that wraps on narrow screens. Arrows rotate
          to point down when a step wraps to the next line. */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        {journey.steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2.5 lg:contents">
            <div className="flex-1 lg:flex-none">
              <StepNode step={step} accent={journey.accent} />
            </div>
            {i < journey.steps.length - 1 && (
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/40 lg:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The three CredoPass journeys — host, walk-in attendee, and app-user attendee —
 * all converging on attendance recorded → analytics. A lightweight, responsive
 * diagram (no react-flow dependency): lanes are cards, steps are connected
 * nodes that wrap on small screens.
 */
export function JourneyFlow() {
  return (
    <div className="flex flex-col gap-4">
      {JOURNEYS.map((journey) => (
        <Lane key={`${journey.persona}-${journey.tag}`} journey={journey} />
      ))}

      {/* Convergence endcap */}
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/3 px-4 py-4 text-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <UserCheck className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold sm:text-base">
          Every path ends in <span className="text-primary">attendance recorded</span> — feeding live analytics.
        </p>
      </div>
    </div>
  );
}
