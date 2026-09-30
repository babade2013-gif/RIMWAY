import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.enableCors();

  // Ensure upload directories exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const documentsDir = path.join(uploadsDir, 'documents');
  const vehiclesDir = path.join(uploadsDir, 'vehicles');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(documentsDir)) fs.mkdirSync(documentsDir, { recursive: true });
  if (!fs.existsSync(vehiclesDir)) fs.mkdirSync(vehiclesDir, { recursive: true });

  // Serve uploads statically
  app.use('/uploads', express.static(uploadsDir));
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('RIM WAY API')
    .setDescription('The RIM WAY Backend API Contract for Passenger and Driver Apps')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  if (!fs.existsSync('docs')) { fs.mkdirSync('docs'); }
  fs.writeFileSync('docs/openapi.json', JSON.stringify(document, null, 2));

  await app.listen(3000);
}
bootstrap();
