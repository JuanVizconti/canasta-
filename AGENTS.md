Canasta

## Contexto

Canasta es una aplicación web de supermercado para compras online.

## Stack previsto

- TypeScript
- Frontend: Angular
- Backend: NestJS
- Base de datos: PostgreSQL
- ORM: Prisma (opción prevista; aún no es una decisión definitiva)

## Alcance del MVP

El MVP debe permitir que una persona usuaria:

1. Navegue productos.
2. Agregue productos al carrito y modifique sus cantidades.
3. Se registre o inicie sesión durante el checkout.
4. Complete el checkout.
5. Elija un método de entrega.
6. Elija un método de pago.
7. Reciba una confirmación de la compra.

No implementar todavía roles o administración, categorías, vencimiento, contenido, pagos reales ni funcionalidades fuera de este MVP.

## Modelo conceptual actual

- `Product(id, marca, nombre, precio, stock, imgUrl)`
- `User(id, nombre, email, passwordHash)`
- `Cart(items: CartItem[])`
- `CartItem(product, quantity)`
- `Order(items: OrderItem[], precioTotal)`
- `OrderItem(product, quantity, price)`
- `Pedido(id, user, datosPersonales, metodoEntrega, fechaEntrega, metodoPago, precio, order)`

## Reglas de negocio ya acordadas

- `Order` es una copia congelada del carrito al momento de la compra.
- `Pedido` se crea después de que el pago se procese exitosamente.
- El `Cart` se vacía después de confirmar la compra.
- `Order.precioTotal` representa solo el total de los productos.
- `Pedido.precio` representa el total final, incluidas las tarifas aplicables.

## Criterio de trabajo

Antes de sumar decisiones de producto, arquitectura o modelo de datos que no estén documentadas aquí, pedir confirmación. Mantener la implementación enfocada en el MVP.
