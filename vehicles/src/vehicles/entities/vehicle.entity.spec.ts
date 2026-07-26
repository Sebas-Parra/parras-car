import { Car } from './car.entity';
import { Motorcycle } from './motorcycle.entity';
import { PickupTruck } from './pickupTrucks.entity';
import { Clasification } from './enum/Clasification';
import { TypeOfMotorbike } from './enum/TypeOfMotorbike';

describe('Vehicle entities', () => {
  it('Car exposes tipo "car" and serializes it via toJSON', () => {
    const car = new Car();
    Object.assign(car, {
      id: 'v1',
      plate: 'ABC-1234',
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Red',
      year: 2020,
      clasification: Clasification.GASOLINE,
      numberOfDoors: 4,
      trunkCapacity: 400,
    });

    expect(car.tipo).toBe('car');
    expect(car.toJSON()).toEqual(expect.objectContaining({ tipo: 'car', plate: 'ABC-1234' }));
  });

  it('Motorcycle exposes tipo "motocicleta"', () => {
    const motorcycle = new Motorcycle();
    Object.assign(motorcycle, {
      id: 'v2',
      plate: 'AB-123C',
      typeOfMotorbike: TypeOfMotorbike.SPORT,
    });

    expect(motorcycle.tipo).toBe('motocicleta');
    expect(motorcycle.toJSON()).toEqual(expect.objectContaining({ tipo: 'motocicleta' }));
  });

  it('PickupTruck exposes tipo "pickupTruck"', () => {
    const pickup = new PickupTruck();
    Object.assign(pickup, {
      id: 'v3',
      plate: 'ABC-1234',
      payloadCapacity: 1000,
      cab: 'Crew',
    });

    expect(pickup.tipo).toBe('pickupTruck');
    expect(pickup.toJSON()).toEqual(expect.objectContaining({ tipo: 'pickupTruck' }));
  });
});
