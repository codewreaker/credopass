import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off"
    }
  },

  // -------------------------------------------------------------------------
  // Structural rules for the API-first rebuild.
  // docs/API-FIRST-REBUILD.md §1.1 (rules 1 and 3) and §7.1.
  //
  // These are not style preferences. Each one closes an architectural hole that
  // would otherwise be enforced only by everyone remembering it.
  // -------------------------------------------------------------------------

  // Rule 3 — domain logic has no framework imports. A service that can reach
  // Hono's `Context` can reach the request, and a service that can reach the
  // request can read a tenant id off the payload. Keeping the framework out is
  // what makes "the tenant comes from the token" structurally true.
  {
    files: ['services/core/src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'hono', message: 'Domain services must not import the HTTP framework (§1.1 rule 3). Take what you need as an argument.' },
          { name: 'hono/factory', message: 'Domain services must not import the HTTP framework (§1.1 rule 3).' },
          { name: 'hono/http-exception', message: 'Throw ProblemError from src/http/problem instead (§5.0).' },
          { name: '@hono/zod-openapi', message: 'Domain services must not import the HTTP framework (§1.1 rule 3).' },
        ],
        patterns: [
          { group: ['hono/*'], message: 'Domain services must not import the HTTP framework (§1.1 rule 3).' },
        ],
      }],
    },
  },

  // Rule 1 — a route handler may not manufacture its own tenant. `TenantContext`
  // is produced by the tenant middleware and handed down; a handler that imports
  // the constructor can forge one from the request body, which is precisely the
  // bug the brand exists to prevent.
  {
    files: ['services/core/src/routes/**/*.ts', 'services/core/src/api/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/tenancy/context'],
            importNames: ['createTenantContext', 'createAccountContext'],
            message: 'Only the tenant middleware constructs a TenantContext (§7.1). Handlers receive one.',
          },
          {
            group: ['@credopass/lib/schemas/tables', '**/schemas/tables'],
            message: 'Reach tenant-scoped tables through scoped(db, ctx) in src/db/scoped (§7.1), never the table objects directly.',
          },
        ],
      }],
    },
  },
])
