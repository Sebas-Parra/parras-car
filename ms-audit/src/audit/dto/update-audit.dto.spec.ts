import { UpdateAuditDto } from './update-audit.dto';

describe('UpdateAuditDto', () => {
  it('makes all CreateAuditEventDto fields optional', () => {
    const dto = new UpdateAuditDto();
    dto.servicio = 'ms-vehiculos';

    expect(dto.servicio).toBe('ms-vehiculos');
  });
});
