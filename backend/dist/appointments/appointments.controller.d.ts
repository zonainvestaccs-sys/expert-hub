import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
export declare class AppointmentsController {
    private readonly service;
    constructor(service: AppointmentsService);
    private getExpertId;
    list(req: any, from?: string, to?: string): Promise<{
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
    create(req: any, dto: CreateAppointmentDto): Promise<{
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
    update(req: any, id: string, dto: UpdateAppointmentDto, scope?: string): Promise<{
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
    remove(req: any, id: string, scope?: string): Promise<{
        ok: boolean;
    }>;
}
