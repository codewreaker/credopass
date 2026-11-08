/**
 * `isGeneratedOrganizationName` — the gate on asking the owner to pick a name.
 *
 * `organizations.name` is published: it is on the public event page and on
 * every attendee's pass, and it SHOULD be — an invitee wants to know who is
 * running the event. The problem was that for a long time nobody chose it. The
 * default used to be `` `${who}'s organization` ``, built from the account's
 * own first name, which reads to an invitee as a placeholder somebody forgot.
 *
 * So this does not decide what to publish. It decides whether the console
 * nags, which is why it may over-match: a real "Dave's Organization" gets one
 * dismissible prompt, and that is a far smaller harm than never prompting the
 * accounts whose name really is a leftover.
 */

import { describe, expect, it } from 'bun:test';
import { isGeneratedOrganizationName } from '@credopass/lib/schemas/organization-name';

describe('isGeneratedOrganizationName', () => {
  it('catches the current default', () => {
    expect(isGeneratedOrganizationName('My organization')).toBe(true);
    expect(isGeneratedOrganizationName('my organization')).toBe(true);
    expect(isGeneratedOrganizationName('  My organization  ')).toBe(true);
  });

  it('catches the legacy personal-name default, which is what prompted this', () => {
    expect(isGeneratedOrganizationName("Israel's organization")).toBe(true);
    expect(isGeneratedOrganizationName("israel.agyeman.prempeh's organization")).toBe(true);
    expect(isGeneratedOrganizationName("Ada's Organization")).toBe(true);
    // American spelling too — the generator is not the only thing that writes
    // this shape, and a rename may have normalised it.
    expect(isGeneratedOrganizationName("Ada's Organisation")).toBe(true);
  });

  it('catches the curly apostrophe a rename can round-trip', () => {
    expect(isGeneratedOrganizationName('Israel\u2019s organization')).toBe(true);
  });

  it('treats an absent or blank name as needing one', () => {
    expect(isGeneratedOrganizationName(null)).toBe(true);
    expect(isGeneratedOrganizationName(undefined)).toBe(true);
    expect(isGeneratedOrganizationName('   ')).toBe(true);
  });

  it('leaves a name somebody actually chose alone', () => {
    for (const name of [
      'Kharis Church',
      'Fitness Club',
      'The Organization',
      'Organization of Islamic Cooperation',
      'My organization but renamed',
      'Prempeh Organization',
    ]) {
      expect(isGeneratedOrganizationName(name)).toBe(false);
    }
  });
});
