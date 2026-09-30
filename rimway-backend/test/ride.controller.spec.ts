
import { Test, TestingModule } from '@nestjs/testing';
import { RideController } from '../src/rides/ride.controller';
import { RideService } from '../src/rides/ride.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { vi } from 'vitest';

describe('RideController', () => {
  let controller: RideController;
  let service: RideService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RideController],
      providers: [
        {
          provide: RideService,
          useValue: {
            estimateFare: vi.fn(),
            requestRide: vi.fn(),
            cancelRide: vi.fn(),
            getCurrentRide: vi.fn()
          },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
    .compile();

    controller = module.get<RideController>(RideController);
    service = module.get<RideService>(RideService);
  });

  it('should call requestRide on service with idempotency key', async () => {
    const dto = { pickupLat: 0, pickupLng: 0, dropoffLat: 0, dropoffLng: 0, serviceTypeId: '1', pickupName: '', dropoffName: '' };
    const req = { user: { sub: 'pass-1', role: 'PASSENGER' } };
    await controller.requestRide(dto, req, 'key-123');
    expect(service.requestRide).toHaveBeenCalledWith('pass-1', dto, 'key-123');
  });
});
