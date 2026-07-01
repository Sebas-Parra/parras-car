import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // Admin / root — registrar vehículo
  @Post()
  @Roles('admin', 'root')
  create(@Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.create(createVehicleDto);
  }

  // Cualquier usuario autenticado — consultar catálogo
  @Get()
  findAll() {
    return this.vehiclesService.findAll();
  }

  // Cualquier usuario autenticado — consultar vehículo
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
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
