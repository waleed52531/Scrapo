import { ApiPropertyOptional } from "@nestjs/swagger";
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
  ValidateNested,
} from "class-validator";

export class ProfileSettingsDto {
  @IsString() name: string;
  @IsString() title: string;
  @IsArray() @IsString({ each: true }) skills: string[];
  @IsString() experience: string;
  @IsString() portfolio: string;
  @IsString() github: string;
  @IsString() linkedin: string;
  @IsString() availability: string;
  @IsArray() @IsString({ each: true }) projectPreferences: string[];
}

export class TargetingSettingsDto {
  @IsArray() @IsString({ each: true }) countries: string[];
  @IsArray() @IsString({ each: true }) companySizes: string[];
  @IsArray() @IsString({ each: true }) industries: string[];
  @IsArray() @IsString({ each: true }) leadTypes: string[];
  @IsArray() @IsString({ each: true }) technologies: string[];
  @IsInt() @Min(0) minimumBudget: number;
}

export class DiscoverySettingsDto {
  @IsInt() @Min(1) @Max(10_000) target: number;
  @IsInt() @Min(0) @Max(100) minimumScore: number;
  @IsInt() @Min(1) @Max(100) shortlistLimit: number;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ type: ProfileSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileSettingsDto)
  profile?: ProfileSettingsDto;

  @ApiPropertyOptional({ type: TargetingSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TargetingSettingsDto)
  targeting?: TargetingSettingsDto;

  @ApiPropertyOptional({
    type: Object,
    description: "Eight scoring weights that must total 100.",
  })
  @IsOptional()
  @IsObject()
  scoring?: Record<string, number>;

  @ApiPropertyOptional({ type: DiscoverySettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscoverySettingsDto)
  discovery?: DiscoverySettingsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  outreachPaused?: boolean;

  @ApiPropertyOptional({
    enum: ["DRAFT_FIRST", "APPROVE_AND_SEND", "AUTOMATIC"],
  })
  @IsOptional()
  @IsIn(["DRAFT_FIRST", "APPROVE_AND_SEND", "AUTOMATIC"])
  emailMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  weeklyEmailLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSendEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(92)
  @Max(100)
  autoSendMinimumScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  autoSendDailyLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoGenerateOutreachDrafts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  automationPaused?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  automationKillSwitch?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outreachBusinessHoursStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outreachBusinessHoursEnd?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  outreachBusinessDays?: number[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  sourcePriorities?: Record<string, string>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  discoveryBudgetAllocation?: Record<string, number>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  optimizationSettings?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  staleLeadTtls?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sendOwnerEmailAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dailyDigestEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  scoreJumpThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  followUpDelayDays?: number;

  @ApiPropertyOptional({ enum: ["DRAFT", "OFF"] })
  @IsOptional()
  @IsIn(["DRAFT", "OFF"])
  followUpMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  maxFollowUps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  coldOutreachCooldownDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxNewContactsPerCompanyPer30Days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailSignature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optOutFooter?: string;
}
