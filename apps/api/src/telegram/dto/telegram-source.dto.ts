import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateTelegramSourceDto {
  @ApiProperty({ example: "Flutter Jobs" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: "flutter_jobs" })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: "-100123456789" })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiProperty({ example: "CHANNEL" })
  @IsString()
  type: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateTelegramSourceDto extends PartialType(
  CreateTelegramSourceDto,
) {}
