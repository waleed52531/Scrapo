import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class WebsiteAnalysisDto {
  @ApiProperty({ example: "https://exampleagency.com" })
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  url: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class AnalyzeLeadDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class ScoreOverrideDto {
  @ApiProperty({ minimum: 0, maximum: 100, example: 88 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @ApiProperty({ example: "Stronger fit after manual review of portfolio." })
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class ManualLeadContextDto {
  @ApiPropertyOptional({ example: "https://agency.example" })
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  website?: string;

  @ApiPropertyOptional({
    example:
      "Looking for an experienced Flutter developer to finish our app this month.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  sourceContent?: string;

  @ApiPropertyOptional({ example: "https://x.com/example/status/1" })
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
