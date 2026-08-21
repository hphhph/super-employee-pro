import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PublishService, PUBLISH_PLATFORMS } from './publish.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('多平台发布')
@Controller('publish')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PublishController {
  constructor(private publishService: PublishService) {}

  @Get('platforms')
  @ApiOperation({ summary: '支持发布的平台列表' })
  listPlatforms() {
    return PUBLISH_PLATFORMS;
  }

  // ===== 渠道账号 =====
  @Get('accounts')
  @ApiOperation({ summary: '渠道账号列表' })
  listAccounts() {
    return this.publishService.listAccounts();
  }

  @Post('accounts')
  @ApiOperation({ summary: '新增渠道账号' })
  createAccount(@Body() body: Record<string, any>) {
    return this.publishService.createAccount(body);
  }

  @Put('accounts/:id')
  @ApiOperation({ summary: '更新渠道账号' })
  updateAccount(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.publishService.updateAccount(Number(id), body);
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: '删除渠道账号' })
  deleteAccount(@Param('id') id: string) {
    return this.publishService.deleteAccount(Number(id));
  }

  // ===== 发布任务 =====
  @Get('tasks')
  @ApiOperation({ summary: '发布任务列表' })
  listTasks(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: string,
  ) {
    return this.publishService.listTasks({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      status,
    });
  }

  @Post('tasks')
  @ApiOperation({ summary: '创建发布任务（立即/定时/批量）' })
  createTask(@Body() body: Record<string, any>) {
    return this.publishService.createTask(body);
  }

  @Post('tasks/:id/cancel')
  @ApiOperation({ summary: '取消定时发布任务' })
  cancelTask(@Param('id') id: string) {
    return this.publishService.cancelTask(Number(id));
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: '删除发布任务' })
  deleteTask(@Param('id') id: string) {
    return this.publishService.deleteTask(Number(id));
  }

  // ===== 看板 =====
  @Get('stats')
  @ApiOperation({ summary: '发布数据看板' })
  stats() {
    return this.publishService.stats();
  }
}
