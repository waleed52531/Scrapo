import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { AUTOMATION_RULE_TYPES } from "@scrapo/shared";

export class CreateAutomationRuleDto {
  @ApiProperty({ example: "Weekly Lead Hunt" })
  @IsString()
  name!: string;

  @ApiProperty({ enum: AUTOMATION_RULE_TYPES })
  @IsIn(AUTOMATION_RULE_TYPES)
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}

export class UpdateAutomationRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}

export class AutomationRunListDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  automationRuleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AutomationPreviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  sources?: string[];
}
