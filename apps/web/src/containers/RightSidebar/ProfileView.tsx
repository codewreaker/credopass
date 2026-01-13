import React from 'react';
import { Label } from '@credopass/ui/components/label';
import { Input } from '@credopass/ui/components/input';
import { Star } from 'lucide-react';

interface ProfileViewProps {
    data: Record<string, any>;
}

const getFieldType = (key: string, value: any): string => {
    if (value === null || value === undefined) return 'text';

    const keyLower = key.toLowerCase();

    // Check key patterns
    if (keyLower.includes('email')) return 'email';
    if (keyLower.includes('phone')) return 'tel';
    if (keyLower.includes('url') || keyLower.includes('website')) return 'url';
    if (keyLower.includes('password')) return 'password';
    if (keyLower.includes('date') || keyLower.includes('time') || keyLower === 'createdat' || keyLower === 'updatedat') {
        return 'timestamp';
    }

    // Check value type
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'string' && value.length > 0) {
        // Check if it's a UUID
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            return 'uuid';
        }
        // Check if it's an ISO date
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return 'timestamp';
        }
    }

    return 'text';
};

const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return '';

    if (type === 'timestamp') {
        try {
            const date = new Date(value);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            }).replace(',', '');
        } catch {
            return String(value);
        }
    }

    if (type === 'checkbox') {
        return value ? 'true' : 'false';
    }

    return String(value);
};

const getTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
        email: 'email',
        tel: 'phone',
        url: 'url',
        uuid: 'uuid',
        timestamp: 'timestamp',
        number: 'number',
        checkbox: 'boolean',
        text: 'text',
    };
    return typeMap[type] || 'text';
};

const ProfileView: React.FC<ProfileViewProps> = ({ data }) => {
    if (!data || typeof data !== 'object') {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <p>No data to display</p>
            </div>
        );
    }


    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const entries = Object.entries(data).filter(([_, value]) => {
        // Filter out complex objects and arrays for now
        return typeof value !== 'object' || value === null;
    });

    return (
        <>
            <div className="loyalty-card">
                <div className="card-header">
                    <Star className="star-icon" size={18} fill="var(--primary)" />
                    <h3>Loyalty Status</h3>
                </div>
                <div className="card-content">
                    <div className="loyalty-level">
                        <div className="level-badge">GOLD</div>
                        <p className="level-text">Member Level</p>
                    </div>
                    <div className="loyalty-stats">
                        <div className="stat-item">
                            <span className="stat-value">2,450</span>
                            <span className="stat-label">Points</span>
                        </div>
                        <div className="stat-divider" />
                        <div className="stat-item">
                            <span className="stat-value">89%</span>
                            <span className="stat-label">Attendance</span>
                        </div>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: '75%' }} />
                    </div>
                    <p className="progress-text">750 points to Platinum</p>
                </div>
            </div>
            <div className="flex flex-col gap-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {entries.map(([key, value]) => {
                    const fieldType = getFieldType(key, value);
                    const formattedValue = formatValue(value, fieldType);
                    const typeLabel = getTypeLabel(fieldType);
                    return (
                        <div className="grid gap-3">
                            <Label htmlFor={key}>{key}<span className="ml-auto text-xs text-muted-foreground font-mono">{typeLabel}</span></Label>
                            <Input
                                readOnly
                                type={fieldType === 'timestamp' || fieldType === 'uuid' ? 'text' : fieldType}
                                id={key} defaultValue={formattedValue} />
                        </div>
                    )
                })}
            </div>
        </>
    );
};

export default ProfileView;
