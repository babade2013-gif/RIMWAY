import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriverService } from '../src/drivers/driver.service';

describe('Phase 11 Priority Dispatch Engine', () => {
  let driverService: DriverService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      geosearch: vi.fn(),
      exists: vi.fn(),
      set: vi.fn(),
      geoadd: vi.fn(),
      zrem: vi.fn(),
    };
    mockPrisma = {
      driver: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      ride: {
        findFirst: vi.fn(),
      },
    };

    driverService = new DriverService(mockPrisma);
    // @ts-ignore
    driverService.redis = mockRedis;
  });

  it('PREFERRED comes before NORMAL regardless of distance, preserving distance order within tier', async () => {
    // d1: 1km (NORMAL)
    // d2: 2km (PREFERRED)
    // d3: 3km (NORMAL)
    // d4: 4km (PREFERRED)
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2', 'd3', 'd4']);
    mockRedis.exists.mockResolvedValue(1); // all fresh
    mockPrisma.ride.findFirst.mockResolvedValue(null); // no active rides
    mockRedis.set.mockResolvedValue(1); // setnx success

    mockPrisma.driver.findUnique.mockImplementation(({ where }: any) => {
      const drivers: Record<string, any> = {
        d1: { status: 'APPROVED', isOnline: true, priorityTier: 'NORMAL' },
        d2: { status: 'APPROVED', isOnline: true, priorityTier: 'PREFERRED' },
        d3: { status: 'APPROVED', isOnline: true, priorityTier: 'NORMAL' },
        d4: { status: 'APPROVED', isOnline: true, priorityTier: 'PREFERRED' },
      };
      return Promise.resolve(drivers[where.id]);
    });

    const eligible = await driverService.findNearbyEligibleDrivers(18.0, -15.9, 10, 'ride-1', 1, 10);
    // PREFERRED first: d2, d4. Then NORMAL: d1, d3
    expect(eligible).toEqual(['d2', 'd4', 'd1', 'd3']);
  });

  it('Excludes offline PREFERRED driver', async () => {
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2']);
    mockRedis.exists.mockResolvedValue(1); // all fresh
    mockPrisma.ride.findFirst.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(1);

    mockPrisma.driver.findUnique.mockImplementation(({ where }: any) => {
      const drivers: Record<string, any> = {
        d1: { status: 'APPROVED', isOnline: false, priorityTier: 'PREFERRED' }, // offline
        d2: { status: 'APPROVED', isOnline: true, priorityTier: 'NORMAL' },
      };
      return Promise.resolve(drivers[where.id]);
    });

    const eligible = await driverService.findNearbyEligibleDrivers(18.0, -15.9, 10, 'ride-1', 1, 10);
    expect(eligible).toEqual(['d2']);
  });

  it('Excludes stale PREFERRED driver (missing Redis TTL freshness)', async () => {
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2']);
    mockRedis.exists.mockImplementation((k: string) => Promise.resolve(k.includes('d1') ? 0 : 1)); // d1 stale
    mockPrisma.ride.findFirst.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(1);

    mockPrisma.driver.findUnique.mockImplementation(({ where }: any) => {
      const drivers: Record<string, any> = {
        d1: { status: 'APPROVED', isOnline: true, priorityTier: 'PREFERRED' },
        d2: { status: 'APPROVED', isOnline: true, priorityTier: 'NORMAL' },
      };
      return Promise.resolve(drivers[where.id]);
    });

    const eligible = await driverService.findNearbyEligibleDrivers(18.0, -15.9, 10, 'ride-1', 1, 10);
    expect(eligible).toEqual(['d2']);
  });

  it('Excludes suspended or pending PREFERRED driver', async () => {
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2', 'd3']);
    mockRedis.exists.mockResolvedValue(1);
    mockPrisma.ride.findFirst.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(1);

    mockPrisma.driver.findUnique.mockImplementation(({ where }: any) => {
      const drivers: Record<string, any> = {
        d1: { status: 'SUSPENDED', isOnline: true, priorityTier: 'PREFERRED' },
        d2: { status: 'PENDING', isOnline: true, priorityTier: 'PREFERRED' },
        d3: { status: 'APPROVED', isOnline: true, priorityTier: 'NORMAL' },
      };
      return Promise.resolve(drivers[where.id]);
    });

    const eligible = await driverService.findNearbyEligibleDrivers(18.0, -15.9, 10, 'ride-1', 1, 10);
    expect(eligible).toEqual(['d3']);
  });

  it('Excludes busy PREFERRED driver with active ride in Postgres', async () => {
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2']);
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue(1);

    mockPrisma.ride.findFirst.mockImplementation(({ where }: any) => {
      if (where.driverId === 'd1') return Promise.resolve({ id: 'active-ride-1', status: 'IN_PROGRESS' });
      return Promise.resolve(null);
    });

    mockPrisma.driver.findUnique.mockImplementation(({ where }: any) => {
      const drivers: Record<string, any> = {
        d1: { status: 'APPROVED', isOnline: true, priorityTier: 'PREFERRED' }, // busy
        d2: { status: 'APPROVED', isOnline: true, priorityTier: 'NORMAL' },
      };
      return Promise.resolve(drivers[where.id]);
    });

    const eligible = await driverService.findNearbyEligibleDrivers(18.0, -15.9, 10, 'ride-1', 1, 10);
    expect(eligible).toEqual(['d2']);
  });

  it('Top N limits the returned drivers after priority sorting', async () => {
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2', 'd3', 'd4']);
    mockRedis.exists.mockResolvedValue(1);
    mockPrisma.ride.findFirst.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(1);

    mockPrisma.driver.findUnique.mockImplementation(({ where }: any) => {
      const drivers: Record<string, any> = {
        d1: { status: 'APPROVED', isOnline: true, priorityTier: 'NORMAL' },
        d2: { status: 'APPROVED', isOnline: true, priorityTier: 'PREFERRED' },
        d3: { status: 'APPROVED', isOnline: true, priorityTier: 'PREFERRED' },
        d4: { status: 'APPROVED', isOnline: true, priorityTier: 'NORMAL' },
      };
      return Promise.resolve(drivers[where.id]);
    });

    // Top 2: should return d2 and d3 (the two PREFERRED)
    const eligible = await driverService.findNearbyEligibleDrivers(18.0, -15.9, 10, 'ride-1', 1, 2);
    expect(eligible).toEqual(['d2', 'd3']);
  });
});
