import {
    IsIn,
    IsIP,
    IsISO8601,
    IsMACAddress,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { MaxJsonSize } from '../validators/max-json-size.validator';

const SERVICIOS_VALIDOS = [
    'ms-vehiculos',
    'ms-tickets',
    'ms-users',
    'ms-zonas',
    'ms-assignments',
] as const;

const ENTIDADES_VALIDAS = [
    'VEHICULO',
    'TICKET',
    'USUARIO',
    'ZONA',
    'PLACE',
    'ASSIGNMENT',
] as const;

export class CreateAuditEventDto {
    @IsString()
    @IsNotEmpty()
    @IsIn(SERVICIOS_VALIDOS, {
        message: `El servicio debe ser uno de: ${SERVICIOS_VALIDOS.join(', ')}.`,
    })
    servicio!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(10)
    @Matches(/^(CREATE|UPDATE|DELETE|LOGIN|LOGOUT|SELECT)$/, {
        message:
            'La acción debe ser una de las siguientes: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, SELECT.',
    })
    accion!: string; //CREATE - UPDATE - DELETE - LOGIN - LOGOUT - SELECT

    @IsString()
    @IsNotEmpty()
    @IsIn(ENTIDADES_VALIDAS, {
        message: `La entidad debe ser una de: ${ENTIDADES_VALIDAS.join(', ')}.`,
    })
    entidad!: string;

    @IsObject()
    @IsOptional()
    @MaxJsonSize(10 * 1024, {
        message: 'El campo datos no puede superar 10KB una vez serializado.',
    })
    datos?: Record<string, any>;

    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(25)
    @Matches(/^[a-zA-Z0-9._-]+$/, {
        message:
            'El nombre de usuario solo puede contener letras, números, puntos, guiones bajos y guiones medios.',
    })
    usuario!: string;

    @IsString()
    @IsNotEmpty()
    rol!: string;

    @IsOptional()
    @IsIP('4', { message: 'La dirección IP debe ser una dirección IPv4 válida.' })
    ip?: string;

    @IsOptional()
    @IsMACAddress({
        message: 'La dirección MAC debe ser una dirección MAC válida.',
    })
    mac?: string;

    @IsOptional()
    @IsISO8601({}, { message: 'eventTimestamp debe ser una fecha ISO8601 válida.' })
    eventTimestamp?: string;
}
