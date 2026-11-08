/**
 * `isGeneratedOrganizationName` — the gate on the one organiser-controlled
 * string that reaches strangers.
 *
 * `organizations.name` is published: it is on the public event page and on
 * every attendee's pass. The default used to be `` `${who}'s organization` ``,
 * built from the account's own first name or email local part, so a host who
 * never opened Settings was publishing their personal name to everyone they
 * invited. The generator was fixed; the rows it had already written were
 * deliberately left alone, because renaming somebody's organisation is their
 * decision. This predicate closes the gap from the publishing end.
 *
 * The asymmetry under test: a false positive costs a real organisation its
 * label until someone renames it, a false negative publishes a name nobody
 * chose. The second is worse, so the ambiguous case must be suppressed.
 */

import { describe, expect, it } from 'bun:test';
import { isGeneratedOrganizationName } from '../services/membership';

describe('isGeneratedOrganizationName', () => {
  it('catches the current default', () => {
    expect(isGeneratedOrganizationName('My organization')).toBe(true);
    expect(isGeneratedOrganizationName('my organization')).toBe(true);
    expect(isGeneratedOrganizationName('  My organization  ')).toBe(true);
  });

  it('catches the legacy personal-name default, which is the actual leak', () => {
    expect(isGeneratedOrganizationName("Israel's organization")).toBe(true);
    expect(isGeneratedOrganizationName("israel.agyeman.prempeh's organization")).toBe(true);
    expect(isGeneratedOrganizationName("Ada's Organization")).toBe(true);
  });

  it('catches the curly apostrophe a rename can round-trip', () => {
    expect(isGeneratedOrganizationName('Israel’s organization')).toBe(true);
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

  it("suppresses a genuine possessive name, and that is the intended trade", () => {
    // "Dave's Organization" is a plausible real name and loses its label until
    // renamed. Publishing a personal name nobody chose is the worse failure,
    // so the ambiguous case is resolved against publishing.
    expect(isGeneratedOrganizationName("Dave's Organization")).toBe(true);
  });
});
