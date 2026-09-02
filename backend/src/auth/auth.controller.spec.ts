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
});
