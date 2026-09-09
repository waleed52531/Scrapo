import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { LeadSource } from "@prisma/client";
import { PaginationDto } from "../../common/pagination.dto";

export class CreateSearchQueryDto {
  @ApiProperty({ example: '"web agency" "mobile app development" Dubai' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ enum: LeadSource, default: LeadSource.WEB })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ example: "United Arab Emirates" })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: "WEB_AGENCY" })
  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateSearchQueryDto extends PartialType(CreateSearchQueryDto) {}

export class SearchQueryListDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  enabled?: boolean;
}
