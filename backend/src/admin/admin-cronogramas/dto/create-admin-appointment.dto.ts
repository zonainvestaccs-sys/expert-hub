import { IsString } from 'class-validator';
import { CreateAppointmentDto } from '../../../appointments/dto/create-appointment.dto';

export class CreateAdminAppointmentDto extends CreateAppointmentDto {
  @IsString()
  expertId!: string;
}
