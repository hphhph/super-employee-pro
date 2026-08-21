import { Controller, Get, Post, Delete, Param, Body, UseGuards, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiChatService } from './ai-chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI对话')
@Controller('ai-chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiChatController {
  constructor(private aiChatService: AiChatService) {}

  @Post('sessions')
  @ApiOperation({ summary: '创建对话会话' })
  createSession(@CurrentUser('id') userId: number, @Body() data: { title?: string; model?: string; agentId?: number }) {
    return this.aiChatService.createSession(userId, data);
  }

  @Get('sessions')
  @ApiOperation({ summary: '获取会话列表' })
  getSessions(@CurrentUser('id') userId: number) {
    return this.aiChatService.getSessions(userId);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: '获取会话消息' })
  getMessages(@Param('id') id: number, @CurrentUser('id') userId: number) {
    return this.aiChatService.getMessages(id, userId);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: '发送消息' })
  sendMessage(
    @Param('id') id: number,
    @CurrentUser('id') userId: number,
    @Body() data: { content: string },
  ) {
    return this.aiChatService.sendMessage(userId, id, data.content);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: '删除会话' })
  deleteSession(@Param('id') id: number, @CurrentUser('id') userId: number) {
    return this.aiChatService.deleteSession(id, userId);
  }
}
