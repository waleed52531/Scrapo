import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../auth/current-auth.decorator';
import { CreateLeadDto, LeadQueryDto, UpdateLeadDto } from './dto/lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(@Inject(LeadsService) private readonly leads: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter workspace leads' })
  list(@CurrentAuth() auth: AuthContext, @Query() query: LeadQueryDto) {
    return this.leads.list(auth.workspaceId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a manual or pre-qualified lead' })
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateLeadDto) {
    return this.leads.create(auth.workspaceId, auth.userId, input);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lead with company, contact, signals, score, and activity' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.get(auth.workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a lead' })
  update(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateLeadDto) {
    return this.leads.update(auth.workspaceId, auth.userId, id, input);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a lead' })
  delete(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.delete(auth.workspaceId, auth.userId, id);
  }
}
