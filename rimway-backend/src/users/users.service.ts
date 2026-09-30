import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async create(phone: string, role: 'PASSENGER' | 'DRIVER' | 'ADMIN' = 'PASSENGER') {
    return this.prisma.user.create({
      data: { phone, role },
    });
  }
}
