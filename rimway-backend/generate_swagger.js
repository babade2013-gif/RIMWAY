const { NestFactory } = require('@nestjs/core');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { AppModule } = require('./dist/app.module.js');
const fs = require('fs');

async function generate() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('RIM WAY API')
    .setDescription('The RIM WAY Backend API Contract for Passenger and Driver Apps')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  if (!fs.existsSync('docs')) { fs.mkdirSync('docs'); }
  fs.writeFileSync('docs/openapi.json', JSON.stringify(document, null, 2));
  console.log('OpenAPI Generated!');
  process.exit(0);
}
generate();
