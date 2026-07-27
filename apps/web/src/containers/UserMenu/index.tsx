/**
 * The avatar in the top bar — the console's shortcut to *you*.
 *
 * The split with `OrgSelector` is deliberate and is the reason this exists at
 * all: the sidebar switcher is about the **organization** you are looking at,
 * this is about the **account** you are signed in as. Account items used to be
 * buried inside the org switcher, which meant "where is my profile?" was
 * answered by a control branded with the org's logo.
 *
 * Everything rendered here comes from `GET /me/context` (`useSession`) and
 * `GET /organizations` — nothing is held in local state, and nothing is
 * restated from a constant. The plan shown next to "Plan & billing" is the
 * active organization's, so the link doubles as the current-plan readout.
 */

import { CreditCard, LogOut, Moon, Settings, Sun, UserRound, Users } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { clearActiveOrganization, useOrganizations } from '@credopass/api-client';
import { useTheme } from '@credopass/lib/theme';
import { Avatar, AvatarFallback } from '@credopass/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@credopass/ui/components/dropdown-menu';
import { useCan, useSession } from '../../contexts/session';
import { supabase } from '../../supabase';

import './style.css';

/** "Israel Agyeman-Prempeh" → "IA". Falls back to the email's local part. */
export const initialsOf = (
  name: string | null | undefined,
  email: string | null | undefined
) => {
  const source = name?.trim() || email?.split('@')[0] || '';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'CP';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
};

export const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const { context, organizationId, isAuthLoading } = useSession();
  const canReadMembers = useCan('member:read');
  const { theme, toggleTheme } = useTheme();

  const { data: organizations = [] } = useOrganizations({ enabled: !!context });
  const account = context?.account;
  const activeOrganization = organizations.find((o) => o.id === organizationId) ?? null;

  // Signed out, or still replaying the persisted session: render nothing rather
  // than an avatar whose menu would 401 on every item.
  if (isAuthLoading || !account) return null;

  const name = account.displayName || account.email?.split('@')[0] || 'Your account';

  const signOut = async () => {
    await supabase.auth.signOut();
    clearActiveOrganization();
    navigate({ to: '/login', search: { view: 'social', out: true } });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            className="usermenu-trigger"
            aria-label={`Account — ${name}`}
            title={name}
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                {initialsOf(account.displayName, account.email)}
              </AvatarFallback>
            </Avatar>
          </button>
        )}
      />

      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-64 rounded-xl">
        {/* Who you are. Not a link — the items below are the destinations.
            `DropdownMenuLabel` is Base UI's `Menu.GroupLabel`, which reads
            `MenuGroupContext` to label its group for assistive tech — so it
            throws outside a `DropdownMenuGroup`. The wrapper is required, not
            decoration. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0">
            <div className="flex items-center gap-2.5 px-2 py-2.5">
              <Avatar className="size-9 border border-border">
                <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                  {initialsOf(account.displayName, account.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-semibold leading-none">{name}</span>
                <span className="truncate text-xs font-normal leading-none text-muted-foreground">
                  {account.email ?? 'Signed in'}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            className="gap-2 p-2"
            onClick={() => navigate({ to: '/account', search: { tab: 'profile' } })}
          >
            <UserRound className="size-4" />
            <span>Profile</span>
          </DropdownMenuItem>

          {/* Everyone can look at the plans; only an owner holds `org:billing`,
              and `/upgrade` says so rather than hiding the page. */}
          <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate({ to: '/upgrade' })}>
            <CreditCard className="size-4" />
            <span>Plan &amp; billing</span>
            {activeOrganization && (
              <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {activeOrganization.plan}
              </span>
            )}
          </DropdownMenuItem>

          {canReadMembers && (
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => navigate({ to: '/account', search: { tab: 'members' } })}
            >
              <Users className="size-4" />
              <span>Members</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            className="gap-2 p-2"
            onClick={() => navigate({ to: '/account', search: { tab: 'settings' } })}
          >
            <Settings className="size-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        {/* The theme was readable but not settable anywhere in the console —
            `ThemeProvider` has always exposed `toggleTheme`. Closing the menu on
            a theme change would be wrong, so this item keeps it open. */}
        <DropdownMenuItem
          className="gap-2 p-2"
          closeOnClick={false}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 p-2 text-destructive focus:text-destructive"
          onClick={signOut}
        >
          <LogOut className="size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
