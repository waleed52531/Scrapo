import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../auth/current-auth.decorator';
import { ContactsService } from './contacts.service';
import { ContactQueryDto, CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(@Inject(ContactsService) private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List workspace contacts' })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ContactQueryDto) {
    return this.contacts.list(auth.workspaceId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a contact' })
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateContactDto) {
    return this.contacts.create(auth.workspaceId, auth.userId, input);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a contact' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.get(auth.workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a contact' })
  update(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateContactDto) {
    return this.contacts.update(auth.workspaceId, auth.userId, id, input);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a contact' })
  delete(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.delete(auth.workspaceId, auth.userId, id);
  }
}
