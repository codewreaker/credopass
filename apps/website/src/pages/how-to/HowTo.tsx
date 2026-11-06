import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@credopass/ui/components/badge';
import { Button } from '@credopass/ui/components/button';
import { useTheme } from '@credopass/lib/theme';
import { ArrowLeft, ArrowRight, Moon, QrCode, Sun, Info, ImageOff } from 'lucide-react';
import { navigate } from '../../App';
import { GROUPS, SCREENS, shotPath, type Screen } from './screens';

/**
 * The how-to reference: every screen in the product, once, with a real
 * screenshot of it.
 *
 * It is driven entirely by `screens.ts`, which the capture script also reads —
 * so this page cannot document a screen the capture does not know about, and a
 * screen cannot quietly lose its image. A missing file shows as a labelled
 * gap rather than a broken image, because an obviously-absent screenshot is
 * more useful than one that is silently out of date.
 *
 * Distinct from `/how-it-works`, which is the narrative sell — four personas,
 * told as journeys. This one is the index you check when you want to know what
 * a screen is for.
 */

const APP_URL = 'https://app.credopass.com';

/** A screenshot that degrades to a labelled placeholder rather than a broken image. */
function Shot({ screen }: { screen: Screen }) {
  const [failed, setFailed] = useState(false);
  const src = shotPath(screen.id, 'mobile');

  if (failed) {
    return (
      <div className="flex aspect-[390/844] w-full max-w-[260px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
        <ImageOff className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          No screenshot yet for <code className="text-[11px]">{screen.id}</code>
        </p>
        <p className="text-[11px] text-muted-foreground/70">
          Run <code>nx run website:shots</code>
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`The ${screen.title} screen in CredoPass`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full max-w-[260px] rounded-2xl border border-border/50 shadow-2xl shadow-black/30"
    />
  );
}

function ScreenCard({ screen, index }: { screen: Screen; index: number }) {
  return (
    <article
      id={screen.id}
      className="scroll-mt-24 border-t border-border/40 py-12 first:border-t-0 lg:py-16"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
        <div className="order-2 lg:order-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground/60">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="text-2xl font-bold tracking-tight">{screen.title}</h3>
            {screen.auth === 'none' && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                No account needed
              </Badge>
            )}
          </div>

          <p className="max-w-prose text-muted-foreground">{screen.purpose}</p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {screen.actions.map((action) => (
              <li
                key={action}
                className="rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-sm text-foreground/90"
              >
                {action}
              </li>
            ))}
          </ul>

          {screen.note && (
            <div className="mt-6 flex max-w-prose gap-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">{screen.note}</p>
            </div>
          )}

          <p className="mt-6 font-mono text-xs text-muted-foreground/70">
            {screen.path.replace(/:(\w+)/g, '…')}
          </p>
        </div>

        <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
          <Shot screen={screen} />
        </div>
      </div>
    </article>
  );
}

export function HowTo() {
  const { theme, setTheme } = useTheme();
  const [active, setActive] = useState<string>(SCREENS[0].id);

  const grouped = useMemo(
    () => GROUPS.map((group) => ({ group, screens: SCREENS.filter((s) => s.group === group) })),
    []
  );

  // Highlight the group you are reading. One observer for the whole page, and
  // a top-biased root margin so a heading counts as "current" once it reaches
  // the upper third rather than when it leaves the screen.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    for (const screen of SCREENS) {
      const el = document.getElementById(screen.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const activeGroup = SCREENS.find((s) => s.id === active)?.group;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-2xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <QrCode className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">CredoPass</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg p-2 transition-colors hover:bg-accent"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/how-it-works')}>
              How it works
            </Button>
            <Button size="sm" render={(props) => <a {...props} href={APP_URL} />}>
              Open the app <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <header className="border-b border-border/30">
        <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <button
            onClick={() => navigate('/')}
            className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <Badge variant="outline" className="mb-4 uppercase tracking-widest">
            Reference
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight lg:text-6xl">
            Every screen, and what it is for
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            {SCREENS.length} screens, in the order you meet them. Each one shows what you can
            actually do there — not what is planned. Where something is not built yet, it says so.
          </p>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground/70">
            Screenshots are captured from the running app, so they move when the product does.
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
          <aside className="hidden lg:block">
            <nav className="sticky top-24 py-16">
              <ul className="space-y-1">
                {grouped.map(({ group, screens }) => (
                  <li key={group}>
                    <a
                      href={`#${screens[0].id}`}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        activeGroup === group
                          ? 'bg-primary/10 font-medium text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {group}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <main className="pb-24">
            {grouped.map(({ group, screens }) => (
              <section key={group} className="pt-16 first:pt-8">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {group}
                </h2>
                {screens.map((screen) => (
                  <ScreenCard
                    key={screen.id}
                    screen={screen}
                    index={SCREENS.indexOf(screen)}
                  />
                ))}
              </section>
            ))}
          </main>
        </div>
      </div>

      <footer className="border-t border-border/40 bg-muted/20 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            Something here out of date?{' '}
            <span className="text-foreground">
              Add or amend the screen in <code>apps/website/src/pages/how-to/screens.ts</code> and
              re-run <code>nx run website:shots</code>.
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
