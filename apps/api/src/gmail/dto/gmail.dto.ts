import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsUUID } from "class-validator";

export class GmailCallbackDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  state: string;
}

export class MockGmailReplyDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  outreachId: string;

  @ApiProperty({ example: "client@example.com" })
  @IsEmail()
  fromEmail: string;

  @ApiPropertyOptional({ example: "Re: Mobile development support" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    example:
      "Yes, we occasionally need Flutter support. Can you send your portfolio?",
  })
  @IsString()
  body: string;
}
