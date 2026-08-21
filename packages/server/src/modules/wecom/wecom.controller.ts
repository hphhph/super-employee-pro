import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WecomService } from './wecom.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('企微SCRM')
@Controller('wecom')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WecomController {
  constructor(private wecomService: WecomService) {}

  // ===== 粉丝 =====
  @Get('fans')
  @ApiOperation({ summary: '客户/粉丝列表' })
  findFans(@Query() params: any) {
    return this.wecomService.findFans(params);
  }

  @Get('fans/:id')
  @ApiOperation({ summary: '客户详情' })
  getFanDetail(@Param('id') id: number) {
    return this.wecomService.getFanDetail(id);
  }

  @Put('fans/:id')
  @ApiOperation({ summary: '更新客户信息(备注/标签)' })
  updateFan(@Param('id') id: number, @Body() data: any) {
    return this.wecomService.updateFan(id, data);
  }

  // ===== 标签 =====
  @Get('labels')
  @ApiOperation({ summary: '标签列表' })
  findLabels() {
    return this.wecomService.findLabels();
  }

  @Post('labels')
  @ApiOperation({ summary: '创建标签' })
  createLabel(@Body() data: any) {
    return this.wecomService.createLabel(data);
  }

  @Put('labels/:id')
  @ApiOperation({ summary: '更新标签' })
  updateLabel(@Param('id') id: number, @Body() data: any) {
    return this.wecomService.updateLabel(id, data);
  }

  @Delete('labels/:id')
  @ApiOperation({ summary: '删除标签' })
  deleteLabel(@Param('id') id: number) {
    return this.wecomService.deleteLabel(id);
  }

  // ===== 关键词 =====
  @Get('keywords')
  @ApiOperation({ summary: '关键词回复列表' })
  findKeywords(@Query() params: any) {
    return this.wecomService.findKeywords(params);
  }

  @Post('keywords')
  @ApiOperation({ summary: '创建关键词回复' })
  createKeyword(@Body() data: any) {
    return this.wecomService.createKeyword(data);
  }

  @Put('keywords/:id')
  @ApiOperation({ summary: '更新关键词回复' })
  updateKeyword(@Param('id') id: number, @Body() data: any) {
    return this.wecomService.updateKeyword(id, data);
  }

  @Delete('keywords/:id')
  @ApiOperation({ summary: '删除关键词回复' })
  deleteKeyword(@Param('id') id: number) {
    return this.wecomService.deleteKeyword(id);
  }

  // ===== 会话 =====
  @Get('sessions')
  @ApiOperation({ summary: '会话列表' })
  findSessions(@Query() params: any) {
    return this.wecomService.findSessions(params);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: '会话消息' })
  getMessages(@Param('id') id: number, @Query() params: any) {
    return this.wecomService.getMessages(id, params);
  }

  // ===== 群发 =====
  @Get('bulk-tasks')
  @ApiOperation({ summary: '群发任务列表' })
  findBulkTasks(@Query() params: any) {
    return this.wecomService.findBulkTasks(params);
  }

  @Post('bulk-tasks')
  @ApiOperation({ summary: '创建群发任务' })
  createBulkTask(@Body() data: any) {
    return this.wecomService.createBulkTask(data);
  }

  @Put('bulk-tasks/:id/status')
  @ApiOperation({ summary: '更新群发任务状态' })
  updateBulkTaskStatus(@Param('id') id: number, @Body() data: { status: string }) {
    return this.wecomService.updateBulkTaskStatus(id, data.status);
  }

  @Delete('bulk-tasks/:id')
  @ApiOperation({ summary: '删除群发任务' })
  deleteBulkTask(@Param('id') id: number) {
    return this.wecomService.deleteBulkTask(id);
  }

  // ===== SOP =====
  @Get('sop-tasks')
  @ApiOperation({ summary: 'SOP任务列表' })
  findSopTasks(@Query() params: any) {
    return this.wecomService.findSopTasks(params);
  }

  @Post('sop-tasks')
  @ApiOperation({ summary: '创建SOP任务' })
  createSopTask(@Body() data: any) {
    return this.wecomService.createSopTask(data);
  }

  @Delete('sop-tasks/:id')
  @ApiOperation({ summary: '删除SOP任务' })
  deleteSopTask(@Param('id') id: number) {
    return this.wecomService.deleteSopTask(id);
  }

  // ===== 设备 =====
  @Get('devices')
  @ApiOperation({ summary: '设备列表' })
  findDevices() {
    return this.wecomService.findDevices();
  }

  // ===== 统计 =====
  @Get('stats')
  @ApiOperation({ summary: '企微统计' })
  getStats() {
    return this.wecomService.getStats();
  }
}
