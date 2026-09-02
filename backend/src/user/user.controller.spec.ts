import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  it('delegates user creation to UserService', async () => {
    const createUserDto = {
      usuario: 'Usuario de prueba',
      email: 'user2@email.com',
      password: 'password123',
    };
    const userService = {
      create: jest.fn().mockResolvedValue({
        id: 1,
        usuario: createUserDto.usuario,
        email: createUserDto.email,
      }),
    } as unknown as UserService;
    const controller = new UserController(userService);

    await expect(controller.create(createUserDto)).resolves.toEqual({
      id: 1,
      usuario: createUserDto.usuario,
      email: createUserDto.email,
    });
    expect(userService.create).toHaveBeenCalledWith(createUserDto);
  });
});
