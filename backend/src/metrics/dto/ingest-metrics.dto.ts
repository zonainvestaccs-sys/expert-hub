import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, Min } from 'class-validator';

export class IngestMetricsDto {
  @IsString()
  @IsNotEmpty()
  expertId!: string;

  // "YYYY-MM-DD"
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'day deve ser YYYY-MM-DD' })
  day!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadsTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadsActive?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  depositsCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  depositsTotalCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ftdCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  revCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salesCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salesCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  trafficCents?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  raw?: Record<string, any>;
}
