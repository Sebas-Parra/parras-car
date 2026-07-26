import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTicketDto } from './create-ticket.dto';

describe('CreateTicketDto', () => {
  it('accepts a valid uuid and plate, uppercasing/trimming the plate', async () => {
    const dto = plainToInstance(CreateTicketDto, {
      idEspacio: '123e4567-e89b-42d3-a456-426614174000',
      placa: ' abc-123 ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.placa).toBe('ABC-123');
  });

  it('rejects an invalid uuid', async () => {
    const dto = plainToInstance(CreateTicketDto, {
      idEspacio: 'not-a-uuid',
      placa: 'ABC-123',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'idEspacio')).toBe(true);
  });

  it('rejects an empty plate', async () => {
    const dto = plainToInstance(CreateTicketDto, {
      idEspacio: '123e4567-e89b-42d3-a456-426614174000',
      placa: '',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'placa')).toBe(true);
  });

  it('rejects a plate with an invalid format', async () => {
    const dto = plainToInstance(CreateTicketDto, {
      idEspacio: '123e4567-e89b-42d3-a456-426614174000',
      placa: '!!',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'placa')).toBe(true);
  });
});
