import 'reflect-metadata';
import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles decorator', () => {
  it('sets metadata under ROLES_KEY with the given roles', () => {
    class Dummy {
      @Roles('admin', 'root')
      handler() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, Dummy.prototype.handler);
    expect(metadata).toEqual(['admin', 'root']);
  });
});
