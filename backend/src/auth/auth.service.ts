import { HttpStatus, Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthErrorCode } from './auth-error-code.enum';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor(private readonly jwtService: JwtService) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        code: AuthErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
      });
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id });

    return { accessToken };
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
