import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { PaginationDto } from "../../common/pagination.dto";

export class CreateLeadHuntDto {
  @ApiPropertyOptional({ example: "Agency partner discovery run" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: [String], example: ["WEB"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ["United Kingdom", "United Arab Emirates"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({ type: [String], example: ["WEB_AGENCY"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxQueries?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxDiscoveries?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 82 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minimumScore?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  shortlistLimit?: number;
}

export class LeadHuntListDto extends PaginationDto {
  @ApiPropertyOptional({ example: "COMPLETED" })
  @IsOptional()
  @IsString()
  status?: string;
}
