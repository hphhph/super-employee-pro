import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /** 工作台数据总览 */
  async getOverview() {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalUsers,
      totalFans,
      totalSessions,
      totalMessages,
      todayChatCount,
      todayImages,
      todayVideos,
      monthComputeCost,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.wecomFan.count({ where: { status: 1 } }),
      this.prisma.chatSession.count(),
      this.prisma.wecomMessage.count(),
      this.prisma.chatMessage.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.aiImage.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.aiVideo.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.computeLog.aggregate({ where: { createdAt: { gte: startOfMonth } }, _sum: { cost: true } }),
    ]);

    return {
      users: totalUsers,
      fans: totalFans,
      chatSessions: totalSessions,
      messages: totalMessages,
      today: {
        chats: todayChatCount,
        images: todayImages,
        videos: todayVideos,
      },
      monthComputeCost: monthComputeCost._sum.cost || 0,
    };
  }

  /** 最近7天趋势 */
  async getTrend() {
    const days: { date: string; chats: number; messages: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const start = new Date(day.setHours(0, 0, 0, 0));
      const end = new Date(day.setHours(23, 59, 59, 999));

      const [chats, messages] = await Promise.all([
        this.prisma.chatMessage.count({ where: { createdAt: { gte: start, lte: end } } }),
        this.prisma.wecomMessage.count({ where: { createdAt: { gte: start, lte: end } } }),
      ]);

      days.push({
        date: start.toISOString().slice(0, 10),
        chats,
        messages,
      });
    }
    return days;
  }
}
