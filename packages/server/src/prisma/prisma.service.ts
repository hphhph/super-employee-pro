import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  static readonly isDbReady = { value: false };

  async onModuleInit() {
    try {
      await this.$connect();
      PrismaService.isDbReady.value = true;
      this.logger.log('数据库连接成功');
    } catch (e) {
      this.logger.error(`数据库连接失败（服务仍将启动，数据库相关接口不可用）: ${e.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      // ignore
    }
  }
}
