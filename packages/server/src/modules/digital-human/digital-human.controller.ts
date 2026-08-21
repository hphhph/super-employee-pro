import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { readFileSync } from 'fs';
import { DigitalHumanService } from './digital-human.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('数字人口播')
@Controller('digital-human')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DigitalHumanController {
  constructor(private digitalHumanService: DigitalHumanService) {}

  // ===== 形象 =====
  @Post('avatars')
  @ApiOperation({ summary: '上传数字人形象（图片或短视频）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 300 * 1024 * 1024 } }))
  uploadAvatar(@UploadedFile() file: any, @Body('name') name?: string) {
    return this.digitalHumanService.saveAvatar(file, name);
  }

  @Get('avatars')
  @ApiOperation({ summary: '数字人形象列表' })
  listAvatars() {
    return this.digitalHumanService.listAvatars();
  }

  @Delete('avatars/:id')
  @ApiOperation({ summary: '删除数字人形象' })
  deleteAvatar(@Param('id') id: string) {
    return this.digitalHumanService.deleteAvatar(Number(id));
  }

  // ===== 任务 =====
  @Post('tasks')
  @ApiOperation({ summary: '创建数字人口播任务' })
  createTask(@Body() body: Record<string, any>) {
    return this.digitalHumanService.createTask(body);
  }

  @Get('tasks')
  @ApiOperation({ summary: '数字人口播任务列表' })
  listTasks() {
    return this.digitalHumanService.listTasks();
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: '任务详情' })
  getTask(@Param('id') id: string) {
    return this.digitalHumanService.getTask(Number(id));
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: '删除任务' })
  deleteTask(@Param('id') id: string) {
    return this.digitalHumanService.deleteTask(Number(id));
  }

  // ===== 文件（StreamableFile，经全局 TransformInterceptor 透传） =====
  @Get('tasks/:id/video')
  @ApiOperation({ summary: '获取口播成片（final.mp4）' })
  getTaskVideo(@Param('id') id: string): StreamableFile {
    const p = this.digitalHumanService.resolveTaskVideo(Number(id));
    return new StreamableFile(readFileSync(p), {
      type: 'video/mp4',
      disposition: 'inline; filename="final.mp4"',
    });
  }

  @Get('files/:type/:name')
  @ApiOperation({ summary: '获取形象文件（图片/视频）' })
  getFile(@Param('type') type: string, @Param('name') name: string): StreamableFile {
    const t = type === 'avatars' ? 'avatars' : 'tasks';
    const p = this.digitalHumanService.resolveFile(t, name);
    const isMp4 = name.toLowerCase().endsWith('.mp4');
    return new StreamableFile(readFileSync(p), {
      type: isMp4 ? 'video/mp4' : 'image/jpeg',
      disposition: 'inline',
    });
  }
}
