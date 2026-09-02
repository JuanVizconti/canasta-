import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const email = 'user2@email.com';
  const password = 'password123';

  beforeEach(() => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
  });

  it('rejects an unknown email', async () => {
    const jwtService = { signAsync: jest.fn() } as unknown as JwtService;
    const service = new AuthService(jwtService);
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };

    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.login({ email, password })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
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
});
