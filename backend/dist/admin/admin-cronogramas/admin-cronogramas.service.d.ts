import { PrismaService } from '../../prisma.service';
import { AppointmentsService } from '../../appointments/appointments.service';
import { CreateAdminAppointmentDto } from './dto/create-admin-appointment.dto';
type ListArgs = {
    from: string;
    to: string;
    expertId?: string;
};
export declare class AdminCronogramasService {
    private readonly prisma;
    private readonly appointments;
    constructor(prisma: PrismaService, appointments: AppointmentsService);
    list(args: ListArgs): Promise<{
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
    create(dto: CreateAdminAppointmentDto): Promise<{
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
export {};
