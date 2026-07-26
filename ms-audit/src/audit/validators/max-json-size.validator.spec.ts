import { validate } from 'class-validator';
import { MaxJsonSize } from './max-json-size.validator';

class NoMessageSample {
  @MaxJsonSize(10)
  datos?: Record<string, any>;
}

class WithMessageSample {
  @MaxJsonSize(10, { message: 'custom message' })
  datos?: Record<string, any>;
}

describe('MaxJsonSize', () => {
  it('passes validation when the field is undefined or null', async () => {
    const sample = new NoMessageSample();
    const errors = await validate(sample);
    expect(errors).toHaveLength(0);
  });

  it('passes validation when the serialized payload fits within the limit', async () => {
    const sample = new NoMessageSample();
    sample.datos = { a: 1 };
    const errors = await validate(sample);
    expect(errors).toHaveLength(0);
  });

  it('falls back to the default message when no custom message is provided', async () => {
    const sample = new NoMessageSample();
    sample.datos = { blob: 'x'.repeat(50) };

    const errors = await validate(sample);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.maxJsonSize).toBe(
      'El campo datos no puede superar 10 bytes serializado.',
    );
  });

  it('uses the custom message when one is provided', async () => {
    const sample = new WithMessageSample();
    sample.datos = { blob: 'x'.repeat(50) };

    const errors = await validate(sample);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.maxJsonSize).toBe('custom message');
  });
});
