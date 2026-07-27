import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
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
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { getClientIp } from './get-client-ip';
import { ActingUser, VehiclesService } from './vehicles.service';

interface AuthenticatedRequest extends Request {
  user: ActingUser;
}

// Catálogo acotado por la capacidad física real (no crece sin límite como
// tickets/auditoría), así que el tope es más alto para no romper los
// buscadores tipo-combobox de otras páginas que necesitan ver todo.
const MAX_PAGE_SIZE = 500;

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // Cualquier usuario autenticado — registrar vehículo
  @Post()
  @Roles('admin', 'root', 'cliente', 'recaudador')
  create(
    @Body() createVehicleDto: CreateVehicleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehiclesService.create(
      createVehicleDto,
      req.user,
      getClientIp(req),
      req.headers.authorization,
    );
  }

  // Cualquier usuario autenticado — consultar catálogo
  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.vehiclesService.findAll(
      req.user,
      Math.max(1, page),
      Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE),
    );
  }

  // Cualquier usuario autenticado — búsqueda directa por placa (ej. tickets
  // al emitir un ticket). Debe ir antes de :id para no ser capturada por él.
  @Get('by-plate/:plate')
  async findByPlate(@Param('plate') plate: string) {
    const vehicle = await this.vehiclesService.findByPlate(plate);
    if (!vehicle) {
      throw new NotFoundException(`Vehículo con placa '${plate}' no encontrado`);
    }
    return vehicle;
  }

  // Validación autenticada para assignments: no expone datos completos ni
  // aplica ownership, porque se usa antes de crear la asignación.
  @Get('validation/:id')
  validateForAssignment(@Param('id') id: string) {
    return this.vehiclesService.findForAssignmentValidation(id);
  }

  // Cualquier usuario autenticado — consultar vehículo
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.vehiclesService.findOne(id, req.user);
  }

  // Admin / root — actualizar datos del vehículo
  @Patch(':id')
  @Roles('admin', 'root')
  update(@Param('id') id: string, @Body() updateVehicleDto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, updateVehicleDto);
  }

  // Admin / root — reactivar vehículo
  @Patch(':id/activate')
  @Roles('admin', 'root')
  activate(@Param('id') id: string) {
    return this.vehiclesService.activate(id);
  }

  // Admin / root — inactivar vehículo (soft delete)
  @Delete(':id')
  @Roles('admin', 'root')
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(id);
  }
}
