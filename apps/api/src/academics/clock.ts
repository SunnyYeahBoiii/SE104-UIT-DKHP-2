import { Injectable } from '@nestjs/common'

/** Single place that reads the wall clock, so commands and read models share one "now" per request. */
@Injectable()
export class Clock {
  now(): Date {
    return new Date()
  }
}
