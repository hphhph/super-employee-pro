import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  Res,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI视频')
@Controller('video')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VideoController {
  constructor(private videoService: VideoService) {}

  @Post('scripts')
  @ApiOperation({ summary: 'AI 生成视频脚本' })
  generateScript(@Body() body: Record<string, any>) {
    return this.videoService.generateScript(body);
  }

  @Post('terms')
  @ApiOperation({ summary: '根据脚本生成素材搜索关键词' })
  generateTerms(@Body() body: Record<string, any>) {
    return this.videoService.generateTerms(body);
  }

  @Post('tasks')
  @ApiOperation({ summary: '创建视频生成任务' })
  createTask(@CurrentUser('id') userId: number, @Body() params: Record<string, any>) {
    return this.videoService.createTask(userId, params);
  }

  @Get('tasks')
  @ApiOperation({ summary: '获取视频任务列表' })
  getTasks(@Query('page') page = 1, @Query('pageSize') pageSize = 10) {
    return this.videoService.getTasks(Number(page) || 1, Number(pageSize) || 10);
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: '查询视频任务状态与结果' })
  getTask(@Param('taskId') taskId: string) {
    return this.videoService.getTask(taskId);
  }

  @Delete('tasks/:taskId')
  @ApiOperation({ summary: '删除视频任务' })
  deleteTask(@Param('taskId') taskId: string) {
    return this.videoService.deleteTask(taskId);
  }

  @Get('musics')
  @ApiOperation({ summary: '获取 BGM 背景音乐列表' })
  getMusics() {
    return this.videoService.getMusics();
  }

  @Get('download/:taskId/:file')
  @ApiOperation({ summary: '下载/播放生成的视频文件' })
  async download(
    @Param('taskId') taskId: string,
    @Param('file') file: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const upstream = await this.videoService.fetchFile(taskId, file, range);
    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const disposition = upstream.headers.get('content-disposition');
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');

    res.setHeader('Content-Type', contentType);
    if (disposition) res.setHeader('Content-Disposition', disposition);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
      res.status(206);
    }
    res.setHeader('Accept-Ranges', 'bytes');

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return new StreamableFile(buffer);
  }
}
