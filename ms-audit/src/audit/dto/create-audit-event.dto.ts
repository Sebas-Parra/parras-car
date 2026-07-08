import {
    IsIP,
    IsMACAddress,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateAuditEventDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(7)
    @MaxLength(50)
    @Matches(/^(ms-[a-zA-Z]+)$/, {
        message: 'El servicio debe comenzar con "ms-" seguido de letras.',
    })
    servicio!: string; //ms-users , ms-auth, ms-products, etc.

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
    @MinLength(3)
    @MaxLength(15)
    @Matches(/^[A-Z-]+$/, {
        message: 'El campo solo debe contener letras mayúsculas y guiones medios.',
    })
    entidad!: string;

    @IsObject()
    @IsOptional()
    datos?: Record<string, any>;

    @IsString()
    @IsOptional() //obligatorio
    @MinLength(5) //ejemplo: "john.doe"
    @MaxLength(25)
    @Matches(/^[a-zA-Z0-9._-]+$/, {
        message:
            'El nombre de usuario solo puede contener letras, números, puntos, guiones bajos y guiones medios.',
    })
    usuario?: string;

    @IsString()
    @IsOptional() //obligatorio-cambiar
    rol?: string;

    @IsOptional()
    @IsIP('4', { message: 'La dirección IP debe ser una dirección IPv4 válida.' })
    ip?: string;

    @IsOptional()
    @IsMACAddress({
        message: 'La dirección MAC debe ser una dirección MAC válida.',
    })
    mac?: string;
}
