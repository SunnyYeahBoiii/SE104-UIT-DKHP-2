import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common'

import { SepayService } from './sepay.service'

@Controller('webhooks')
export class SepayWebhookController {
  constructor(private readonly sepay: SepayService) {}

  @Post('sepay')
  @HttpCode(200)
  receive(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    return this.sepay.receive(authorization, body)
  }
}
