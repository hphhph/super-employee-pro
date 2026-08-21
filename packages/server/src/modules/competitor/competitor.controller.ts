import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompetitorService, COMPETITOR_PLATFORMS } from './competitor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('同行监控')
@Controller('competitor')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompetitorController {
  constructor(private competitorService: CompetitorService) {}

  @Get('platforms')
  @ApiOperation({ summary: '支持监控的平台列表' })
  listPlatforms() {
    return COMPETITOR_PLATFORMS;
  }

  // ===== 账号 =====
  @Get('accounts')
  @ApiOperation({ summary: '同行账号列表' })
  listAccounts() {
    return this.competitorService.listAccounts();
  }

  @Post('accounts')
  @ApiOperation({ summary: '新增同行账号' })
  createAccount(@Body() body: Record<string, any>) {
    return this.competitorService.createAccount(body);
  }

  @Put('accounts/:id')
  @ApiOperation({ summary: '更新同行账号' })
  updateAccount(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.competitorService.updateAccount(Number(id), body);
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: '删除同行账号' })
  deleteAccount(@Param('id') id: string) {
    return this.competitorService.deleteAccount(Number(id));
  }

  // ===== 作品 =====
  @Get('works')
  @ApiOperation({ summary: '同行作品列表' })
  listWorks(@Query('accountId') accountId?: string, @Query('page') page = 1, @Query('pageSize') pageSize = 50) {
    return this.competitorService.listWorks({
      accountId: accountId ? Number(accountId) : undefined,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
    });
  }

  @Post('works')
  @ApiOperation({ summary: '录入同行作品' })
  createWork(@Body() body: Record<string, any>) {
    return this.competitorService.createWork(body);
  }

  @Put('works/:id')
  @ApiOperation({ summary: '更新同行作品' })
  updateWork(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.competitorService.updateWork(Number(id), body);
  }

  @Delete('works/:id')
  @ApiOperation({ summary: '删除同行作品' })
  deleteWork(@Param('id') id: string) {
    return this.competitorService.deleteWork(Number(id));
  }

  // ===== 看板 =====
  @Get('stats')
  @ApiOperation({ summary: '同行监控数据看板' })
  stats() {
    return this.competitorService.stats();
  }
}
