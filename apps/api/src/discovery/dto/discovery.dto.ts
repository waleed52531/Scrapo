import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from "class-validator";
import { LeadSource } from "@prisma/client";

export class WebSearchDto {
  @ApiProperty({ example: '"web agency" "mobile app development" Dubai' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class ManualSocialImportDto {
  @ApiPropertyOptional({
    enum: [LeadSource.REDDIT, LeadSource.X, LeadSource.TELEGRAM],
    default: LeadSource.REDDIT,
  })
  @IsOptional()
  @IsEnum(LeadSource)
  platform?: LeadSource;

  @ApiPropertyOptional({ example: "Need Flutter help for MVP" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    example:
      "I'm building an MVP and need an experienced Flutter developer to help complete the mobile app.",
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    example: "https://reddit.com/r/startups/comments/example",
  })
  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @ApiPropertyOptional({ example: "https://reddit.com/u/example" })
  @IsOptional()
  @IsUrl()
  profileUrl?: string;

  @ApiPropertyOptional({ example: "saas_founder" })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: "SaaS Founder" })
  @IsOptional()
  @IsString()
  displayName?: string;
}
