import { PrismaService } from '../prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
type Range = {
    from: Date;
    to: Date;
};
type Scope = 'single' | 'series' | 'future';
export declare class AppointmentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(expertId: string, range: Range): Promise<{
        description: string | null;
        id: string;
        createdAt: Date;
        expertId: string;
        updatedAt: Date;
        title: string;
        location: string | null;
        startAt: Date;
        endAt: Date | null;
        allDay: boolean;
        color: string | null;
        seriesId: string | null;
        occurrenceIndex: number | null;
        isException: boolean;
    }[]>;
    create(expertId: string, dto: CreateAppointmentDto): Promise<{
        description: string | null;
        id: string;
        createdAt: Date;
        expertId: string;
        updatedAt: Date;
        title: string;
        location: string | null;
        startAt: Date;
        endAt: Date | null;
        allDay: boolean;
        color: string | null;
        seriesId: string | null;
        occurrenceIndex: number | null;
        isException: boolean;
    } | {
        seriesId: string;
        items: {
            description: string | null;
            id: string;
            createdAt: Date;
            expertId: string;
            updatedAt: Date;
            title: string;
            location: string | null;
            startAt: Date;
            endAt: Date | null;
            allDay: boolean;
            color: string | null;
            seriesId: string | null;
            occurrenceIndex: number | null;
            isException: boolean;
        }[];
    }>;
    update(expertId: string, id: string, dto: UpdateAppointmentDto, scope?: Scope): Promise<{
        description: string | null;
        id: string;
        createdAt: Date;
        expertId: string;
        updatedAt: Date;
        title: string;
        location: string | null;
        startAt: Date;
        endAt: Date | null;
        allDay: boolean;
        color: string | null;
        seriesId: string | null;
        occurrenceIndex: number | null;
        isException: boolean;
    } | null>;
    remove(expertId: string, id: string, scope?: Scope): Promise<{
        ok: boolean;
    }>;
    listForAdmin(range: {
        from: string;
        to: string;
    }, expertId?: string): Promise<({
        expert: {
            id: string;
            email: string;
            photoUrl: string | null;
        };
    } & {
        description: string | null;
        id: string;
        createdAt: Date;
        expertId: string;
        updatedAt: Date;
        title: string;
        location: string | null;
        startAt: Date;
        endAt: Date | null;
        allDay: boolean;
        color: string | null;
        seriesId: string | null;
        occurrenceIndex: number | null;
        isException: boolean;
    })[]>;
}
export {};
