---
name: Vite watcher on Replit monorepos
description: How to configure Vite's file watcher to stay stable in Replit's large monorepo environment.
---

## Rule
`usePolling: true` alone is not sufficient — the chokidar polling daemon crashes with "Daemon closed the connection" if the watched scope is too large. You must also exclude irrelevant workspace directories explicitly.

**Why:** Replit's container resource limits cause the chokidar polling daemon to die when it tries to track too many paths, even without inotify. A large Nx monorepo (apps, services, packages, node_modules siblings) easily exceeds this.

**How to apply:** In `vite.config.ts` `server.watch`, combine `usePolling: true` with `useFsEvents: false` and an `ignored` list that excludes everything outside the relevant source trees:

```ts
watch: {
  usePolling: true,
  useFsEvents: false,
  interval: 1500,
  binaryInterval: 3000,
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/.cache/**',
    // Exclude other monorepo apps/services not being developed
    '**/apps/mobile/**',
    '**/apps/website/**',
    '**/services/**',
    '**/docker/**',
    '**/.nx/**',
  ],
},
```

Adjust the ignored list to match whichever sub-apps/services are NOT the current focus.
