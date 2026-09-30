import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface PricingFactors {
  baseFare: Prisma.Decimal;
  perKm: Prisma.Decimal;
  perMinute: Prisma.Decimal;
  surgeRate: Prisma.Decimal;
  minFare: Prisma.Decimal;
  distanceKm: Prisma.Decimal;
  estimatedTimeMin: Prisma.Decimal;
  discountFixed?: Prisma.Decimal;
  discountPct?: Prisma.Decimal; 
  maxDiscount?: Prisma.Decimal;
}

@Injectable()
export class PricingService {
  public calculateEstimate(factors: PricingFactors): Prisma.Decimal {
    const distanceFare = factors.distanceKm.mul(factors.perKm);
    const timeFare = factors.estimatedTimeMin.mul(factors.perMinute);
    
    let subtotal = factors.baseFare.add(distanceFare).add(timeFare).mul(factors.surgeRate);
    
    if (subtotal.lessThan(factors.minFare)) {
      subtotal = factors.minFare;
    }

    let discountAmount = new Prisma.Decimal(0);
    if (factors.discountPct && factors.discountPct.greaterThan(0)) {
      discountAmount = subtotal.mul(factors.discountPct);
    } else if (factors.discountFixed && factors.discountFixed.greaterThan(0)) {
      discountAmount = factors.discountFixed;
    }

    if (factors.maxDiscount && discountAmount.greaterThan(factors.maxDiscount)) {
      discountAmount = factors.maxDiscount;
    }

    let finalFare = subtotal.sub(discountAmount);
    
    if (finalFare.lessThan(0)) {
      finalFare = new Prisma.Decimal(0);
    }

    return finalFare.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }
}
