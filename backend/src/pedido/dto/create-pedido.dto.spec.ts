import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { CreatePedidoDto } from './create-pedido.dto';

describe('CreatePedidoDto', () => {
  const validDto = () => plainToInstance(CreatePedidoDto, {
    personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '1234567', telefono: '1122334455' },
    delivery: { method: 'PICKUP' },
    paymentMethod: PaymentMethod.CASH,
  });

  it('accepts PICKUP with valid personal information and CASH', async () => {
    await expect(validate(validDto())).resolves.toHaveLength(0);
  });

  it('requires a complete address for DELIVERY', async () => {
    const dto = plainToInstance(CreatePedidoDto, { ...validDto(), delivery: { method: 'DELIVERY' } });
    await expect(validate(dto)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ property: 'delivery' })]));
  });

  it('rejects invalid personal information', async () => {
    const dto = plainToInstance(CreatePedidoDto, {
      ...validDto(), personalInfo: { nombre: 'J', apellido: 'P', dni: '12ab', telefono: '123' },
    });
    await expect(validate(dto)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ property: 'personalInfo' })]));
  });
});
