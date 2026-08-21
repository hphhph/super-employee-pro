import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigCenterService } from '../config/config.service';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private prisma: PrismaService,
    private configCenter: ConfigCenterService,
  ) {}

  /** 创建会话 */
  async createSession(userId: number, data: { title?: string; model?: string; agentId?: number }) {
    return this.prisma.chatSession.create({
      data: {
        userId,
        title: data.title || '新对话',
        model: data.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        agentId: data.agentId,
      },
    });
  }

  /** 获取用户会话列表 */
  async getSessions(userId: number) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      include: { _count: { select: { messages: true } } },
    });
  }

  /** 获取会话消息 */
  async getMessages(sessionId: number, userId: number) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('会话不存在');

    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** 发送消息（非流式，返回完整回复） */
  async sendMessage(userId: number, sessionId: number, content: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: { agent: true },
    });
    if (!session) throw new NotFoundException('会话不存在');

    // 保存用户消息
    await this.prisma.chatMessage.create({
      data: { sessionId, role: 'user', content },
    });

    // 获取历史消息（最近20条）
    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    // 构建 system prompt
    let systemPrompt = '你是AI超级员工，一个专业的企业AI助手。';
    if (session.agent?.systemPrompt) {
      systemPrompt = session.agent.systemPrompt;
    }

    // 调用 DeepSeek
    const reply = await this.callDeepseek(
      session.agent?.model || session.model,
      systemPrompt,
      history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    );

    // 保存AI回复
    const aiMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: reply.content,
        tokens: reply.usage?.total_tokens || 0,
        model: session.agent?.model || session.model,
      },
    });

    // 更新会话标题（首条消息时）
    if (history.length === 1) {
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { title: content.slice(0, 50) },
      });
    }

    // 记录算力消耗
    await this.prisma.computeLog.create({
      data: {
        userId,
        type: 'chat',
        cost: parseInt(process.env.COMPUTE_COST_CHAT || '1'),
        detail: `会话#${sessionId} 消耗${reply.usage?.total_tokens || 0} tokens`,
      },
    });

    return aiMessage;
  }

  /** 调用 DeepSeek API（OpenAI 兼容格式） */
  private async callDeepseek(model: string, systemPrompt: string, messages: any[]): Promise<{ content: string; usage?: any }> {
    // 优先从数据库读取配置，其次从环境变量
    const dbConfig = await this.configCenter.getInternalConfig('deepseek');
    const apiKey = dbConfig?.apiKey || process.env.DEEPSEEK_API_KEY;
    const baseUrl = dbConfig?.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    if (!apiKey) {
      throw new BadRequestException('DeepSeek API Key 未配置，请在系统设置中填入');
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`DeepSeek API error: ${response.status} ${error}`);
        throw new BadRequestException(`AI 调用失败: ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage,
      };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error('DeepSeek API call failed', e);
      throw new BadRequestException('AI 服务暂时不可用，请稍后重试');
    }
  }

  /** 删除会话 */
  async deleteSession(sessionId: number, userId: number) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('会话不存在');

    await this.prisma.chatSession.delete({ where: { id: sessionId } });
    return { success: true };
  }
}
