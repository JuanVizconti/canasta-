import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthErrorCode } from './interfaces/auth-error-code.enum';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const email = 'user2@email.com';
  const password = 'password123';

  beforeEach(() => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
  });

  it('rejects an unknown email with INVALID_CREDENTIALS', async () => {
    const jwtService = { signAsync: jest.fn() } as unknown as JwtService;
    const service = new AuthService(jwtService);
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };

    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expectUnauthorizedCredentials(service.login({ email, password }));
  });

  it('rejects an incorrect password with INVALID_CREDENTIALS', async () => {
    const jwtService = { signAsync: jest.fn() } as unknown as JwtService;
    const service = new AuthService(jwtService);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          usuario: 'Usuario de prueba',
          email,
          passwordHash: await bcrypt.hash('other-password', 4),
        }),
      },
    };

    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expectUnauthorizedCredentials(service.login({ email, password }));
  });

  it('returns a JWT with the user id as sub for valid credentials', async () => {
    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('jwt-token'),
    } as unknown as JwtService;
    const service = new AuthService(jwtService);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          usuario: 'Usuario de prueba',
          email,
          passwordHash: await bcrypt.hash(password, 4),
        }),
      },
    };

    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.login({ email, password })).resolves.toEqual({
      accessToken: 'jwt-token',
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 1 });
  });

  it('returns only the authenticated user profile fields required by the client', async () => {
    const jwtService = { signAsync: jest.fn() } as unknown as JwtService;
    const service = new AuthService(jwtService);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          usuario: 'Usuario de prueba',
          email,
        }),
      },
    };

    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.getProfile(1)).resolves.toEqual({
      id: 1,
      nombre: 'Usuario de prueba',
      email,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, usuario: true, email: true },
    });
  });

  async function expectUnauthorizedCredentials(login: Promise<unknown>) {
    try {
      await login;
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      const exception = error as UnauthorizedException;

      expect(exception.getStatus()).toBe(401);
      expect(exception.getResponse()).toEqual({
        statusCode: 401,
        code: AuthErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
      });
      return;
    }

    throw new Error('Expected login to reject');
  }
});
