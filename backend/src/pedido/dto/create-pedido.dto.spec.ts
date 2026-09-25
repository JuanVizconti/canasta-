import { validate } from 'class-validator';
import { CreatePedidoDto } from './create-pedido.dto';

describe('CreatePedidoDto', () => {
  const validDto = (): CreatePedidoDto =>
    Object.assign(new CreatePedidoDto(), {
      nombre: 'Juan',
      apellido: 'Perez',
      dni: '1234567',
      telefono: '1122334455',
    });

  it('accepts a numeric DNI with at least seven digits', async () => {
    await expect(validate(validDto())).resolves.toHaveLength(0);
  });

  it('rejects a DNI shorter than seven digits', async () => {
    const dto = validDto();
    dto.dni = '123456';

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'dni' })]),
    );
  });

  it('rejects a DNI with letters', async () => {
    const dto = validDto();
    dto.dni = '1234abc';

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'dni' })]),
    );
  });

  it('accepts a numeric phone number between eight and fifteen digits', async () => {
    const dto = validDto();
    dto.telefono = '12345678';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a phone number that is too short or contains letters', async () => {
    const shortPhone = validDto();
    shortPhone.telefono = '1234567';
    const letterPhone = validDto();
    letterPhone.telefono = '1234abcd';

    await expect(validate(shortPhone)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'telefono' })]),
    );
    await expect(validate(letterPhone)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'telefono' })]),
    );
  });

  it('rejects names and surnames shorter than two characters', async () => {
    const dto = validDto();
    dto.nombre = 'J';
    dto.apellido = 'P';

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'nombre' }),
        expect.objectContaining({ property: 'apellido' }),
      ]),
    );
  });
});
