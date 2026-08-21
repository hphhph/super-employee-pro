import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ComputeService {
  constructor(private prisma: PrismaService) {}

  /** 获取用户配额 */
  async getQuota(userId: number) {
    let quota = await this.prisma.computeQuota.findUnique({ where: { userId } });
    if (!quota) {
      quota = await this.prisma.computeQuota.create({
        data: { userId, total: parseInt(process.env.DEFAULT_COMPUTE_QUOTA || '1000') },
      });
    }
    return { ...quota, remaining: quota.total - quota.used - quota.frozen };
  }

  /** 消耗记录 */
  async getLogs(userId: number, params: { page?: number; pageSize?: number; type?: string }) {
    const { page = 1, pageSize = 20, type } = params;
    const where = { userId, ...(type ? { type } : {}) };

    const [total, logs] = await Promise.all([
      this.prisma.computeLog.count({ where }),
      this.prisma.computeLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { list: logs, total, page, pageSize };
  }

  /** 扣减算力（内部调用）- 事务 + 条件更新，防止并发超扣 */
  async deduct(userId: number, type: string, cost: number, detail?: string) {
    return this.prisma.$transaction(async (tx) => {
      const quota = await tx.computeQuota.findUnique({ where: { userId } });
      if (!quota) throw new NotFoundException('用户配额不存在');

      const remaining = quota.total - quota.used - quota.frozen;
      if (remaining < cost) {
        throw new NotFoundException('算力不足，请联系管理员充值');
      }

      // 条件更新：仅当 used 未超过可用上限时才扣减，并发下只有一个请求成功
      const updated = await tx.computeQuota.updateMany({
        where: {
          userId,
          used: { lte: quota.total - quota.frozen - cost },
        },
        data: { used: { increment: cost } },
      });
      if (updated.count === 0) {
        throw new NotFoundException('算力不足，请联系管理员充值');
      }

      return tx.computeLog.create({
        data: { userId, type, cost, detail },
      });
    });
  }

  /** 充值（管理员） */
  async recharge(userId: number, amount: number) {
    const quota = await this.prisma.computeQuota.findUnique({ where: { userId } });
    if (!quota) throw new NotFoundException('用户配额不存在');

    return this.prisma.computeQuota.update({
      where: { userId },
      data: { total: { increment: amount } },
    });
  }
}
