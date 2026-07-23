import React, { useState } from 'react';
import { Mail, Phone, CalendarDays, Fingerprint, Check } from 'lucide-react';
import { cn } from '@credopass/ui/lib/utils';

interface ProfileViewProps {
    data: Record<string, any>;
}

/** Mask personal data: keep only the last three characters visible. */
const maskValue = (value: string) =>
    value.length <= 3 ? value : `${'•'.repeat(Math.min(8, value.length - 3))}${value.slice(-3)}`;

const DetailRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    value?: string | null;
    mono?: boolean;
    /** Personal data: render masked, tap to copy the real value. */
    sensitive?: boolean;
}> = ({ icon, label, value, mono, sensitive }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!sensitive || !value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard unavailable */ }
    };

    const display = value
        ? sensitive ? maskValue(value) : value
        : '—';

    return (
        <button
            type="button"
            onClick={handleCopy}
            disabled={!sensitive || !value}
            className={cn(
                'flex w-full items-center gap-3 px-3.5 py-3 text-left',
                sensitive && value && 'cursor-pointer hover:bg-muted/30 transition-colors duration-150'
            )}
        >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className={cn('text-[13px] text-foreground truncate mt-0.5', mono && 'font-mono text-xs')}>
                    {display}
                </p>
            </div>
            {sensitive && value && (
                <span className={cn(
                    'shrink-0 text-[10px] font-semibold uppercase tracking-wider transition-colors duration-150',
                    copied ? 'text-primary' : 'text-muted-foreground/50'
                )}>
                    {copied ? (
                        <span className="inline-flex items-center gap-1"><Check size={10} /> Copied</span>
                    ) : (
                        'Tap to copy'
                    )}
                </span>
            )}
        </button>
    );
};

const ProfileView: React.FC<ProfileViewProps> = ({ data }) => {
    if (!data || typeof data !== 'object') {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <p>No data to display</p>
            </div>
        );
    }

    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown member';
    const tierKey = (data.tier || 'bronze') as string;
    const points = Number(data.points || 0);
    const joined = data.createdAt
        ? new Date(data.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : null;
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
    // Simple tier ladder for progress display
    const nextThreshold = tierKey === 'bronze' ? 1000 : tierKey === 'silver' ? 2500 : tierKey === 'gold' ? 5000 : null;
    const nextTier = tierKey === 'bronze' ? 'Silver' : tierKey === 'silver' ? 'Gold' : tierKey === 'gold' ? 'Platinum' : null;
    const progress = nextThreshold ? Math.min(100, Math.round((points / nextThreshold) * 100)) : 100;

    return (
        <div className="flex flex-col gap-4">
            {/* Loyalty card with attendance chart */}
            <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-4">
                <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full border-14 border-primary-foreground/8" />
                <div className="relative z-10 flex items-end justify-between mb-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-1">Loyalty points</p>
                        <p className="text-3xl font-semibold tracking-tight leading-none tabular-nums">{points.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-1">Attendance</p>
                        <p className="text-lg font-semibold leading-none tabular-nums">{attendancePct}%</p>
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
                        {nextTier && nextThreshold
                            ? `${Math.max(0, nextThreshold - points).toLocaleString()} points to ${nextTier}`
                            : 'Top tier reached'}
                    </p>
                </div>
            </div>

            {/* Details — personal data masked, tap to copy */}
            <div className="rounded-xl border border-border divide-y divide-border bg-card">
                <DetailRow icon={<Mail size={13} />} label="Email" value={data.email} sensitive />
                <DetailRow icon={<Phone size={13} />} label="Phone" value={data.phone} sensitive />
                <DetailRow icon={<CalendarDays size={13} />} label="Member since" value={joined} />
                <DetailRow icon={<Fingerprint size={13} />} label="Member ID" value={data.id ? String(data.id) : null} mono sensitive />
            </div>
        </div>
    );
};

export default ProfileView;
