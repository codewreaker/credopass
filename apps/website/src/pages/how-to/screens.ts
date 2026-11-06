/**
 * Every screen in the product, once.
 *
 * This list is the single source for two things that must not drift apart:
 *
 *   1. `scripts/capture-screens.ts` — walks `path` and writes `shot`.
 *   2. `HowTo.tsx` — renders the same entries as the how-to reference.
 *
 * So a screen cannot appear on the page without a screenshot, and a screenshot
 * cannot go stale without the page noticing. Adding a screen to the product
 * means adding a row here; the capture script then tells you it is missing.
 *
 * `auth` says what the capture needs:
 *   'none'  — a public URL, captured with no session at all
 *   'org'   — a signed-in member of an organisation
 *
 * `fixture` names a value the capture run has to substitute into `path`
 * (an event id, a pass token). Those come from `capture.config.json`, which is
 * gitignored because it points at real rows.
 */

export type ScreenAuth = 'none' | 'org';

export interface Screen {
  /** Stable slug. Also the screenshot filename and the page anchor. */
  id: string;
  /** Route in `apps/web`, with `:fixture` placeholders. */
  path: string;
  /** What the user calls it. */
  title: string;
  /** One line: what this screen is FOR. */
  purpose: string;
  /** What you can actually do here. Kept short and literal. */
  actions: string[];
  /** Grouping on the how-to page. */
  group: 'Getting started' | 'Events' | 'At the door' | 'Attendees' | 'Account' | 'For attendees';
  auth: ScreenAuth;
  /** Placeholders in `path` that need a real id. */
  fixtures?: ('eventId' | 'passToken' | 'personId' | 'inviteToken')[];
  /** Notes worth saying out loud — gotchas, or things people get wrong. */
  note?: string;
}

export const SCREENS: readonly Screen[] = [
  // ---------------------------------------------------------------- start
  {
    id: 'sign-in',
    path: '/login',
    title: 'Sign in',
    purpose: 'Google is the only way in. Signing in for the first time also creates your organisation.',
    actions: ['Continue with Google'],
    group: 'Getting started',
    auth: 'none',
    note: 'There is no separate onboarding step and no password to forget. Your first sign-in commissions an organisation for you.',
  },
  {
    id: 'command-palette',
    path: '/',
    title: 'Command palette',
    purpose: 'Every screen and action from the keyboard.',
    actions: ['⌘K to open', 'Type to filter', 'G then E for events, G then A for analytics'],
    group: 'Getting started',
    auth: 'org',
    note: 'Navigation shortcuts are chords — G, then a letter — so they never collide with ⌘A, ⌘C or ⌘V while you are typing.',
  },

  // --------------------------------------------------------------- events
  {
    id: 'events',
    path: '/events',
    title: 'Events — where you land',
    purpose:
      'The home screen. What is next, what is running now, and everything you have already run.',
    actions: [
      'See what is up next',
      'Check in guests straight from the card',
      'Filter upcoming or past',
      'Switch to calendar view',
      'Create a new event',
    ],
    group: 'Events',
    auth: 'org',
    note: 'Signing in takes you here — / redirects to /events. There is no separate dashboard.',
  },
  {
    id: 'event-new',
    path: '/events/new',
    title: 'Create an event',
    purpose: 'Name it, say where and when, choose how the door will work.',
    actions: ['Name the event', 'Set date and time', 'Pick a location', 'Set a capacity', 'Allow self check-in'],
    group: 'Events',
    auth: 'org',
    note: 'This page renders without a session, with sign-in on top. Creating the event is what requires an organisation.',
  },
  {
    id: 'event-detail',
    path: '/events/:eventId',
    title: 'Event detail',
    purpose: 'The live picture of one event: who registered, who actually turned up.',
    actions: ['Register someone', 'Open the door kiosk', 'Share the public link', 'Copy the check-in code'],
    group: 'Events',
    auth: 'org',
    fixtures: ['eventId'],
    note: 'Registering does not check anyone in. An attendance record means they actually turned up.',
  },
  {
    id: 'event-edit',
    path: '/events/:eventId/edit',
    title: 'Edit an event',
    purpose: 'Change the details after it exists.',
    actions: ['Rename it in the billboard itself', 'Move the date — the end moves with the start', 'Change the venue or description', 'Set a capacity', 'Turn self check-in on or off', 'Add a photo'],
    group: 'Events',
    auth: 'org',
    fixtures: ['eventId'],
  },

  // ---------------------------------------------------------- at the door
  {
    id: 'kiosk',
    path: '/checkin/:eventId',
    title: 'The door kiosk',
    purpose: 'What you put on a tablet at the entrance.',
    actions: ['Show the event QR for attendees to scan', 'Scan passes', 'Check someone in by name', 'Add a walk-in'],
    group: 'At the door',
    auth: 'org',
    fixtures: ['eventId'],
    note: 'A door tablet is just a person signed in with the check-in role. There is no device pairing and no device token.',
  },

  // ------------------------------------------------------------ attendees
  {
    id: 'attendees',
    path: '/attendees',
    title: 'Attendees',
    purpose: 'Everyone your organisation knows, across every event.',
    actions: ['Search', 'Open a person', 'Add someone'],
    group: 'Attendees',
    auth: 'org',
  },
  {
    id: 'attendee-new',
    path: '/attendees/new',
    title: 'Add an attendee',
    purpose: 'Put a person in your organisation before the event, so the door is faster.',
    actions: ['Name and email', 'Save'],
    group: 'Attendees',
    auth: 'org',
  },
  {
    id: 'attendee-edit',
    path: '/attendees/:personId/edit',
    title: 'Edit an attendee',
    purpose: 'Correct a name or email.',
    actions: ['Change details', 'Save'],
    group: 'Attendees',
    auth: 'org',
    fixtures: ['personId'],
  },
  {
    id: 'analytics',
    path: '/analytics',
    title: 'Analytics',
    purpose: 'Attendance over time, per event and per person.',
    actions: ['Pick a range', 'Read attendance rates'],
    group: 'Attendees',
    auth: 'org',
    note: 'The numbers are generated, not measured. The screen says so at the top: don\'t report anything from this page yet.',
  },

  // -------------------------------------------------------------- account
  {
    id: 'account-profile',
    path: '/account?tab=profile',
    title: 'Your profile',
    purpose: 'Who you are in CredoPass.',
    actions: ['See your name, email and plan'],
    group: 'Account',
    auth: 'org',
  },
  {
    id: 'account-organizations',
    path: '/account?tab=organizations',
    title: 'Organisations',
    purpose: 'Every organisation you belong to, and which one you are working in.',
    actions: ['Switch the active organisation', 'Create another one'],
    group: 'Account',
    auth: 'org',
  },
  {
    id: 'account-members',
    path: '/account?tab=members',
    title: 'Members',
    purpose: 'Who can do what in this organisation.',
    actions: ['Invite someone by email and role', 'Copy the invitation link and send it yourself', 'Change a role', 'Remove a member'],
    group: 'Account',
    auth: 'org',
    note: 'Roles: owner, admin, member, viewer, check-in. The check-in role is what a door tablet signs in as.',
  },
  {
    id: 'account-settings',
    path: '/account?tab=settings',
    title: 'Organisation settings',
    purpose: 'Name, defaults and plan for the organisation itself.',
    actions: ['Rename the organisation', 'Set defaults', 'See your plan'],
    group: 'Account',
    auth: 'org',
  },
  {
    id: 'upgrade',
    path: '/upgrade',
    title: 'Plans',
    purpose: 'What each plan includes.',
    actions: ['Compare plans', 'Start a checkout'],
    group: 'Account',
    auth: 'org',
  },

  // --------------------------------------------------------- for attendees
  {
    id: 'public-event',
    path: '/e/:eventId',
    title: 'The public event page',
    purpose: 'The link you share. Works with no account and no app.',
    actions: ['Read the details', 'Register with a name and email'],
    group: 'For attendees',
    auth: 'none',
    fixtures: ['eventId'],
  },
  {
    id: 'pass',
    path: '/p/:passToken',
    title: 'An attendee pass',
    purpose: 'What someone shows at the door. The link itself is the credential.',
    actions: ['Show the QR at the door', 'Check in yourself, if the event allows it'],
    group: 'For attendees',
    auth: 'none',
    fixtures: ['passToken'],
    note: 'No email exists yet, so this link is shown on screen at the moment of registration — it is the only copy. It is built from PUBLIC_APP_URL, not from the API host.',
  },
  {
    id: 'invitation',
    path: '/invitations/:inviteToken',
    title: 'Accepting an invitation',
    purpose: 'How a colleague joins your organisation.',
    actions: ['Sign in with Google', 'Accept'],
    group: 'For attendees',
    auth: 'none',
    fixtures: ['inviteToken'],
  },
];

export const GROUPS = [
  'Getting started',
  'Events',
  'At the door',
  'Attendees',
  'Account',
  'For attendees',
] as const;

/** Where a screen's capture lands, relative to the site root. */
export const shotPath = (id: string, variant: 'mobile' | 'desktop' = 'mobile'): string =>
  `/how-to/${id}.${variant}.png`;
