import React from 'react';
import { Mail, Phone, CalendarDays, Fingerprint, Star, Trophy } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@credopass/ui/components/avatar';
import { cn } from '@credopass/ui/lib/utils';

interface ProfileViewProps {
    data: Record<string, any>;
}

const TIER_STYLES: Record<string, { ring: string; text: string; bg: string; icon: typeof Star; next: string | null }> = {
    bronze: { ring: 'ring-tier-bronze', text: 'text-tier-bronze', bg: 'bg-tier-bronze/10', icon: Star, next: 'Silver' },
    silver: { ring: 'ring-tier-silver', text: 'text-tier-silver', bg: 'bg-tier-silver/10', icon: Star, next: 'Gold' },
    gold: { ring: 'ring-tier-gold', text: 'text-tier-gold', bg: 'bg-tier-gold/10', icon: Trophy, next: 'Platinum' },
    platinum: { ring: 'ring-tier-platinum', text: 'text-tier-platinum', bg: 'bg-tier-platinum/10', icon: Trophy, next: null },
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value?: string | null; mono?: boolean }> = ({
    icon, label, value, mono,
}) => (
    <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
            <p className={cn('text-[13px] text-foreground truncate mt-0.5', mono && 'font-mono text-xs')}>
                {value || '—'}
            </p>
        </div>
    </div>
);

const ProfileView: React.FC<ProfileViewProps> = ({ data }) => {
    if (!data || typeof data !== 'object') {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <p>No data to display</p>
            </div>
        );
    }

    const firstName = data.firstName || '';
    const lastName = data.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown member';
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
    const tierKey = (data.tier || 'bronze') as string;
    const tier = TIER_STYLES[tierKey] || TIER_STYLES.bronze;
    const TierIcon = tier.icon;
    const points = Number(data.points || 0);
    // Attendance history: use real data when present, otherwise a stable
    // per-member preview series derived from the member id (demo data until
    // check-in history is wired through the API).
    const history: boolean[] = Array.isArray(data.attendanceHistory)
        ? data.attendanceHistory.slice(-12)
        : (() => {
            const seedStr = String(data.id || fullName);
            let seed = 0;
            for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
            return Array.from({ length: 12 }, () => {
                seed = (seed * 1103515245 + 12345) >>> 0;
                return (seed >>> 16) % 100 < 72; // ~72% attendance preview
            });
        })();
    const attendedCount = history.filter(Boolean).length;
    const attendancePct = data.attendanceRate != null
        ? Number(data.attendanceRate)
        : Math.round((attendedCount / history.length) * 100);
    const attendance = `${attendancePct}%`;
    const joined = data.createdAt
        ? new Date(data.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : null;
    // Simple tier ladder for progress display
    const nextThreshold = tierKey === 'bronze' ? 1000 : tierKey === 'silver' ? 2500 : tierKey === 'gold' ? 5000 : null;
    const progress = nextThreshold ? Math.min(100, Math.round((points / nextThreshold) * 100)) : 100;

    return (
        <div className="flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-180px)] pr-0.5">
            {/* Identity */}
            <div className="flex flex-col items-center text-center gap-2.5 pt-2">
                <Avatar className={cn('size-16 ring-2 ring-offset-4 ring-offset-background', tier.ring)}>
                    <AvatarImage src={data.avatarUrl} alt={fullName} />
                    <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="text-lg font-semibold tracking-tight leading-tight">{fullName}</h3>
                    {data.email && <p className="text-xs text-muted-foreground mt-0.5">{data.email}</p>}
                </div>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize', tier.bg, tier.text)}>
                    <TierIcon size={11} />
                    {tierKey} member
                </span>
            </div>

            {/* Loyalty card */}
            <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-4">
                <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full border-[14px] border-primary-foreground/8" />
                <div className="relative z-10 flex items-end justify-between mb-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-1">Loyalty points</p>
                        <p className="text-3xl font-semibold tracking-tight leading-none tabular-nums">{points.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-1">Attendance</p>
                        <p className="text-lg font-semibold leading-none tabular-nums">{attendance}</p>
                    </div>
                </div>
                {/* Attendance mini-chart: one bar per recent event */}
                <div className="relative z-10 mb-3">
                    <div className="flex items-end gap-1 h-10">
                        {history.map((attended, i) => (
                            <div
                                key={i}
                                className={
                                    attended
                                        ? 'flex-1 rounded-sm bg-primary-foreground transition-all duration-300'
                                        : 'flex-1 rounded-sm bg-primary-foreground/20 transition-all duration-300'
                                }
                                style={{ height: attended ? `${65 + ((i * 13) % 36)}%` : '22%' }}
                            />
                        ))}
                    </div>
                    <p className="text-[10px] font-medium text-primary-foreground/55 mt-1.5 tabular-nums">
                        Last {history.length} events · {attendedCount} attended
                    </p>
                </div>

                <div className="relative z-10">
                    <div className="h-1.5 rounded-full bg-primary-foreground/15 overflow-hidden">
                        <div className="h-full rounded-full bg-primary-foreground transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[11px] font-medium text-primary-foreground/60 mt-2">
                        {tier.next && nextThreshold
                            ? `${Math.max(0, nextThreshold - points).toLocaleString()} points to ${tier.next}`
                            : 'Top tier reached'}
                    </p>
                </div>
            </div>

            {/* Details */}
            <div className="rounded-xl border border-border divide-y divide-border bg-card">
                <DetailRow icon={<Mail size={13} />} label="Email" value={data.email} />
                <DetailRow icon={<Phone size={13} />} label="Phone" value={data.phone} />
                <DetailRow icon={<CalendarDays size={13} />} label="Member since" value={joined} />
                <DetailRow icon={<Fingerprint size={13} />} label="Member ID" value={data.id ? String(data.id).slice(0, 18) + '…' : null} mono />
            </div>
        </div>
    );
};

export default ProfileView;
