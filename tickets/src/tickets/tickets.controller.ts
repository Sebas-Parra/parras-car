import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketsService } from './tickets.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; username: string; roles: string[] };
}

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
    );
  }

  // Cualquier usuario autenticado — consultar tickets
  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  // Cualquier usuario autenticado — consultar ticket
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  // Empleado (recaudador) o admin/root — registrar pago y liberar espacio
  @Patch(':id/pay')
  @Roles('recaudador', 'admin', 'root')
  pay(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.pay(
      id,
      req.user.userId,
      req.headers.authorization ?? '',
    );
  }

  // Empleado (recaudador) o admin/root — anular ticket y liberar espacio
  @Patch(':id/cancel')
  @Roles('recaudador', 'admin', 'root')
  cancel(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.cancel(
      id,
      req.user.userId,
      req.headers.authorization ?? '',
    );
  }
}
