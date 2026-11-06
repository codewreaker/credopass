/**
 * Screenshots for the how-to page, captured from the real running app.
 *
 * WHY A SCRIPT. The how-to page is a reference to the product, so its images
 * have to be re-takeable — a hand-cropped screenshot is stale the next time a
 * button moves, and nobody can tell which version of the UI it shows. This
 * walks `SCREENS` and writes one file per screen per viewport, so refreshing
 * every image on the page is one command.
 *
 * TWO RUNS, BECAUSE OF GOOGLE. Google is the only sign-in and it will not
 * complete in a headless browser. So:
 *
 *   bun scripts/capture-screens.ts --login    # opens a window, you sign in once
 *   bun scripts/capture-screens.ts            # headless, reuses that session
 *
 * The session lands in `.auth/state.json` and the ids the routes need in
 * `capture.config.json`. Both are gitignored: one is a credential, the other
 * points at real rows.
 *
 * Public screens (`auth: 'none'`) are captured with no session at all, in a
 * fresh context — that is the point of them, and capturing them signed in
 * would quietly hide a bug.
 */

import { chromium, type Browser, type BrowserContext } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SCREENS, type Screen } from '../src/pages/how-to/screens';

const ROOT = resolve(import.meta.dirname, '..');
const AUTH_STATE = resolve(ROOT, '.auth/state.json');
const CONFIG = resolve(ROOT, 'capture.config.json');
const OUT_DIR = resolve(ROOT, 'public/how-to');

const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
} as const;

type Variant = keyof typeof VIEWPORTS;

interface Config {
  /** Origin of the running web app, e.g. http://localhost:5001 */
  appUrl: string;
  /** Real ids the fixture routes need. */
  fixtures: Partial<Record<'eventId' | 'passToken' | 'personId' | 'inviteToken', string>>;
}

const DEFAULT_CONFIG: Config = {
  appUrl: 'http://localhost:5000',
  fixtures: {},
};

function loadConfig(): Config {
  if (!existsSync(CONFIG)) {
    writeFileSync(CONFIG, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
    console.log(`📝 Wrote a starter ${CONFIG}. Fill in appUrl and the fixture ids.`);
    return DEFAULT_CONFIG;
  }
  return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG, 'utf8')) };
}

/** Substitutes `:eventId` etc. Returns null when an id is missing, so the run
 *  skips that screen loudly rather than navigating to a literal ":eventId". */
function resolvePath(screen: Screen, fixtures: Config['fixtures']): string | null {
  let path = screen.path;
  for (const name of screen.fixtures ?? []) {
    const value = fixtures[name];
    if (!value) return null;
    path = path.replace(`:${name}`, value);
  }
  return path;
}

async function login(appUrl: string): Promise<void> {
  console.log('🔑 Opening a window. Sign in with Google, then come back here.');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  // Signed in is "we are no longer on a sign-in surface and the shell rendered".
  // Polling beats a fixed wait: a human takes as long as a human takes.
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    const url = page.url();
    if (url.startsWith(appUrl) && !/\/login|accounts\.google\.com/.test(url)) {
      const hasShell = await page.locator('nav, [data-slot="sidebar"], main').first().count();
      if (hasShell) break;
    }
  }

  mkdirSync(dirname(AUTH_STATE), { recursive: true });
  await context.storageState({ path: AUTH_STATE });
  console.log(`✅ Saved the session to ${AUTH_STATE}`);
  await browser.close();
}

async function shoot(
  context: BrowserContext,
  screen: Screen,
  path: string,
  appUrl: string,
  variant: Variant
): Promise<void> {
  const page = await context.newPage();
  try {
    await page.goto(`${appUrl}${path}`, { waitUntil: 'networkidle', timeout: 30_000 });
    // The shell animates in and data arrives a beat later; a settle beats
    // racing a skeleton, which is exactly the "confident loading state"
    // problem the UI audit flagged.
    await page.waitForTimeout(2500);
    const out = resolve(OUT_DIR, `${screen.id}.${variant}.png`);
    await page.screenshot({ path: out, fullPage: variant === 'mobile' });
    console.log(`  📸 ${screen.id}.${variant}.png`);
  } catch (error) {
    console.warn(`  ⚠️  ${screen.id} (${variant}): ${(error as Error).message.split('\n')[0]}`);
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const args = process.argv.slice(2);

  if (args.includes('--login')) {
    await login(config.appUrl);
    return;
  }

  const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length);
  const variants: Variant[] = args.includes('--mobile-only')
    ? ['mobile']
    : (['mobile', 'desktop'] as Variant[]);

  mkdirSync(OUT_DIR, { recursive: true });

  const wanted = only ? SCREENS.filter((s) => only.split(',').includes(s.id)) : SCREENS;
  const needsAuth = wanted.some((s) => s.auth === 'org');

  if (needsAuth && !existsSync(AUTH_STATE)) {
    console.error(
      `❌ No saved session at ${AUTH_STATE}.\n` +
        '   Run `bun scripts/capture-screens.ts --login` first, or pass --only= with public screens.'
    );
    process.exitCode = 1;
    return;
  }

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();

    for (const variant of variants) {
      const signedIn = needsAuth
        ? await browser.newContext({
            viewport: VIEWPORTS[variant],
            storageState: AUTH_STATE,
            colorScheme: 'dark',
          })
        : undefined;
      // Deliberately separate: a public page must be proved to work with no
      // session, not merely to work.
      const anonymous = await browser.newContext({
        viewport: VIEWPORTS[variant],
        colorScheme: 'dark',
      });

      console.log(`\n🖼  ${variant} (${VIEWPORTS[variant].width}×${VIEWPORTS[variant].height})`);

      for (const screen of wanted) {
        const path = resolvePath(screen, config.fixtures);
        if (!path) {
          console.warn(
            `  ⏭  ${screen.id} — needs ${screen.fixtures?.join(', ')} in capture.config.json`
          );
          continue;
        }
        const context = screen.auth === 'org' ? signedIn! : anonymous;
        await shoot(context, screen, path, config.appUrl, variant);
      }

      await anonymous.close();
      await signedIn?.close();
    }
  } finally {
    await browser?.close();
  }

  console.log(`\n✅ Done. ${OUT_DIR}`);
}

await main();
