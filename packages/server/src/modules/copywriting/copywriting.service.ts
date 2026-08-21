import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeepSeekClient } from '../../common/deepseek/deepseek.client';

/** 场景模板：参考抖音/小红书爆款文案结构 */
export const COPYWRITING_TEMPLATES = [
  {
    scenario: '带货',
    icon: 'ShoppingCart',
    desc: '痛点开场 → 产品卖点 → 限时促单',
    prompt: '你是资深带货文案专家。请围绕主题写一段 60-100 字的带货文案，包含：①抓住痛点的钩子开场 ②2-3 个具体卖点（说人话、可感知）③紧迫感促单结尾。要求口语化、有节奏感，适合口播。',
  },
  {
    scenario: '口播',
    icon: 'Microphone',
    desc: '观点先行 → 3 个论据 → 金句收尾',
    prompt: '你是短视频口播文案专家。请围绕主题写一段 80-120 字的口播文案，结构为：①开头抛出反常识观点或悬念 ②用 3 个短句讲清论据 ③金句收尾引发共鸣。口语化、停顿感强、适合 15-30 秒口播。',
  },
  {
    scenario: '探店',
    icon: 'Location',
    desc: '本地场景 → 体验细节 → 到店引导',
    prompt: '你是本地生活探店达人。请围绕主题写一段 70-110 字的探店文案：①地点+场景钩子开场 ②2-3 个真实体验细节（环境/口味/服务）③引导到店动作（导航/团购/评论）。语气热情真实，适合同城流量。',
  },
  {
    scenario: '知识科普',
    icon: 'Reading',
    desc: '问题引入 → 通俗讲解 → 结论升华',
    prompt: '你是知识科普博主。请围绕主题写一段 90-130 字的科普文案：①用一个大众关心的问题开场 ②用生活化比喻讲清原理 ③给出实用结论。避免专业术语，让小白也能听懂。',
  },
  {
    scenario: '剧情',
    icon: 'Film',
    desc: '冲突开场 → 反转推进 → 悬念结尾',
    prompt: '你是短视频剧情编剧。请围绕主题写一段 80-120 字的剧情脚本：①一个高冲突的开场场景 ②中间推进埋反转 ③结尾留钩子或反转。要有画面感，适合分镜拍摄。',
  },
  {
    scenario: '朋友圈种草',
    icon: 'ChatDotRound',
    desc: '亲历分享 → 细节种草 → 行动暗示',
    prompt: '你是朋友圈种草达人。请围绕主题写一段 60-90 字的朋友圈文案：①以第一人称亲历口吻开场 ②2-3 个细节种草点 ③轻量行动暗示（私聊/评论/链接）。自然不硬广，带 2 个合适的话题标签。',
  },
];

@Injectable()
export class CopywritingService {
  private readonly logger = new Logger(CopywritingService.name);

  constructor(
    private prisma: PrismaService,
    private deepseek: DeepSeekClient,
  ) {}

  listTemplates() {
    return COPYWRITING_TEMPLATES;
  }

  /** 生成文案：调 DeepSeek 并保存历史 */
  async generate(body: Record<string, any>) {
    const scenario = body.scenario || '口播';
    const tpl = COPYWRITING_TEMPLATES.find((t) => t.scenario === scenario) || COPYWRITING_TEMPLATES[1];
    const styleText = body.style ? `\n风格要求：${body.style}。` : '';
    const sellText = (body.sellPoints || body.points) ? `\n核心卖点/素材：${body.sellPoints || body.points}。` : '';
    const durNum = parseInt(String(body.duration || ''), 10);
    const durText = !isNaN(durNum) && durNum > 0 ? `\n目标时长：${durNum} 秒（约 ${durNum * 4} 字）。` : '';

    const userPrompt = `主题：${body.subject}。${sellText}${durText}${styleText}
要求：直接输出文案正文，不要输出标题、不要解释、不要多余符号。`;

    const content = await this.deepseek.chat(
      [
        { role: 'system', content: tpl.prompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.9, maxTokens: 1200 },
    );

    const record = await this.prisma.copywritingRecord.create({
      data: {
        scenario,
        subject: body.subject.slice(0, 500),
        title: body.title ? body.title.slice(0, 500) : null,
        content,
      },
    }).catch((e) => {
      this.logger.warn(`保存文案记录失败: ${e.message}`);
      return null;
    });

    return { content, record };
  }

  async listRecords(page = 1, pageSize = 20) {
    const total = await this.prisma.copywritingRecord.count();
    const list = await this.prisma.copywritingRecord.findMany({
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { list, total, page, pageSize };
  }

  async deleteRecord(id: number) {
    await this.prisma.copywritingRecord.delete({ where: { id } });
    return { ok: true };
  }
}
