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
    // Roles NO están en el JWT (por seguridad).
    // Se obtienen del servidor en este mismo momento.
    const roles = await this.getUserRoles(payload.sub);
    return {
      userId: payload.sub,
      username: payload.username,
      roles,
    };
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    try {
      const response = await fetch(`${USERS_SERVICE_URL}/users/${userId}/roles`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch user roles: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      return data.roles || [];
    } catch (error) {
      this.logger.error(`Error fetching user roles: ${error.message}`);
      return [];
    }
  }
}
