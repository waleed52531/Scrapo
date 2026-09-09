import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { outreachStrategies } from "../../outreach/dto/outreach.dto";

export class CreateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: outreachStrategies })
  @IsOptional()
  @IsIn(outreachStrategies)
  strategy?: string;

  @ApiPropertyOptional({ enum: ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"])
  status?: string;

  @ApiPropertyOptional({ default: 82 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minimumScore?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  weeklyLimit?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoSendEnabled?: boolean;

  @ApiPropertyOptional({ default: 92 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  autoSendThreshold?: number;

  @ApiPropertyOptional({ default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  followUpDays?: number;

  @ApiPropertyOptional({ enum: ["MANUAL", "DRAFT", "AUTO"] })
  @IsOptional()
  @IsIn(["MANUAL", "DRAFT", "AUTO"])
  followUpMode?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  maxFollowUps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  targeting?: Record<string, unknown>;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}
