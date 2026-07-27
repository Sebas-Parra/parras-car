import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { EstadoTicket } from './entities/enum/estado-ticket.enum';
import { getClientIp } from './get-client-ip';
import { ActingUser, TicketsService } from './tickets.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; username: string; roles: string[] };
}

function actingUserOf(req: AuthenticatedRequest): ActingUser {
  return { username: req.user.username, roles: req.user.roles };
}

const MAX_PAGE_SIZE = 100;

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Empleado (recaudador) o admin/root — emitir ticket de ingreso
  @Post()
  @Roles('recaudador', 'admin', 'root')
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.create(
      createTicketDto,
      req.user.userId,
      req.headers.authorization ?? '',
      actingUserOf(req),
      getClientIp(req),
    );
  }

  // Cualquier usuario autenticado — consultar tickets
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('estado') estado?: EstadoTicket,
  ) {
    return this.ticketsService.findAll(
      Math.max(1, page),
      Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE),
      estado,
    );
  }

  // Cualquier usuario autenticado — consultar ticket
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findOne(id);
  }

  // Empleado (recaudador) o admin/root — registrar pago y liberar espacio
  @Patch(':id/pay')
  @Roles('recaudador', 'admin', 'root')
  pay(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.pay(
      id,
      req.user.userId,
      req.headers.authorization ?? '',
      actingUserOf(req),
      getClientIp(req),
    );
  }

  // Empleado (recaudador) o admin/root — anular ticket y liberar espacio
  @Patch(':id/cancel')
  @Roles('recaudador', 'admin', 'root')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.cancel(
      id,
      req.user.userId,
      req.headers.authorization ?? '',
      actingUserOf(req),
      getClientIp(req),
    );
  }
}
