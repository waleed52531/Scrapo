import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../auth/current-auth.decorator';
import { CompaniesService } from './companies.service';
import { CompanyQueryDto, CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(@Inject(CompaniesService) private readonly companies: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'List workspace companies' })
  list(@CurrentAuth() auth: AuthContext, @Query() query: CompanyQueryDto) {
    return this.companies.list(auth.workspaceId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a company' })
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateCompanyDto) {
    return this.companies.create(auth.workspaceId, auth.userId, input);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.companies.get(auth.workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a company' })
  update(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateCompanyDto) {
    return this.companies.update(auth.workspaceId, auth.userId, id, input);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a company' })
  delete(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.companies.delete(auth.workspaceId, auth.userId, id);
  }
}
