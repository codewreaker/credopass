import React, { useState } from 'react';
import { Mail, Phone, CalendarDays, Fingerprint, Check } from 'lucide-react';
import { usePerson, type PersonRow } from '@credopass/api-client';
import { cn } from '@credopass/ui/lib/utils';

interface ProfileViewProps {
    /** The row the list handed over — enough to render before the fetch lands. */
    data: PersonRow | null | undefined;
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

/**
 * One attendee, in the right rail.
 *
 * The billboard used to show loyalty points, a tier ladder and a twelve-bar
 * "attendance history" generated from a hash of the member id. All three were
 * invented. What replaces them is `GET /people/{id}` — two real numbers,
 * registered and attended, counted server-side.
 */
const ProfileView: React.FC<ProfileViewProps> = ({ data }) => {
    const { data: person } = usePerson(data?.id);

    if (!data) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <p>No data to display</p>
            </div>
        );
    }

    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown attendee';
    const joined = person?.createdAt
        ? new Date(person.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : null;

    const attended = person?.stats.eventsAttended ?? data.eventsAttended;
    const registered = person?.stats.eventsRegistered ?? null;
    const attendanceRate =
        registered && registered > 0 ? Math.round((attended / registered) * 100) : null;

    return (
        <div className="flex flex-col gap-4">
            {/* Lime billboard — real counts only */}
            <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-4">
                <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full border-14 border-primary-foreground/8" />
                <p className="relative z-10 truncate text-sm font-semibold">{fullName}</p>
                <div className="relative z-10 mt-3 flex items-end justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-1">
                            Events attended
                        </p>
                        <p className="text-3xl font-semibold tracking-tight leading-none tabular-nums">{attended}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-1">
                            {attendanceRate !== null ? 'Turn-up rate' : 'Registered'}
                        </p>
                        <p className="text-lg font-semibold leading-none tabular-nums">
                            {attendanceRate !== null ? `${attendanceRate}%` : (registered ?? '—')}
                        </p>
                    </div>
                </div>
                {registered !== null && (
                    <p className="relative z-10 mt-3 text-[11px] font-medium text-primary-foreground/60 tabular-nums">
                        {attended} of {registered} events they signed up for
                    </p>
                )}
            </div>

            {/* Details — personal data masked, tap to copy */}
            <div className="rounded-xl border border-border divide-y divide-border bg-card">
                <DetailRow icon={<Mail size={13} />} label="Email" value={data.email} sensitive />
                <DetailRow icon={<Phone size={13} />} label="Phone" value={data.phone} sensitive />
                <DetailRow icon={<CalendarDays size={13} />} label="On the roll since" value={joined} />
                <DetailRow icon={<Fingerprint size={13} />} label="Attendee ID" value={data.id} mono sensitive />
            </div>

            {person?.notes && (
                <div className="rounded-xl border border-border bg-card px-3.5 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">{person.notes}</p>
                </div>
            )}
        </div>
    );
};

export default ProfileView;
