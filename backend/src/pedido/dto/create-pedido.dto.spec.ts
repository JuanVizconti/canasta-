import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePedidoDto } from './create-pedido.dto';

describe('CreatePedidoDto', () => {
  it('accepts CASH and rejects MERCADO_PAGO for POST /pedidos', async () => {
    const commonData = {
      personalInfo: {
        nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455',
      },
      delivery: { method: 'PICKUP' },
    };

    await expect(validate(plainToInstance(CreatePedidoDto, {
      ...commonData,
      paymentMethod: 'CASH',
    }))).resolves.toEqual([]);

    const errors = await validate(plainToInstance(CreatePedidoDto, {
      ...commonData,
      paymentMethod: 'MERCADO_PAGO',
    }));

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'paymentMethod' }),
    ]));
  });
});
