// ============================================================================
// FILE: packages/lib/src/schemas/organization-name.ts
// The one published organiser-controlled string, and how to tell if it is real.
// ============================================================================

/**
 * `organizations.name` is the only organiser-controlled string that reaches
 * strangers: it is on the public event page and on every attendee's pass.
 * Attendees SHOULD see it — somebody deciding whether to turn up wants to know
 * who is running the thing, which is why every events product shows a host.
 *
 * The problem was never that it is published. It is that for a long time
 * nobody chose it. The default used to be `` `${who}'s organization` ``, built
 * from the account's own first name, and before that fix it had already
 * written rows like `Israel's organization` — which is not an organisation,
 * it is a person with a noun stapled on, and it reads to an invitee as a
 * placeholder somebody forgot to fill in.
 *
 * So the fix is to get a real name chosen, not to hide the field. This
 * predicate is what the console uses to know it should ask.
 */

/** What a brand-new organisation is called until somebody renames it. */
export const DEFAULT_ORGANIZATION_NAME = 'My organization';

/**
 * Was this name generated for the owner rather than chosen by them?
 *
 * Shared by the API and the web app deliberately: the server uses it to decide
 * whether to nag, the console uses it to render the nag, and a second copy of
 * the rule would drift. Pure, no dependencies, so `services/core` can import it
 * without pulling React in.
 *
 * It over-matches on purpose. A real organisation genuinely called
 * "Dave's Organization" is flagged too — the cost is one dismissible prompt
 * suggesting a rename, which is a much smaller harm than never prompting the
 * thousands of accounts whose name really is a leftover.
 */
export function isGeneratedOrganizationName(name: string | null | undefined): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (trimmed.toLowerCase() === DEFAULT_ORGANIZATION_NAME.toLowerCase()) return true;
  // The legacy shape: anything + "'s organization". Both apostrophes, because
  // the generator wrote a straight one and a rename can round-trip a curly.
  return /^.+['’]s organi[sz]ation$/i.test(trimmed);
}
