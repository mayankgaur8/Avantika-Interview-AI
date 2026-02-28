import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { User, PlanTier } from '../users/user.entity';
import { CreateOrderDto, VerifyPaymentDto, PlanType, BillingCycle } from './dto/payment.dto';

// INR amounts in paise (1 INR = 100 paise)
const PLAN_PRICES: Record<PlanType, Record<BillingCycle, number>> = {
  [PlanType.PRO]: {
    [BillingCycle.MONTHLY]: 159900,   // ₹1,599
    [BillingCycle.YEARLY]: 143880,    // ₹1,199 × 12
  },
  [PlanType.ENTERPRISE]: {
    [BillingCycle.MONTHLY]: 659900,   // ₹6,599
    [BillingCycle.YEARLY]: 599880,    // ₹4,999 × 12
  },
};

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.config.get<string>('razorpay.keyId') ?? '',
      key_secret: this.config.get<string>('razorpay.keySecret') ?? '',
    });
  }

  async createOrder(dto: CreateOrderDto) {
    const amount = PLAN_PRICES[dto.plan][dto.billing];
    const order = await this.razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.config.get<string>('razorpay.keyId'),
    };
  }

  async verifyPayment(dto: VerifyPaymentDto, user: User) {
    const keySecret = this.config.get<string>('razorpay.keySecret') ?? '';
    const body = `${dto.razorpayOrderId}|${dto.razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== dto.razorpaySignature) {
      throw new BadRequestException('Invalid payment signature');
    }

    const planTier = dto.plan === PlanType.PRO ? PlanTier.PRO : PlanTier.ENTERPRISE;
    const daysToAdd = dto.billing === BillingCycle.YEARLY ? 365 : 30;
    const planExpiresAt = new Date();
    planExpiresAt.setDate(planExpiresAt.getDate() + daysToAdd);

    await this.userRepo.update(user.id, { plan: planTier, planExpiresAt });

    return { success: true, plan: planTier, planExpiresAt };
  }
}
