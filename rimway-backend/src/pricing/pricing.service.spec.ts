import { PricingService } from './pricing.service';
import { Prisma } from '@prisma/client';

describe('PricingService Comprehensive', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  it('should calculate 1.2 Surge correctly', () => {
    const estimate = service.calculateEstimate({
      baseFare: new Prisma.Decimal(50),
      perKm: new Prisma.Decimal(10),
      perMinute: new Prisma.Decimal(2),
      surgeRate: new Prisma.Decimal(1.2),
      minFare: new Prisma.Decimal(100),
      distanceKm: new Prisma.Decimal(10), // 100
      estimatedTimeMin: new Prisma.Decimal(20), // 40
    });
    // (50 + 100 + 40) * 1.2 = 190 * 1.2 = 228
    expect(estimate.toNumber()).toBe(228);
  });

  it('should apply maximum discount cap', () => {
    const estimate = service.calculateEstimate({
      baseFare: new Prisma.Decimal(50), perKm: new Prisma.Decimal(10), perMinute: new Prisma.Decimal(2),
      surgeRate: new Prisma.Decimal(1.0), minFare: new Prisma.Decimal(0), distanceKm: new Prisma.Decimal(10), estimatedTimeMin: new Prisma.Decimal(20),
      discountPct: new Prisma.Decimal(0.50), // 50% discount
      maxDiscount: new Prisma.Decimal(50)    // Capped at 50
    });
    // subtotal = 190. 50% = 95. Capped at 50. Final = 190 - 50 = 140.
    expect(estimate.toNumber()).toBe(140);
  });

  it('should apply fixed discount', () => {
    const estimate = service.calculateEstimate({
      baseFare: new Prisma.Decimal(50), perKm: new Prisma.Decimal(10), perMinute: new Prisma.Decimal(2),
      surgeRate: new Prisma.Decimal(1.0), minFare: new Prisma.Decimal(0), distanceKm: new Prisma.Decimal(10), estimatedTimeMin: new Prisma.Decimal(20),
      discountFixed: new Prisma.Decimal(30)
    });
    // 190 - 30 = 160
    expect(estimate.toNumber()).toBe(160);
  });

  it('should round safely and never return negative', () => {
    const estimate = service.calculateEstimate({
      baseFare: new Prisma.Decimal(10), perKm: new Prisma.Decimal(1), perMinute: new Prisma.Decimal(1),
      surgeRate: new Prisma.Decimal(1.0), minFare: new Prisma.Decimal(0), distanceKm: new Prisma.Decimal(1), estimatedTimeMin: new Prisma.Decimal(1),
      discountFixed: new Prisma.Decimal(100)
    });
    // Subtotal 12, Discount 100 -> should be 0
    expect(estimate.toNumber()).toBe(0);
  });
});
