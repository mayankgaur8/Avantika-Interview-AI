import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.paymentsService.createOrder(dto);
  }

  @Post('verify')
  verifyPayment(@Body() dto: VerifyPaymentDto, @Request() req: any) {
    return this.paymentsService.verifyPayment(dto, req.user);
  }
}
