import { IsEnum, IsString } from 'class-validator';

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum PlanType {
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export class CreateOrderDto {
  @IsEnum(PlanType)
  plan: PlanType;

  @IsEnum(BillingCycle)
  billing: BillingCycle;
}

export class VerifyPaymentDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;

  @IsEnum(PlanType)
  plan: PlanType;

  @IsEnum(BillingCycle)
  billing: BillingCycle;
}
