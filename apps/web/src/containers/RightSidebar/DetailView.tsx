import React from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@credopass/ui/components/input-group';
import { Label } from '@credopass/ui/components/label';
import { LucideXCircle } from 'lucide-react';

interface DetailViewProps {
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

export const DetailView: React.FC<DetailViewProps & { onClose: () => void }> = ({ data, onClose }) => {
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
            <div className="flex flex-row justify-between px-4 py-3 border-b border-border bg-(--background-darker)">
                <h3 className="text-foreground text-base font-semibold m-0">Details</h3>
                <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground">
                    <LucideXCircle size={18} />
                </button>
            </div>
            <div className="p-3 flex flex-col gap-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                {entries.map(([key, value]) => {
                    const fieldType = getFieldType(key, value);
                    const formattedValue = formatValue(value, fieldType);
                    const typeLabel = getTypeLabel(fieldType);

                    return (
                        <InputGroup key={key}>
                            <InputGroupInput
                                id={key}
                                value={formattedValue}
                                type={fieldType === 'timestamp' || fieldType === 'uuid' ? 'text' : fieldType}
                                readOnly
                                className="cursor-default"
                            />
                            <InputGroupAddon align="block-start">
                                <Label htmlFor={key} className="text-foreground text-sm font-medium">
                                    {key}
                                </Label>
                                <span className="ml-auto text-xs text-muted-foreground font-mono">{typeLabel}</span>
                            </InputGroupAddon>
                        </InputGroup>
                    );
                })}
            </div>
        </>
    );
};
