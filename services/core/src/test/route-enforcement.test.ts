/**
 * Declaring a permission and ENFORCING one are two different things, and until
 * now nothing checked that they agreed.
 *
 * `defineRoute` records `permission` in the authz registry and the boot
 * assertion validates that declaration — but the actual check is a separate
 * `middleware: [requirePermission(...)]` line, and the boot assertion cannot
 * see whether it is there. Two routes had drifted: `GET /organizations/{id}`
 * and `GET /media/recent` declared a permission and enforced nothing. Both were
 * harmless in practice, because every role holds the permission they named —
 * which is exactly why nobody noticed, and exactly why it would have bitten the
 * first time either permission was tightened.
 *
 * This reads the route sources rather than the registry, because the thing
 * being asserted is a property of how the route is written.
 */

import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSIGNABLE_ORG_ROLES, ORG_ROLES } from '../authz/permissions';

const ROUTE_DIR = join(import.meta.dir, '..', 'api', 'v1', 'core');

interface Block {
  file: string;
  body: string;
  method: string;
  path: string;
}

/** Every `defineRoute({ ... })` literal in the route files, crudely but reliably. */
function routeBlocks(): Block[] {
  const blocks: Block[] = [];

  for (const file of readdirSync(ROUTE_DIR).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(ROUTE_DIR, file), 'utf8');

    // Split on the opening token and take everything up to the handler, which
    // is the `}),` that closes the defineRoute call.
    for (const chunk of source.split('defineRoute({').slice(1)) {
      const end = chunk.indexOf('\n  }),');
      const body = end === -1 ? chunk : chunk.slice(0, end);

      blocks.push({
        file,
        body,
        method: /method:\s*'([a-z]+)'/.exec(body)?.[1] ?? '?',
        path: /path:\s*'([^']+)'/.exec(body)?.[1] ?? '?',
      });
    }
  }

  return blocks;
}

describe('permission enforcement matches permission declaration', () => {
  const blocks = routeBlocks();

  it('finds every route declaration', () => {
    expect(blocks.length).toBe(51);
  });

  it('every organization-scoped route enforces the permission it declares', () => {
    const unenforced: string[] = [];

    for (const b of blocks) {
      if (!b.body.includes("scope: 'organization'")) continue;

      const declared = /permission:\s*'([^']+)'/.exec(b.body)?.[1];
      const enforced = /requirePermission\('([^']+)'\)/.exec(b.body)?.[1];

      if (declared !== enforced) {
        unenforced.push(
          `${b.method.toUpperCase()} ${b.path} (${b.file}) declares ${declared ?? 'nothing'} but enforces ${enforced ?? 'nothing'}`
        );
      }
    }

    expect(unenforced).toEqual([]);
  });

  it('no route outside the organization scope enforces a permission', () => {
    const wrong = blocks
      .filter((b) => !b.body.includes("scope: 'organization'"))
      .filter((b) => b.body.includes('requirePermission('))
      .map((b) => `${b.method.toUpperCase()} ${b.path} (${b.file})`);

    expect(wrong).toEqual([]);
  });

  it('no route lets a client choose its own primary key', () => {
    const offenders = blocks
      .filter((b) => /\bid:\s*z\.string\(\)\.uuid\(\)\.optional\(\)/.test(b.body))
      .map((b) => `${b.method.toUpperCase()} ${b.path} (${b.file})`);

    // POST /events still honours a client UUID through a different shape; this
    // guards the request-body form that POST /organizations had.
    expect(offenders).toEqual([]);
  });
});

describe('assignable roles (the viewer reduction)', () => {
  it('offers four assignable roles, as a strict chain', () => {
    expect([...ASSIGNABLE_ORG_ROLES]).toEqual(['owner', 'admin', 'organizer', 'checkin']);
  });

  it('still resolves viewer, because the column default and the PG enum hold it', () => {
    expect(ORG_ROLES).toContain('viewer');
  });

  it('never lets viewer be assigned through a request body', () => {
    const bodies = routeBlocks()
      .filter((b) => b.body.includes('body:') && b.body.includes('Role'))
      .map((b) => b.body)
      .join('\n');

    // Request bodies must reach for the assignable set, never the full one.
    expect(bodies).not.toContain('role: RoleSchema');
  });
});
