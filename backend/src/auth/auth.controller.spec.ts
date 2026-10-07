import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  it('delegates login to AuthService', async () => {
    const loginDto = {
      email: 'user2@email.com',
      password: 'password123',
    };
    const authService = {
      login: jest.fn().mockResolvedValue({ accessToken: 'jwt-token' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.login(loginDto)).resolves.toEqual({
      accessToken: 'jwt-token',
    });
    expect(authService.login).toHaveBeenCalledWith(loginDto);
  });

  it('uses the authenticated user id to retrieve the current profile', async () => {
    const profile = { id: 7, nombre: 'Juan', email: 'juan@email.com' };
    const authService = {
      getProfile: jest.fn().mockResolvedValue(profile),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.me({ user: { id: 7 } } as never)).resolves.toEqual(profile);
    expect(authService.getProfile).toHaveBeenCalledWith(7);
  });
});
