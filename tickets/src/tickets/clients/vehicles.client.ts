import { Injectable, ServiceUnavailableException } from '@nestjs/common';

const VEHICLES_URL = process.env.VEHICLES_SERVICE_URL ?? 'http://vehicles:3000';

export interface VehicleDto {
  id: string;
  plate: string;
  active: boolean;
  // Discriminador de tipo expuesto por vehicles vía toJSON:
  // 'car' | 'motocicleta' | 'pickupTruck'.
  tipo?: string;
}

// vehicles no expone búsqueda por placa, solo listado completo y GET /:id.
// Se filtra en memoria por placa.
@Injectable()
export class VehiclesClient {
  async findByPlate(placa: string, authHeader: string): Promise<VehicleDto | null> {
    let vehicles: VehicleDto[];
    try {
      const res = await fetch(`${VEHICLES_URL}/vehicles`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return null;
      vehicles = (await res.json()) as VehicleDto[];
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo contactar al servicio de vehículos',
      );
    }
    return vehicles.find((v) => v.plate === placa) ?? null;
  }
}
