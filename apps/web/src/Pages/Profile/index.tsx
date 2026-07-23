import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { LogOut, ShieldCheck, UserRound, ChevronRight, Building2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@credopass/ui/components/avatar';
import { Button } from '@credopass/ui/components/button';
import { Card } from '@credopass/ui/components/card';
import { UpgradeCTA } from '@credopass/ui/components/upgrade-cta';
import { useToolbarContext } from '@credopass/lib/hooks';
import { supabase } from '../../supabase';
import OrganizationsPage from '../Organizations';

interface SessionInfo {
    email: string | null;
    isAnonymous: boolean;
}

export default function ProfilePage() {
    const navigate = useNavigate();
    const [session, setSession] = useState<SessionInfo | null>(null);

    useToolbarContext({
        action: null,
        search: { enabled: false, placeholder: '' },
    });

    useEffect(() => {
        let cancelled = false;
        supabase.auth.getSession().then(({ data }) => {
            if (cancelled) return;
            const user = data.session?.user;
            setSession({
                email: user?.email ?? null,
                isAnonymous: !!(user as any)?.is_anonymous || !user?.email,
            });
        });
        return () => { cancelled = true; };
    }, []);

    const handleSignOut = useCallback(async () => {
        await supabase.auth.signOut();
        navigate({ to: '/login', search: { manual: true, view: 'social', out: true } });
    }, [navigate]);

    const displayName = session?.isAnonymous ? 'Guest' : (session?.email?.split('@')[0] ?? 'Member');
    const initial = (displayName[0] || 'G').toUpperCase();

    return (
        <div className="flex flex-col gap-6">
            {/* Account */}
            <div>
                <h1 className="text-2xl font-semibold tracking-tight mb-0.5">Profile</h1>
                <p className="text-sm text-muted-foreground">Your account and organizations</p>
            </div>

            <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <Avatar className="size-12 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{initial}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {session?.email ?? 'Guest session — progress isn’t saved'}
                        </p>
                        <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {session?.isAnonymous ? <UserRound size={9} /> : <ShieldCheck size={9} className="text-primary" />}
                            {session?.isAnonymous ? 'Guest account' : 'Verified account'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {session?.isAnonymous && (
                        <Button
                            size="sm"
                            className="rounded-full font-semibold"
                            onClick={() => navigate({ to: '/upgrade' })}
                        >
                            Create free account
                            <ChevronRight size={13} />
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full gap-1.5 text-destructive hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5"
                        onClick={handleSignOut}
                    >
                        <LogOut size={13} />
                        Sign out
                    </Button>
                </div>
            </Card>

            {/* Pro upsell */}
            <UpgradeCTA
                size="lg"
                title="Go Pro"
                description="Unlimited events, advanced analytics and priority support."
                onClick={() => navigate({ to: '/upgrade' })}
            />

            {/* Organizations */}
            <div className="flex items-center gap-2 pt-1">
                <Building2 size={14} className="text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Organizations</h2>
            </div>
            <OrganizationsPage embedded />
        </div>
    );
}
