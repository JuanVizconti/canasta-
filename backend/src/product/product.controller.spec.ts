import { ProductController } from './product.controller';
import { ProductService } from './product.service';

describe('ProductController', () => {
  it('delegates the product query to ProductService', async () => {
    const products = [
      {
        id: 1,
        marca: 'Canasta',
        nombre: 'Producto de prueba',
        precio: '100.00',
        stock: 1,
        imgUrl: null,
      },
    ];
    const productService = {
      findAll: jest.fn().mockResolvedValue(products),
    } as unknown as ProductService;
    const controller = new ProductController(productService);

    await expect(controller.findAll()).resolves.toEqual(products);
    expect(productService.findAll).toHaveBeenCalledTimes(1);
  });
});
