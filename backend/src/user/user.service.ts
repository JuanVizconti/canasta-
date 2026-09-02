import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async create({ password, ...user }: CreateUserDto) {
    const passwordHash = await bcrypt.hash(password, 12);

    return this.prisma.user.create({
      data: {
        ...user,
        passwordHash,
      },
      select: {
        id: true,
        usuario: true,
        email: true,
      },
    });
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
