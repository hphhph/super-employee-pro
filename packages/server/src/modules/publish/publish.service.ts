import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** 可发布平台（与 matrix_accounts.platform 对应） */
export const PUBLISH_PLATFORMS = [
  { code: 'douyin', name: '抖音' },
  { code: 'xiaohongshu', name: '小红书' },
  { code: 'wechat_channels', name: '视频号' },
  { code: 'kuaishou', name: '快手' },
  { code: 'bilibili', name: 'B站' },
  { code: 'weibo', name: '微博' },
];
const PUBLISH_PLATFORM_CODES = PUBLISH_PLATFORMS.map((p) => p.code);

const TASK_STATUS_TEXT: Record<string, string> = {
  pending: '待投递',
  processing: '发布中',
  scheduled: '定时中',
  success: '已发布',
  failed: '发布失败',
  cancelled: '已取消',
};

@Injectable()
export class PublishService {
  constructor(private prisma: PrismaService) {}

  // ===== 账号管理（matrix_accounts）=====
  async listAccounts() {
    return this.prisma.matrixAccount.findMany({ orderBy: { id: 'desc' } });
  }

  async createAccount(body: Record<string, any>) {
    if (!PUBLISH_PLATFORM_CODES.includes(body.platform)) {
      throw new BadRequestException('无效的平台');
    }
    if (!body.accountId) throw new BadRequestException('请填写平台账号 ID');
    return this.prisma.matrixAccount.create({
      data: {
        platform: body.platform,
        accountId: String(body.accountId),
        nickname: body.nickname || null,
        avatar: body.avatar || null,
        fans: Number(body.fans) || 0,
        status: body.status === 0 ? 0 : 1,
        token: body.token || null,
        refreshToken: body.refreshToken || null,
        tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
      },
    });
  }

  async updateAccount(id: number, body: Record<string, any>) {
    const account = await this.prisma.matrixAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('账号不存在');
    const patch: Record<string, any> = {};
    if (body.platform !== undefined) {
      if (!PUBLISH_PLATFORM_CODES.includes(body.platform)) throw new BadRequestException('无效的平台');
      patch.platform = body.platform;
    }
    if (body.accountId !== undefined) patch.accountId = String(body.accountId);
    if (body.nickname !== undefined) patch.nickname = body.nickname;
    if (body.avatar !== undefined) patch.avatar = body.avatar;
    if (body.fans !== undefined) patch.fans = Number(body.fans) || 0;
    if (body.status !== undefined) patch.status = body.status === 0 ? 0 : 1;
    if (body.token !== undefined) patch.token = body.token;
    if (body.refreshToken !== undefined) patch.refreshToken = body.refreshToken;
    return this.prisma.matrixAccount.update({ where: { id }, data: patch });
  }

  async deleteAccount(id: number) {
    await this.prisma.matrixAccount.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  }

  // ===== 发布任务（matrix_tasks + matrix_videos）=====
  async createTask(body: Record<string, any>) {
    const { name, videoId, title, url, thumbnail, duration, sourceType, sourceId, accountIds, mode, scheduledAt } = body;
    const accountList = Array.isArray(accountIds) ? accountIds.map(Number).filter((n) => n > 0) : [];
    if (!accountList.length) throw new BadRequestException('请至少选择一个发布账号');
    if (!['publish', 'schedule', 'batch_publish'].includes(mode)) {
      throw new BadRequestException('无效的发布模式');
    }
    if (mode === 'schedule') {
      if (!scheduledAt) throw new BadRequestException('定时发布需指定发布时间');
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        throw new BadRequestException('定时发布时间需晚于当前时间');
      }
    }
    if (!title && !url) throw new BadRequestException('请填写作品标题或视频地址');

    // 视频登记：优先复用传入 videoId，其次按 url 复用，否则新建
    let v: any = null;
    if (videoId) v = await this.prisma.matrixVideo.findUnique({ where: { id: Number(videoId) } });
    if (!v && url) v = await this.prisma.matrixVideo.findFirst({ where: { url } });
    if (!v) {
      v = await this.prisma.matrixVideo.create({
        data: {
          title: title || name || '未命名视频',
          url: url || null,
          thumbnail: thumbnail || null,
          duration: duration ? Number(duration) : null,
          description: sourceType ? `来源:${sourceType}#${sourceId}` : null,
        },
      });
    }

    const task = await this.prisma.matrixTask.create({
      data: {
        name: name || v.title || '发布任务',
        type: mode,
        accountIds: accountList,
        videoId: v.id,
        scheduledAt: mode === 'schedule' ? new Date(scheduledAt) : null,
        status: mode === 'schedule' ? 'scheduled' : 'pending',
        total: accountList.length,
        success: 0,
        failed: 0,
      },
      include: { video: true },
    });
    return this.decorateTask(task);
  }

  async listTasks(query: { page?: number; pageSize?: number; status?: string }) {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
    const where: Record<string, any> = {};
    if (query.status && query.status !== 'all') where.status = query.status;
    const [total, list] = await Promise.all([
      this.prisma.matrixTask.count({ where }),
      this.prisma.matrixTask.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { video: true },
      }),
    ]);
    const decorated = await Promise.all(list.map((t) => this.decorateTask(t)));
    return { total, list: decorated, page, pageSize };
  }

  async cancelTask(id: number) {
    const task = await this.prisma.matrixTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.status !== 'scheduled') throw new BadRequestException('仅定时发布任务可取消');
    return this.prisma.matrixTask.update({ where: { id }, data: { status: 'cancelled' } });
  }

  async deleteTask(id: number) {
    await this.prisma.matrixTask.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  }

  // ===== 看板 =====
  async stats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [totalTasks, pending, scheduled, cancelled, today, accountCount, allAccounts] = await Promise.all([
      this.prisma.matrixTask.count(),
      this.prisma.matrixTask.count({ where: { status: 'pending' } }),
      this.prisma.matrixTask.count({ where: { status: 'scheduled' } }),
      this.prisma.matrixTask.count({ where: { status: 'cancelled' } }),
      this.prisma.matrixTask.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.matrixAccount.count(),
      this.prisma.matrixAccount.findMany({ select: { id: true, platform: true } }),
    ]);
    const taskAccounts = await this.prisma.matrixTask.findMany({ select: { accountIds: true } });
    const byPlatform: Record<string, number> = {};
    for (const t of taskAccounts) {
      const ids = Array.isArray(t.accountIds) ? (t.accountIds as number[]) : [];
      for (const a of allAccounts) {
        if (ids.includes(a.id)) byPlatform[a.platform] = (byPlatform[a.platform] || 0) + 1;
      }
    }
    return {
      totalTasks,
      pending,
      scheduled,
      cancelled,
      today,
      accountCount,
      platformList: PUBLISH_PLATFORMS.map((p) => ({ code: p.code, name: p.name, count: byPlatform[p.code] || 0 })),
    };
  }

  // ===== 内部工具 =====
  /** 把 accountIds 展开为账号对象，附带状态文案 */
  private async decorateTask(task: any) {
    const ids: number[] = Array.isArray(task.accountIds) ? (task.accountIds as number[]) : [];
    const accounts = ids.length
      ? await this.prisma.matrixAccount.findMany({ where: { id: { in: ids } } })
      : [];
    const { accountIds: _acc, ...rest } = task;
    return { ...rest, accountIds: ids, accounts, statusText: TASK_STATUS_TEXT[task.status] || task.status };
  }
}
