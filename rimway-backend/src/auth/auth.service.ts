import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async sendOtp(phone: string) {
    // DEVELOPMENT MODE: Always fixed OTP for now. 
    // TODO: Integrate real SMS/OTP provider for production.
    return { success: true };
  }

  async verifyOtp(phone: string, otp: string, role: any) {
    if (otp !== '1234') throw new UnauthorizedException('Invalid OTP');
    
    let user = await this.prisma.user.findFirst({ 
      where: { phone }, 
      include: { driverProfile: true } 
    });
    
    if (!user) {
      user = await this.prisma.user.create({ 
        data: { phone, role }, 
        include: { driverProfile: true } 
      });
    }

    // Auto-create driver profile if role is DRIVER and it doesn't exist
    if (user.role === 'DRIVER' && !user.driverProfile) {
        const newDriver = await this.prisma.driver.create({ data: { userId: user.id } });
        user.driverProfile = newDriver;
    }

    return this.generateTokens(user.id, user.role, user.driverProfile?.id);
  }

  async generateTokens(userId: string, role: string, driverId?: string) {
    const payload = { sub: userId, role, driverId };
    const accessToken = await this.jwtService.signAsync(payload);
    
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Configurable

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken, role };
  }

  async refresh(token: string) {
    const hash = this.hashToken(token);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: { include: { driverProfile: true } } },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Atomic concurrent refresh protection (Idempotency against refresh storms)
    const result = await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, isRevoked: false },
      data: { isRevoked: true },
    });

    if (result.count === 0) {
      throw new UnauthorizedException('Token already rotated concurrently');
    }

    return this.generateTokens(stored.userId, stored.user.role, stored.user.driverProfile?.id);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    return { success: true };
  }
}
