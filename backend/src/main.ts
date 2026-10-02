import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({origin:['http://localhost:4200', process.env.FRONTEND_URL].filter(Boolean)});
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
