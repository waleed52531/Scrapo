import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { EmailStatus } from "@prisma/client";
import { PaginationDto } from "../../common/pagination.dto";

export class CreateContactDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: "James Smith" })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: "Founder" })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: "james@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: EmailStatus })
  @IsOptional()
  @IsEnum(EmailStatus)
  emailStatus?: EmailStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  xUrl?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  decisionMakerScore?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  contactConfidence?: number;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

export class ContactQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: EmailStatus })
  @IsOptional()
  @IsEnum(EmailStatus)
  emailStatus?: EmailStatus;
}
