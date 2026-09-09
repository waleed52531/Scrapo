import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export const outreachStrategies = [
  "AGENCY_PARTNERSHIP",
  "ACTIVE_REQUIREMENT",
  "MVP_STARTUP",
  "EXISTING_APP_FIX",
  "FIREBASE_API_SUPPORT",
  "APP_STORE_SUPPORT",
  "GENERAL_MOBILE_SUPPORT",
  "CUSTOM",
] as const;

export class GenerateOutreachDto {
  @ApiPropertyOptional({ enum: outreachStrategies })
  @IsOptional()
  @IsIn(outreachStrategies)
  strategy?: string;

  @ApiPropertyOptional({ example: "Make it shorter and more technical." })
  @IsOptional()
  @IsString()
  instruction?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

export class OutreachListDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strategy?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  replied?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class UpdateOutreachDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;
}

export class SendOutreachDto {
  @ApiPropertyOptional({
    description: "Idempotency key to prevent double-send on retries.",
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class CreateSuppressionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiProperty({ example: "Recipient requested no further contact." })
  @IsString()
  reason: string;
}
