import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  username: string;
}

const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL ?? 'http://users:8000';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Roles y permisos NO están en el JWT (por seguridad).
    // Se obtienen del servidor en este mismo momento.
    const [roles, permissions] = await Promise.all([
      this.getUserField<string>(payload.sub, 'roles'),
      this.getUserField<string>(payload.sub, 'permissions'),
    ]);
    return { userId: payload.sub, username: payload.username, roles, permissions };
  }

  private async getUserField<T>(userId: string, field: 'roles' | 'permissions'): Promise<T[]> {
    try {
      const response = await fetch(`${USERS_SERVICE_URL}/users/${userId}/${field}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch user ${field}: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      return data[field] || [];
    } catch (error) {
      this.logger.error(`Error fetching user ${field}: ${error.message}`);
      return [];
    }
  }
}
