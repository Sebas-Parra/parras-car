import { Injectable, ServiceUnavailableException } from '@nestjs/common';

const ASSIGNMENTS_URL =
  process.env.ASSIGNMENTS_SERVICE_URL ?? 'http://assignments:8001';

export interface AssignmentDto {
  user_id: string;
  vehicle_id: string;
  active: boolean;
}

@Injectable()
export class AssignmentsClient {
  // 404 significa que el vehículo no tiene propietario activo asignado.
  async findActiveByVehicle(vehicleId: string): Promise<AssignmentDto | null> {
    try {
      const res = await fetch(
        `${ASSIGNMENTS_URL}/assignments/by-vehicle/${vehicleId}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return (await res.json()) as AssignmentDto;
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo contactar al servicio de asignaciones',
      );
    }
  }
}
