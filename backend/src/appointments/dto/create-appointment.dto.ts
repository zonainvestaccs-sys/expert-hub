import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly';
export type RecurrenceMode = 'count' | 'until';

export class RecurrenceDto {
  @IsBoolean()
  enabled!: boolean;

  @IsIn(['daily', 'weekly', 'monthly'])
  freq!: RecurrenceFreq;

  @IsInt()
  @Min(1)
  @Max(30)
  interval!: number;

  @IsIn(['count', 'until'])
  mode!: RecurrenceMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  count?: number;

  @IsOptional()
  @IsDateString()
  until?: string;

  // 0..6 (Dom..Sáb)
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];
}

export class CreateAppointmentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsDateString()
  endAt?: string | null;

  @IsBoolean()
  allDay!: boolean;

  @IsOptional()
  @IsString()
  color?: string | null;

  // ✅ NOVO: recorrência no backend
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  recurrence?: RecurrenceDto;
}
