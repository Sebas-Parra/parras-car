import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

export class CreateTicketDto {
  @IsUUID('4', { message: 'idEspacio debe ser un UUID válido' })
  idEspacio!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9-]{5,10}$/, {
    message: 'La placa tiene un formato inválido',
  })
  placa!: string;
}
