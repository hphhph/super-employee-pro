import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigCenterService } from './config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('系统配置')
@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConfigCenterController {
  constructor(private configService: ConfigCenterService) {}

  @Get('platforms')
  @Roles('admin')
  @ApiOperation({ summary: '获取所有平台配置列表（脱敏）' })
  async getAllConfigs() {
    return this.configService.getAllConfigs();
  }

  @Get('categories')
  @ApiOperation({ summary: '获取平台分类' })
  async getCategories() {
    return this.configService.getCategories();
  }

  @Put('platforms/:platform')
  @Roles('admin')
  @ApiOperation({ summary: '保存平台 API Key 配置' })
  async saveConfig(
    @Param('platform') platform: string,
    @Body() data: { apiKey?: string; apiSecret?: string; baseUrl?: string; extraConfig?: any },
  ) {
    return this.configService.saveConfig(platform, data);
  }

  @Post('platforms/:platform/verify')
  @Roles('admin')
  @ApiOperation({ summary: '验证平台配置连通性' })
  async verifyConfig(@Param('platform') platform: string) {
    return this.configService.verifyConfig(platform);
  }
}
