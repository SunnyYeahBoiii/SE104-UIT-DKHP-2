import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { WorkerModule } from './term-phases/term-phase.worker'

const app = await NestFactory.createApplicationContext(WorkerModule)
app.enableShutdownHooks()
