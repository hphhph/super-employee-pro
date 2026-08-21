import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const COMPETITOR_PLATFORMS = [
  { value: 'douyin', label: '抖音' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'kuaishou', label: '快手' },
  { value: 'wechat_channels', label: '微信视频号' },
  { value: 'bilibili', label: 'B站' },
  { value: 'weibo', label: '微博' },
];

@Injectable()
export class CompetitorService {
  constructor(private prisma: PrismaService) {}

  // ===== 账号 =====
  async listAccounts() {
    const accounts = await this.prisma.competitorAccount.findMany({
      orderBy: { id: 'desc' },
      include: { _count: { select: { works: true } } },
    });
    return accounts.map((a: any) => ({
      ...a,
      workCount: a._count?.works || 0,
      _count: undefined,
    }));
  }

  async createAccount(data: Record<string, any>) {
    return this.prisma.competitorAccount.create({
      data: {
        platform: data.platform,
        name: data.name.slice(0, 100),
        url: data.url || null,
        fans: Number(data.fans) || 0,
        remark: data.remark || null,
      },
    });
  }

  async updateAccount(id: number, data: any) {
    const patch: any = {};
    if (data.platform !== undefined) patch.platform = data.platform;
    if (data.name !== undefined) patch.name = String(data.name).slice(0, 100);
    if (data.url !== undefined) patch.url = data.url || null;
    if (data.fans !== undefined) patch.fans = Number(data.fans) || 0;
    if (data.remark !== undefined) patch.remark = data.remark || null;
    if (data.status !== undefined) patch.status = Number(data.status);
    return this.prisma.competitorAccount.update({ where: { id }, data: patch });
  }

  async deleteAccount(id: number) {
    await this.prisma.competitorAccount.delete({ where: { id } });
    return { ok: true };
  }

  // ===== 作品 =====
  async listWorks(params: { accountId?: number; page?: number; pageSize?: number }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const where: any = {};
    if (params.accountId) where.accountId = Number(params.accountId);
    const total = await this.prisma.competitorWork.count({ where });
    const list = await this.prisma.competitorWork.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { account: { select: { id: true, name: true, platform: true } } },
    });
    return { list, total, page, pageSize };
  }

  async createWork(data: Record<string, any>) {
    return this.prisma.competitorWork.create({
      data: {
        accountId: Number(data.accountId),
        title: String(data.title).slice(0, 500),
        url: data.url || null,
        coverUrl: data.coverUrl || null,
        likes: Number(data.likes) || 0,
        comments: Number(data.comments) || 0,
        shares: Number(data.shares) || 0,
        views: Number(data.views) || 0,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        isHot: !!data.isHot,
      },
    });
  }

  async updateWork(id: number, data: any) {
    const patch: any = {};
    for (const k of ['title', 'url', 'coverUrl', 'likes', 'comments', 'shares', 'views', 'isHot', 'accountId']) {
      if (data[k] !== undefined) patch[k] = data[k];
    }
    if (data.publishedAt !== undefined) patch.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    return this.prisma.competitorWork.update({ where: { id }, data: patch });
  }

  async deleteWork(id: number) {
    await this.prisma.competitorWork.delete({ where: { id } });
    return { ok: true };
  }

  // ===== 数据看板 =====
  async stats() {
    const [accountCount, workCount, hotCount, recentWorks, topWorks, accounts] = await Promise.all([
      this.prisma.competitorAccount.count({ where: { status: 1 } }),
      this.prisma.competitorWork.count(),
      this.prisma.competitorWork.count({ where: { isHot: true } }),
      this.prisma.competitorWork.count({
        where: { publishedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      }),
      this.prisma.competitorWork.findMany({
        orderBy: { likes: 'desc' },
        take: 5,
        include: { account: { select: { name: true, platform: true } } },
      }),
      this.prisma.competitorAccount.findMany({
        orderBy: { id: 'desc' },
        include: { _count: { select: { works: true } } },
      }),
    ]);

    const totalLikes = await this.prisma.competitorWork.aggregate({ _sum: { likes: true } });

    return {
      accountCount,
      workCount,
      hotCount,
      recent7d: recentWorks,
      totalLikes: totalLikes._sum.likes || 0,
      topWorks: topWorks.map((w: any) => ({
        id: w.id,
        title: w.title,
        likes: w.likes,
        views: w.views,
        accountName: w.account?.name || '',
        platform: w.account?.platform || '',
      })),
      accounts: accounts.map((a: any) => ({
        id: a.id,
        name: a.name,
        platform: a.platform,
        fans: a.fans,
        workCount: a._count?.works || 0,
      })),
    };
  }
}
