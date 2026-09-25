import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplicationContext, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins, credentials: true },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Validation
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // CORS
  const originsStr = configService.get<string>('CORS_ORIGINS', '');
  const origins = originsStr.split(',').filter(Boolean);
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // WebSockets (game sessions)
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
