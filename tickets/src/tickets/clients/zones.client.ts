import { Injectable, ServiceUnavailableException } from '@nestjs/common';

const ZONES_URL = process.env.ZONES_SERVICE_URL ?? 'http://zones:8080';

export type PlaceStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
export type PlaceType = 'CAR' | 'BIKE' | 'BUS';
export type ZoneType =
  | 'REGULAR'
  | 'VIP'
  | 'INTERNAL'
  | 'EXTERNAL'
  | 'PREFERENTIAL';

export interface PlaceDto {
  id: string;
  code: string;
  // Tipo físico del espacio (CAR | BIKE | BUS). Determina qué vehículos caben
  // y la tarifa base.
  type: PlaceType;
  status: PlaceStatus;
  active: boolean;
  idZone: string;
  nameZone: string;
}

export interface ZoneDto {
  id: string;
  name: string;
  // Tipo de zona (REGULAR | VIP | ...). Multiplica la tarifa base del espacio.
  type: ZoneType;
}

// La API de zones no expone GET /places/:id, solo el listado completo con
// filtros opcionales por status/zone. Se filtra en memoria por id.
@Injectable()
export class ZonesClient {
  async findPlaceById(idEspacio: string, authHeader: string): Promise<PlaceDto | null> {
    let places: PlaceDto[];
    try {
      const res = await fetch(`${ZONES_URL}/api/v1/places`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return null;
      places = (await res.json()) as PlaceDto[];
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo contactar al servicio de zonas',
      );
    }
    return places.find((p) => p.id === idEspacio) ?? null;
  }

  async findZoneById(idZone: string, authHeader: string): Promise<ZoneDto | null> {
    try {
      const res = await fetch(`${ZONES_URL}/api/v1/zones/${idZone}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return null;
      return (await res.json()) as ZoneDto;
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo contactar al servicio de zonas',
      );
    }
  }

  async setStatus(
    idEspacio: string,
    status: PlaceStatus,
    authHeader: string,
  ): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${ZONES_URL}/api/v1/places/${idEspacio}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ status }),
      });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo contactar al servicio de zonas',
      );
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `El servicio de zonas respondió con estado ${res.status}`,
      );
    }
  }
}
