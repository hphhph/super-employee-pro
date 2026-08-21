import { Controller, Get, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { ConfigCenterService } from './config.service';

/**
 * 内部密钥下发接口（仅本机回环可访问，无需登录）
 *
 * 用途：video-api(MoneyPrinterTurbo)、MoneyPrinterPlus 等本机第三方服务
 * 统一从这里读取页面配置的 API Key，实现「key 只维护在系统设置页面」。
 *
 * 安全约束：
 *  - 仅接受 127.0.0.1 / ::1 回环来源，外部请求一律 403；
 *  - 返回明文密钥，禁止在管理端页面或对外文档中引用此接口。
 */
@ApiTags('内部服务')
@Controller('internal')
export class RuntimeKeysController {
  constructor(private configService: ConfigCenterService) {}

  @Get('runtime-keys')
  @ApiOperation({ summary: '获取已配置平台的完整 key（内部接口，仅本机调用）' })
  async getRuntimeKeys(@Req() req: Request) {
    const ip = String(req.socket?.remoteAddress || req.ip || '')
      .replace(/^::ffff:/, '')
      .replace(/^\[?([^\]]+)\]?$/, '$1');
    if (!['127.0.0.1', '::1', 'localhost'].includes(ip)) {
      throw new ForbiddenException('仅允许本机回环访问');
    }
    return this.configService.getRuntimeKeys();
  }
}
