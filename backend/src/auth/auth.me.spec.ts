import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthErrorCode } from './auth-error-code.enum';
import { AuthModule } from './auth.module';

describe('GET /auth/me', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const invalidSessionResponse = {
    statusCode: 401,
    code: AuthErrorCode.INVALID_SESSION,
    message: 'Unauthorized',
  };

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
    process.env.JWT_SECRET = 'test-jwt-secret';

    const module = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the authenticated user id for a valid token', async () => {
    const token = await jwtService.signAsync({ sub: 1 });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ id: 1 });
  });

  it('returns INVALID_SESSION when no token is sent', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401)
      .expect(invalidSessionResponse);
  });

  it('returns INVALID_SESSION for an invalid or expired token', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)
      .expect(invalidSessionResponse);

    const expiredToken = await jwtService.signAsync(
      { sub: 1 },
      { expiresIn: '-1s' },
    );

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401)
      .expect(invalidSessionResponse);
  });
});
