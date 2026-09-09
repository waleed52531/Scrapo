import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { LEAD_FEEDBACK_RATINGS } from "@scrapo/shared";

export class CreateLeadFeedbackDto {
  @ApiProperty({ enum: LEAD_FEEDBACK_RATINGS })
  @IsIn(LEAD_FEEDBACK_RATINGS)
  rating!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
