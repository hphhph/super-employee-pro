import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; pageSize?: number; keyword?: string; departmentId?: number; role?: string }) {
    const { page = 1, pageSize = 20, keyword, departmentId, role } = params;
    const where = {
      AND: [
        keyword ? { OR: [{ username: { contains: keyword } }, { nickname: { contains: keyword } }, { phone: { contains: keyword } }] } : {},
        departmentId ? { departmentId } : {},
        role ? { role } : {},
      ],
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { department: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      list: users.map(({ password, ...u }) => u),
      total,
      page,
      pageSize,
    };
  }

  async create(data: { username: string; password: string; nickname?: string; phone?: string; role?: string; departmentId?: number; avatar?: string }) {
    const exists = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (exists) throw new BadRequestException('用户名已存在');

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: { ...data, password: hashed },
      include: { department: true },
    });

    // 初始化算力配额
    await this.prisma.computeQuota.create({
      data: { userId: user.id, total: parseInt(process.env.DEFAULT_COMPUTE_QUOTA || '1000') },
    });

    const { password, ...userInfo } = user;
    return userInfo;
  }

  async update(id: number, data: Partial<{ nickname: string; phone: string; role: string; departmentId: number; avatar: string; status: number; password: string }>) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { department: true },
    });
    const { password, ...userInfo } = updated;
    return userInfo;
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.role === 'admin') throw new BadRequestException('不能删除管理员账号');

    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
