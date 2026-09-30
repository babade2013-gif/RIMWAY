import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('AuthController - Refresh Endpoint Contract & Concurrency', () => {
  let controller: AuthController;
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { signAsync: vi.fn().mockResolvedValue('fake-jwt') } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should successfully rotate valid token', async () => {
    const mockToken = { id: 'token-1', userId: 'user-1', tokenHash: 'hashed', isRevoked: false, expiresAt: new Date(Date.now() + 10000), user: { role: 'PASSENGER' } };
    prismaMock.refreshToken.findUnique.mockResolvedValue(mockToken as any);
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.refreshToken.create.mockResolvedValue({} as any);

    const res = await controller.refresh({ refreshToken: 'valid' });
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
  });

  it('should block concurrent refresh requests safely using atomic DB transaction', async () => {
    const mockToken = { id: 'token-1', userId: 'user-1', tokenHash: 'hashed', isRevoked: false, expiresAt: new Date(Date.now() + 10000), user: { role: 'PASSENGER' } };
    prismaMock.refreshToken.findUnique.mockResolvedValue(mockToken as any);
    prismaMock.refreshToken.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
    prismaMock.refreshToken.create.mockResolvedValue({} as any);

    const req1 = controller.refresh({ refreshToken: 'valid' });
    const req2 = controller.refresh({ refreshToken: 'valid' });
    const results = await Promise.allSettled([req1, req2]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
  });
});
