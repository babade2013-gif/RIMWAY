import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { vi } from 'vitest';

describe('AuthService - Phase 4.2 Fixes', () => {
  let authService: AuthService;

  const prismaMock = {
    user: { findFirst: vi.fn(), create: vi.fn() },
    driver: { create: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() }
  };

  const jwtMock = { signAsync: vi.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock }
      ]
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('verifyOtp assigns proper token for passenger', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', role: 'PASSENGER', driverProfile: null });
    jwtMock.signAsync.mockResolvedValue('jwt-mock');
    const tokens = await authService.verifyOtp('+123', '1234', 'PASSENGER');
    expect(tokens.accessToken).toBe('jwt-mock');
    expect(jwtMock.signAsync).toHaveBeenCalledWith({ sub: 'u1', role: 'PASSENGER', driverId: undefined });
  });

  it('verifyOtp auto-creates driver profile if missing', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u2', role: 'DRIVER', driverProfile: null });
    prismaMock.driver.create.mockResolvedValue({ id: 'd1', userId: 'u2' });
    jwtMock.signAsync.mockResolvedValue('jwt-mock-d');
    
    await authService.verifyOtp('+456', '1234', 'DRIVER');
    expect(prismaMock.driver.create).toHaveBeenCalledWith({ data: { userId: 'u2' }});
    expect(jwtMock.signAsync).toHaveBeenCalledWith({ sub: 'u2', role: 'DRIVER', driverId: 'd1' });
  });

  it('refresh token protects against concurrent refresh via count check', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      tokenHash: 'xyz', expiresAt: new Date(Date.now() + 100000), isRevoked: false,
      userId: 'u1', user: { role: 'PASSENGER', driverProfile: null }
    });
    // Simulate someone already used this token
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 } as any);
    
    await expect(authService.refresh('token')).rejects.toThrow(UnauthorizedException);
  });
});
