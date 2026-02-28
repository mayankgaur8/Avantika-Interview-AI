import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Public — no auth needed to create a Razorpay order
  @Post('create-order')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.paymentsService.createOrder(dto);
  }

  // Protected — user must be logged in to verify & activate plan
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('verify')
  verifyPayment(@Body() dto: VerifyPaymentDto, @Request() req: any) {
    return this.paymentsService.verifyPayment(dto, req.user);
  }
}
