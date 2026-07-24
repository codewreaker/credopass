import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@credopass/ui/components/button';
import { Badge } from '@credopass/ui/components/badge';
import { useTheme } from '@credopass/lib/theme';
import {
  QrCode,
  ArrowRight,
  ArrowLeft,
  Moon,
  Sun,
  Building2,
  UsersRound,
  CalendarPlus,
  Share2,
  ScanLine,
  BarChart3,
  DoorOpen,
  Smartphone,
  UserCheck,
  Ticket,
  ClipboardCheck,
  Sparkles,
  Trophy,
  ShieldCheck,
  Database,
  Radio,
  MousePointerClick,
  type LucideIcon,
} from 'lucide-react';
import { HorizontalStory, parallax, type StoryProgress } from '../components/HorizontalStory';
import { navigate } from '../App';

/* ================================================================== *
 * Persona data — each track is one type of CredoPass user, told as a
 * left-to-right journey. Steps mirror the real product flow.
 * ================================================================== */

interface Step {
  icon: LucideIcon;
  kicker: string;
  title: string;
  body: string;
  detail?: string;
}

export interface Persona {
  id: string;
  name: string;
  tag: string;
  blurb: string;
  icon: LucideIcon;
  accent?: boolean;
  steps: Step[];
}

export const PERSONAS: Persona[] = [
  {
    id: 'organizer',
    name: 'The Organizer',
    tag: 'Owner · Admin',
    blurb: 'Runs the org, spins up events, and lives in the analytics.',
    icon: Building2,
    accent: true,
    steps: [
      {
        icon: Building2, kicker: 'Step 01', title: 'Create your organization',
        body: 'Your org is the tenant boundary — every event, member and attendance record lives inside it.',
        detail: 'Pick a plan: Free → Starter → Pro → Enterprise.',
      },
      {
        icon: UsersRound, kicker: 'Step 02', title: 'Invite your team',
        body: 'Add people with a role — owner, admin, member or viewer — so the right hands can run the door.',
        detail: 'Invites are tracked by email until accepted.',
      },
      {
        icon: CalendarPlus, kicker: 'Step 03', title: 'Create an event',
        body: 'Name, venue, start/end, capacity. Choose which check-in methods the door will offer.',
        detail: 'QR · Manual · External auth — toggle per event.',
      },
      {
        icon: Share2, kicker: 'Step 04', title: 'Share the pass',
        body: 'Every event gets a public link and QR. No login needed for guests to open it.',
        detail: 'One tap copies the link or opens the kiosk.',
      },
      {
        icon: ScanLine, kicker: 'Step 05', title: 'Open the kiosk',
        body: 'Point a phone or tablet at the door. Scan arrivals or check them in by hand.',
        detail: 'Works offline-first — syncs when back online.',
      },
      {
        icon: BarChart3, kicker: 'Step 06', title: 'Watch it live',
        body: 'Attendance climbs in real time. Arrivals-by-hour, trends and no-show rates, ready for the board deck.',
        detail: 'Every scan feeds the same dashboard.',
      },
    ],
  },
  {
    id: 'steward',
    name: 'The Steward',
    tag: 'Staff · Volunteer',
    blurb: 'Front of house — turns a queue into clean attendance data.',
    icon: ClipboardCheck,
    steps: [
      {
        icon: UserCheck, kicker: 'Step 01', title: 'Get added to the event',
        body: 'The organizer assigns you a door role — staff, volunteer or co-host — for this event.',
        detail: 'Event roles are separate from org roles.',
      },
      {
        icon: QrCode, kicker: 'Step 02', title: 'Open the check-in kiosk',
        body: 'Tap through from the event and the scanner opens full-screen on your device.',
        detail: 'No special hardware — any camera phone works.',
      },
      {
        icon: ScanLine, kicker: 'Step 03', title: 'Scan the passes',
        body: 'Guests hold up their ticket QR. Each scan records one attendance row, instantly.',
        detail: 'One row per person, per event — no doubles.',
      },
      {
        icon: DoorOpen, kicker: 'Step 04', title: 'Or check in by hand',
        body: 'No phone? Type a name and email. Same clean record, same live count.',
        detail: 'Handles walk-ups and forgotten passes.',
      },
      {
        icon: BarChart3, kicker: 'Step 05', title: 'See the count climb',
        body: 'The live tally updates as you work, so you always know the room.',
        detail: 'Check-in time and method are stamped on each row.',
      },
    ],
  },
  {
    id: 'guest',
    name: 'The Walk-in Guest',
    tag: 'No app · No account',
    blurb: 'Shows up, scans, and is counted — nothing to install.',
    icon: MousePointerClick,
    steps: [
      {
        icon: QrCode, kicker: 'Step 01', title: 'Scan the event QR',
        body: 'On a poster, a screen, or a shared link. It just opens a web page.',
        detail: 'No download, no sign-up wall.',
      },
      {
        icon: Smartphone, kicker: 'Step 02', title: 'The event page opens',
        body: 'You see the event — where, when, who’s hosting — on a clean public page.',
        detail: 'Served token-optional, straight from the link.',
      },
      {
        icon: UserCheck, kicker: 'Step 03', title: 'Add your name + email',
        body: 'Register ahead as an RSVP, or check in on the spot when you arrive.',
        detail: 'RSVP = saved for later · Check in = you’re here.',
      },
      {
        icon: Ticket, kicker: 'Step 04', title: 'Get your ticket',
        body: 'A personal ticket with its own QR lands on your screen — screenshot it or keep the tab.',
        detail: 'Add-to-calendar in one tap.',
      },
      {
        icon: DoorOpen, kicker: 'Step 05', title: 'Show it at the door',
        body: 'Flash the QR, get scanned, and you’re officially counted.',
        detail: 'Your attendance row is stamped: time + method.',
      },
    ],
  },
  {
    id: 'member',
    name: 'The Regular',
    tag: 'App user · Member',
    blurb: 'Comes back often — and earns for it.',
    icon: Trophy,
    steps: [
      {
        icon: ShieldCheck, kicker: 'Step 01', title: 'Sign in to the app',
        body: 'Secure sign-in through Supabase. Your identity carries across every event you attend.',
        detail: 'One account, every org you belong to.',
      },
      {
        icon: Ticket, kicker: 'Step 02', title: 'RSVP & carry your pass',
        body: 'Reserve your place and keep a personal ticket in the app — always on you.',
        detail: 'Ticket QR is unique to you and the event.',
      },
      {
        icon: DoorOpen, kicker: 'Step 03', title: 'Breeze through the door',
        body: 'Present your pass or self-check-in. The row is written the moment you arrive.',
        detail: 'Same attendance record as everyone else.',
      },
      {
        icon: Trophy, kicker: 'Step 04', title: 'Earn loyalty',
        body: 'Showing up adds points and moves you up the tiers — Bronze to Platinum.',
        detail: 'Rewards are scoped per organization.',
      },
      {
        icon: BarChart3, kicker: 'Step 05', title: 'Build your history',
        body: 'Every visit stacks into an attendance history the organizer can see and reward.',
        detail: 'Real engagement, not just a ticket sale.',
      },
    ],
  },
];

/* ================================================================== *
 * Presentational pieces
 * ================================================================== */

function PanelCard({ step, index, accent }: { step: Step; index: number; accent?: boolean }) {
  const Icon = step.icon;
  return (
    <article
      className={`snap-center relative shrink-0 w-[82vw] sm:w-[400px] lg:w-[440px] rounded-3xl border p-6 sm:p-8 flex flex-col gap-5 overflow-hidden ${
        accent
          ? 'border-primary/40 bg-primary/[0.05] shadow-[0_24px_80px_-32px_rgba(212,255,0,0.35)]'
          : 'border-border/60 bg-card shadow-[0_24px_80px_-40px_rgba(0,0,0,0.6)]'
      }`}
    >
      {/* Ghost step number — depth layer */}
      <span className="pointer-events-none absolute -top-6 -right-2 text-[9rem] leading-none font-black tracking-tighter text-primary/[0.06] select-none">
        {index + 1}
      </span>

      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          accent ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
        }`}
      >
        <Icon className="w-7 h-7" strokeWidth={2} />
      </div>

      <div className="flex flex-col gap-2 relative">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">{step.kicker}</span>
        <h3 className="text-2xl font-bold tracking-tight leading-tight">{step.title}</h3>
        <p className="text-muted-foreground leading-relaxed">{step.body}</p>
      </div>

      {step.detail && (
        <div className="mt-auto pt-4 border-t border-border/50 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <span className="text-sm text-muted-foreground">{step.detail}</span>
        </div>
      )}
    </article>
  );
}

/** Sticky persona header + a progress rail, pinned above the moving track. */
function PersonaOverlay({ persona, progress }: { persona: Persona; progress: number }) {
  const Icon = persona.icon;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            persona.accent ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-xl font-bold leading-tight tracking-tight">{persona.name}</p>
          <p className="text-sm text-muted-foreground">{persona.tag}</p>
        </div>
      </div>
      {/* Progress rail */}
      <div className="hidden sm:flex items-center gap-3 w-40">
        <div className="h-1.5 flex-1 rounded-full bg-border/60 overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="text-xs font-mono text-muted-foreground tabular-nums w-9 text-right">
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}

function PersonaBackdrop({ persona, progress }: { persona: Persona; progress: number }) {
  return (
    <>
      {/* Giant persona watermark — moves slower than the track for parallax depth */}
      <div
        className="absolute top-1/2 -translate-y-1/2 left-0 whitespace-nowrap will-change-transform"
        style={{ transform: parallax(progress, 420) }}
      >
        <span className="text-[28vw] font-black tracking-tighter text-foreground/[0.025] select-none uppercase leading-none">
          {persona.name.replace('The ', '')}
        </span>
      </div>
      {/* Lime glow drifting the opposite way */}
      <div
        className="absolute top-1/3 right-[-10%] w-[45vw] h-[45vw] rounded-full bg-primary/[0.06] blur-[120px] will-change-transform"
        style={{ transform: `translate3d(${progress * 160}px,0,0)` }}
      />
    </>
  );
}

function PersonaTrack({ persona }: { persona: Persona }) {
  return (
    <div id={persona.id} className="scroll-mt-16">
      <HorizontalStory
        lengthVh={persona.steps.length * 62 + 40}
        backdrop={({ progress }) => <PersonaBackdrop persona={persona} progress={progress} />}
        overlay={({ progress }) => <PersonaOverlay persona={persona} progress={progress} />}
      >
        {(_p: StoryProgress) => (
          <>
            {/* Intro card sets the scene for the persona */}
            <div className="snap-center shrink-0 w-[78vw] sm:w-[360px] flex flex-col gap-4 pr-2">
              <Badge variant="outline" className="w-fit border-primary/40 text-primary">{persona.tag}</Badge>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter leading-[1.05]">{persona.name}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">{persona.blurb}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                <ArrowRight className="w-4 h-4 text-primary animate-pulse" />
                <span>Scroll to walk the journey</span>
              </div>
            </div>

            {persona.steps.map((step, i) => (
              <PanelCard key={step.title} step={step} index={i} accent={persona.accent} />
            ))}

            {/* Outro card — every persona ends at the same place */}
            <div className="snap-center shrink-0 w-[78vw] sm:w-[380px] rounded-3xl border border-dashed border-primary/40 bg-primary/[0.03] p-8 flex flex-col justify-center gap-4">
              <UserCheck className="w-10 h-10 text-primary" />
              <p className="text-2xl font-bold tracking-tight leading-tight">
                Ends in <span className="text-primary">one attendance row</span>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Whoever you are, the journey converges on the same durable record — feeding live analytics.
              </p>
            </div>
          </>
        )}
      </HorizontalStory>
    </div>
  );
}

/* ================================================================== *
 * The "under the hood" finale — one record, then analytics.
 * ================================================================== */

const DATA_FLOW: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: MousePointerClick, title: 'A check-in happens', body: 'QR scan, manual entry, or self-service on the public page — any path, any persona.' },
  { icon: ShieldCheck, title: 'The API verifies & validates', body: 'A Supabase-verified request hits the Hono API; Zod validates the shape before anything is written.' },
  { icon: Database, title: 'One row is written', body: 'A single attendance row per (event, patron) — attended, timestamp, method — enforced by a unique key.' },
  { icon: Radio, title: 'Collections sync', body: 'Offline-first TanStack DB collections reconcile the write across every open kiosk and dashboard.' },
  { icon: BarChart3, title: 'Analytics update', body: 'Counts, arrivals-by-hour and trends recompute — the number you see is the number in the database.' },
];

function DataFlowFinale() {
  return (
    <section id="under-the-hood" className="py-20 sm:py-28 lg:py-36 border-t border-border/40 bg-muted/20 scroll-mt-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12 lg:mb-16 flex flex-col gap-4">
          <Badge variant="outline" className="w-fit">Under the hood</Badge>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter">Every path, one source of truth</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            The four journeys look different on the surface. Underneath, they all write to the same place —
            which is why the dashboard can be trusted.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {DATA_FLOW.map((node, i) => {
            const Icon = node.icon;
            return (
              <li
                key={node.title}
                className="group flex items-start gap-4 sm:gap-6 rounded-2xl border border-border/50 bg-card p-5 sm:p-6 hover:border-primary/30 transition-colors"
              >
                <span className="hidden sm:block text-3xl font-black tracking-tighter text-primary/15 tabular-nums w-10 shrink-0">
                  {i + 1}
                </span>
                <span className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary" />
                </span>
                <div>
                  <h3 className="text-lg font-bold tracking-tight mb-1">{node.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{node.body}</p>
                </div>
                {i < DATA_FLOW.length - 1 && (
                  <ArrowRight className="hidden lg:block w-5 h-5 text-muted-foreground/30 self-center ml-auto rotate-90" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Chrome: nav, hero, footer
 * ================================================================== */

function StoryNav() {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-border/30 bg-background/70 backdrop-blur-2xl' : 'bg-transparent'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 group" aria-label="Back to home">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(212,255,0,0.3)]">
              <QrCode className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-tight">CredoPass</span>
          </button>

          <div className="hidden md:flex items-center gap-6">
            {PERSONAS.map((p) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                onClick={(e) => { e.preventDefault(); navigate('/how-it-works', p.id); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {p.name}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={toggleTheme} className="p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-1.5 w-3.5 h-3.5" /> Home
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg" onClick={() => (location.href = 'https://app.credopass.com')}>
              Open the app <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-36 pb-16 sm:pt-44 sm:pb-24 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50rem] h-[30rem] bg-primary/8 rounded-full blur-[128px]" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl flex flex-col gap-7">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm w-fit">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">How CredoPass works</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[1.02] text-balance">
            Every role. One{' '}
            <span className="relative inline-block">
              <span className="text-primary">attendance record</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none" aria-hidden="true">
                <path d="M2 8.5C50 2.5 100 2 150 5.5C200 9 250 4.5 298 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary/40" />
              </svg>
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            CredoPass turns everyone who touches your event — the organizer, the steward, the walk-in guest,
            the regular — into the same clean, durable data. Scroll each journey sideways to see exactly how.
          </p>

          {/* Persona jump pills */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              return (
                <a
                  key={p.id}
                  href={`#${p.id}`}
                  onClick={(e) => { e.preventDefault(); navigate('/how-it-works', p.id); }}
                  className="group inline-flex items-center gap-2 pl-2.5 pr-4 py-2 rounded-full border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.04] transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </span>
                  <span className="text-sm font-medium">{p.name}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function FooterCta() {
  return (
    <section className="py-20 sm:py-28 lg:py-36 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-7">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter text-balance">
            Now go track <span className="text-primary">who actually shows up</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            Start free — no credit card. Your first event and its analytics are minutes away.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 h-12 shadow-[0_0_32px_rgba(212,255,0,0.25)]" onClick={() => (location.href = 'https://app.credopass.com')}>
              Start for free <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 h-12" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 w-4 h-4" /> Back to home
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */

export function HowItWorks(): ReactNode {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StoryNav />
      <Hero />
      {PERSONAS.map((p) => (
        <PersonaTrack key={p.id} persona={p} />
      ))}
      <DataFlowFinale />
      <FooterCta />
    </div>
  );
}
