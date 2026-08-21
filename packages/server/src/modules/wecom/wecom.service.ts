import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WecomService {
  constructor(private prisma: PrismaService) {}

  // ===== 粉丝/客户管理 =====

  async findFans(params: { page?: number; pageSize?: number; keyword?: string; label?: string; status?: number }) {
    const { page = 1, pageSize = 20, keyword, label, status } = params;
    const where = {
      AND: [
        keyword ? { OR: [{ name: { contains: keyword } }, { remark: { contains: keyword } }] } : {},
        status !== undefined ? { status } : {},
      ],
    };

    const [total, fans] = await Promise.all([
      this.prisma.wecomFan.count({ where }),
      this.prisma.wecomFan.findMany({
        where,
        include: { device: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { list: fans, total, page, pageSize };
  }

  async getFanDetail(id: number) {
    const fan = await this.prisma.wecomFan.findUnique({
      where: { id },
      include: {
        device: true,
        sessions: { include: { _count: { select: { messages: true } } } },
      },
    });
    if (!fan) throw new NotFoundException('客户不存在');
    return fan;
  }

  async updateFan(id: number, data: Partial<{ name: string; remark: string; tags: any; labels: any; status: number }>) {
    return this.prisma.wecomFan.update({ where: { id }, data });
  }

  // ===== 标签管理 =====

  async findLabels() {
    return this.prisma.wecomLabel.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createLabel(data: { name: string; color?: string }) {
    return this.prisma.wecomLabel.create({ data });
  }

  async updateLabel(id: number, data: Partial<{ name: string; color: string }>) {
    return this.prisma.wecomLabel.update({ where: { id }, data });
  }

  async deleteLabel(id: number) {
    await this.prisma.wecomLabel.delete({ where: { id } });
    return { success: true };
  }

  // ===== 关键词回复 =====

  async findKeywords(params: { page?: number; pageSize?: number; keyword?: string }) {
    const { page = 1, pageSize = 20, keyword } = params;
    const where = keyword ? { keyword: { contains: keyword } } : {};

    const [total, list] = await Promise.all([
      this.prisma.wecomKeyword.count({ where }),
      this.prisma.wecomKeyword.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return { list, total, page, pageSize };
  }

  async createKeyword(data: any) {
    return this.prisma.wecomKeyword.create({ data });
  }

  async updateKeyword(id: number, data: any) {
    return this.prisma.wecomKeyword.update({ where: { id }, data });
  }

  async deleteKeyword(id: number) {
    await this.prisma.wecomKeyword.delete({ where: { id } });
    return { success: true };
  }

  // ===== 会话/消息 =====

  async findSessions(params: { page?: number; pageSize?: number; keyword?: string }) {
    const { page = 1, pageSize = 50, keyword } = params;
    const where = keyword ? { fan: { name: { contains: keyword } } } : {};

    const [total, sessions] = await Promise.all([
      this.prisma.wecomSession.count({ where }),
      this.prisma.wecomSession.findMany({
        where,
        include: { fan: true, device: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastMessageAt: 'desc' },
      }),
    ]);

    return { list: sessions, total, page, pageSize };
  }

  async getMessages(sessionId: number, params: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 50 } = params;
    const [total, messages] = await Promise.all([
      this.prisma.wecomMessage.count({ where: { sessionId } }),
      this.prisma.wecomMessage.findMany({
        where: { sessionId },
        include: { fan: { select: { name: true, avatar: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return { list: messages, total, page, pageSize };
  }

  // ===== 群发任务 =====

  async findBulkTasks(params: { page?: number; pageSize?: number; status?: string }) {
    const { page = 1, pageSize = 20, status } = params;
    const where = status ? { status } : {};

    const [total, list] = await Promise.all([
      this.prisma.wecomBulkTask.count({ where }),
      this.prisma.wecomBulkTask.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { list, total, page, pageSize };
  }

  async createBulkTask(data: any) {
    return this.prisma.wecomBulkTask.create({ data });
  }

  async updateBulkTaskStatus(id: number, status: string) {
    return this.prisma.wecomBulkTask.update({ where: { id }, data: { status } });
  }

  async deleteBulkTask(id: number) {
    await this.prisma.wecomBulkTask.delete({ where: { id } });
    return { success: true };
  }

  // ===== SOP 任务 =====

  async findSopTasks(params: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = params;
    const [total, list] = await Promise.all([
      this.prisma.wecomSopTask.count(),
      this.prisma.wecomSopTask.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async createSopTask(data: any) {
    return this.prisma.wecomSopTask.create({ data });
  }

  async deleteSopTask(id: number) {
    await this.prisma.wecomSopTask.delete({ where: { id } });
    return { success: true };
  }

  // ===== 设备管理 =====

  async findDevices() {
    return this.prisma.wecomDevice.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // ===== 统计 =====

  async getStats() {
    const [totalFans, totalSessions, todayNewFans, totalMessages, activeTasks] = await Promise.all([
      this.prisma.wecomFan.count({ where: { status: 1 } }),
      this.prisma.wecomSession.count(),
      this.prisma.wecomFan.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      this.prisma.wecomMessage.count(),
      this.prisma.wecomBulkTask.count({ where: { status: 'running' } }),
    ]);

    return { totalFans, totalSessions, todayNewFans, totalMessages, activeTasks };
  }
}
