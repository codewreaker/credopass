import { createFileRoute } from '@tanstack/react-router';
import UpgradePage from '../../Pages/Upgrade';
import { requireAuth } from '../../lib/auth-guard';

/**
 * `beforeLoad: requireAuth` is new. The old flat `/upgrade` route had no guard,
 * a leftover from when this screen was a guest-conversion page (D20). It now
 * reads the caller's organization and its plan, so a signed-out visitor would
 * only ever see an empty shell — send them to sign in instead.
 */
export const Route = createFileRoute('/upgrade/')({
  beforeLoad: requireAuth,
  component: UpgradePage,
});
