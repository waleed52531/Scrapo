import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from "class-validator";
import { PaginationDto } from "../../common/pagination.dto";

export class CreateCompanyDto {
  @ApiProperty({ example: "Northstar Digital" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: "northstar.example" })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ example: "https://northstar.example" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeRange?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agencyType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologies?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasWebService?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasBackendService?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasMobileService?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  partnershipFitScore?: number;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class CompanyQueryDto extends PaginationDto {
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
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  hasMobileService?: boolean;
}
