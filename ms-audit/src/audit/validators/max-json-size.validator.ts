import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function MaxJsonSize(maxBytes: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxJsonSize',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [maxBytes],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === undefined || value === null) return true;
          const [max] = args.constraints as [number];
          return Buffer.byteLength(JSON.stringify(value), 'utf8') <= max;
        },
        defaultMessage(args: ValidationArguments) {
          const [max] = args.constraints as [number];
          return `El campo ${args.property} no puede superar ${max} bytes serializado.`;
        },
      },
    });
  };
}
