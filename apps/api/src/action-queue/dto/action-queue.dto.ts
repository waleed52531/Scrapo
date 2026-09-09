import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ActionStatus, LeadSource } from "@prisma/client";

export class ActionQueueListDto {
  @ApiPropertyOptional({ enum: ActionStatus })
  @IsOptional()
  @IsEnum(ActionStatus)
  status?: ActionStatus;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  platform?: LeadSource;
}

export class UpdateActionItemDto {
  @ApiPropertyOptional({ enum: ActionStatus })
  @IsOptional()
  @IsEnum(ActionStatus)
  status?: ActionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
}
