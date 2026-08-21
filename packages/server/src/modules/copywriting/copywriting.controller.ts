import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CopywritingService } from './copywriting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('文案大师')
@Controller('copywriting')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CopywritingController {
  constructor(private copywritingService: CopywritingService) {}

  @Get('templates')
  @ApiOperation({ summary: '文案场景模板列表' })
  listTemplates() {
    return this.copywritingService.listTemplates();
  }

  @Post('generate')
  @ApiOperation({ summary: 'AI 生成爆款文案' })
  generate(@Body() body: Record<string, any>) {
    return this.copywritingService.generate(body);
  }

  @Get('records')
  @ApiOperation({ summary: '文案生成历史' })
  listRecords(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.copywritingService.listRecords(Number(page) || 1, Number(pageSize) || 20);
  }

  @Delete('records/:id')
  @ApiOperation({ summary: '删除文案记录' })
  deleteRecord(@Param('id') id: string) {
    return this.copywritingService.deleteRecord(Number(id));
  }
}
