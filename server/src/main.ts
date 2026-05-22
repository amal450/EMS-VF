import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // JSON body parser limit for larger PDF image payloads
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // CORS Configuration
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  });

  const port = parseInt(process.env.PORT ?? '3000', 10) || 3000;
  try {
    await app.listen(port);
    console.log(`🔐 EMS API running on http://localhost:${port}`);
  } catch (error: any) {
    if (error?.code === 'EADDRINUSE') {
      const fallbackPort = port + 1;
      console.warn(`Port ${port} is already in use, switching to ${fallbackPort}`);
      await app.listen(fallbackPort);
      console.log(`🔐 EMS API running on http://localhost:${fallbackPort}`);
    } else {
      throw error;
    }
  }

  console.log('📱 Client: http://localhost:4200');
}
bootstrap();
