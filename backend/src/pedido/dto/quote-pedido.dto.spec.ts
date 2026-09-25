import { validate } from 'class-validator';
import { DeliveryMethod } from '../interfaces/delivery-method.enum';
import { QuotePedidoDto } from './quote-pedido.dto';

describe('QuotePedidoDto', () => {
  it.each([DeliveryMethod.PICKUP, DeliveryMethod.DELIVERY])(
    'accepts %s as a delivery method',
    async (deliveryMethod) => {
      const dto = Object.assign(new QuotePedidoDto(), { deliveryMethod });

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('rejects an unsupported delivery method', async () => {
    const dto = Object.assign(new QuotePedidoDto(), { deliveryMethod: 'DRONE' });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'deliveryMethod' })]),
    );
  });
});
