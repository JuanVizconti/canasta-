import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';

describe('UserService', () => {
  const createUserDto = {
    usuario: 'Usuario de prueba',
    email: 'user@email.com',
    password: 'password123',
  };

  beforeEach(() => {
    process.env.DATABASE_URL ??=
      'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
  });

  it('hashes the password before creating the user', async () => {
    const service = new UserService();
    const prisma = {
      user: {
        create: jest.fn().mockResolvedValue({
          id: 1,
          usuario: createUserDto.usuario,
          email: createUserDto.email,
        }),
      },
    };

    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.create(createUserDto)).resolves.toEqual({
      id: 1,
      usuario: createUserDto.usuario,
      email: createUserDto.email,
    });

    const createData = prisma.user.create.mock.calls[0][0].data;
    expect(createData).toMatchObject({
      usuario: createUserDto.usuario,
      email: createUserDto.email,
    });
    await expect(bcrypt.compare(createUserDto.password, createData.passwordHash)).resolves.toBe(
      true,
    );
  });

  it('propagates a Prisma unique constraint error from user.create', async () => {
    const service = new UserService();
    const uniqueConstraintError = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });
    const prisma = {
      user: {
        create: jest.fn().mockRejectedValue(uniqueConstraintError),
      },
    };

    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.create(createUserDto)).rejects.toBe(uniqueConstraintError);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });
});
