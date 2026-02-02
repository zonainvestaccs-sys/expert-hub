import { AdminCronogramasService } from './admin-cronogramas.service';
import { CreateAdminAppointmentDto } from './dto/create-admin-appointment.dto';
export declare class AdminCronogramasController {
    private readonly service;
    constructor(service: AdminCronogramasService);
    private assertAdmin;
    list(req: any, from: string, to: string, expertId?: string): Promise<{
        id: string;
        expertId: string;
        expertEmail: string;
        expertPhotoUrl: string | null;
        expertIsActive: boolean;
        title: string;
        description: string | null;
        location: string | null;
        startAt: string;
        endAt: string | null;
        allDay: boolean;
        color: string | null;
        seriesId: any;
        occurrenceIndex: any;
        isException: any;
    }[]>;
    create(req: any, dto: CreateAdminAppointmentDto): Promise<{
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
}
