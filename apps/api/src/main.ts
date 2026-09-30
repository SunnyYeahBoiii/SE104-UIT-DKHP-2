import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // nginx routes /api/* here (ADR-0012), so every route lives under this prefix.
  app.setGlobalPrefix('api')
  app.enableShutdownHooks()
  await app.listen(Number(process.env.PORT ?? 3001))
}

await bootstrap()
