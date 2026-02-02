export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly';
export type RecurrenceMode = 'count' | 'until';
export declare class RecurrenceDto {
    enabled: boolean;
    freq: RecurrenceFreq;
    interval: number;
    mode: RecurrenceMode;
    count?: number;
    until?: string;
    weekdays?: number[];
}
export declare class CreateAppointmentDto {
    title: string;
    description?: string | null;
    location?: string | null;
    startAt: string;
    endAt?: string | null;
    allDay: boolean;
    color?: string | null;
    recurrence?: RecurrenceDto;
}
