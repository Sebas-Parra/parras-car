import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAuditEventDto } from './create-audit-event.dto';

async function validateDto(raw: Record<string, unknown>) {
  const dto = plainToInstance(CreateAuditEventDto, raw);
  return validate(dto);
}

const validPayload = {
  servicio: 'ms-vehiculos',
  accion: 'CREATE',
  entidad: 'VEHICULO',
  usuario: 'john.doe',
  rol: 'admin',
};

describe('CreateAuditEventDto', () => {
  it('accepts a fully valid payload', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('rejects a servicio outside the known allowlist', async () => {
    const errors = await validateDto({ ...validPayload, servicio: 'ms-hackerman' });
    expect(errors.some((e) => e.property === 'servicio')).toBe(true);
  });

  it('rejects an entidad outside the known allowlist', async () => {
    const errors = await validateDto({ ...validPayload, entidad: 'COSA-RARA' });
    expect(errors.some((e) => e.property === 'entidad')).toBe(true);
  });

  it('rejects a payload missing usuario', async () => {
    const { usuario, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'usuario')).toBe(true);
  });

  it('rejects a payload missing rol', async () => {
    const { rol, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'rol')).toBe(true);
  });

  it('rejects datos larger than 10KB serialized', async () => {
    const errors = await validateDto({
      ...validPayload,
      datos: { blob: 'x'.repeat(11 * 1024) },
    });
    expect(errors.some((e) => e.property === 'datos')).toBe(true);
  });

  it('accepts datos within the 10KB limit', async () => {
    const errors = await validateDto({
      ...validPayload,
      datos: { plate: 'ABC-123' },
    });
    expect(errors).toHaveLength(0);
  });
});
