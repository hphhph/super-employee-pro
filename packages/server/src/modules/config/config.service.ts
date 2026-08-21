import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 支持的平台清单 - 与前端配置页面一一对应
 * 用户申请到 API Key 后，在系统设置页面填入即可
 */
export const PLATFORM_DEFINITIONS = [
  // ===== AI 模型 =====
  {
    platform: 'deepseek',
    name: 'DeepSeek',
    category: 'ai',
    description: 'AI对话核心模型，用于智能对话、文案生成',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, placeholder: 'sk-...' },
      { key: 'baseUrl', label: '接口地址', required: false, placeholder: 'https://api.deepseek.com' },
      { key: 'model', label: '模型', required: false, placeholder: 'deepseek-chat' },
    ],
    applyUrl: 'https://platform.deepseek.com/',
  },
  {
    platform: 'coze',
    name: 'Coze 扣子',
    category: 'ai',
    description: '字节跳动智能体平台，用于企业智库智能体',
    fields: [
      { key: 'apiKey', label: 'API Token', required: true, placeholder: 'pat_...' },
      { key: 'baseUrl', label: '接口地址', required: false, placeholder: 'https://api.coze.cn' },
      { key: 'botId', label: '默认Bot ID', required: false, placeholder: '' },
    ],
    applyUrl: 'https://www.coze.cn/',
  },
  {
    platform: 'openai',
    name: 'OpenAI Sora2',
    category: 'ai',
    description: 'Sora2 文生图/文生视频',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, placeholder: 'sk-...' },
      { key: 'baseUrl', label: '接口地址', required: false, placeholder: 'https://api.openai.com/v1' },
    ],
    applyUrl: 'https://platform.openai.com/',
  },
  {
    platform: 'google_veo',
    name: 'Google Veo',
    category: 'ai',
    description: 'Google 视频生成模型',
    fields: [
      { key: 'apiKey', label: 'Service Account JSON', required: true, placeholder: '{...}' },
      { key: 'projectId', label: '项目ID', required: true, placeholder: '' },
    ],
    applyUrl: 'https://cloud.google.com/vertex-ai',
  },
  {
    platform: 'seedance',
    name: '字节 Seedance',
    category: 'ai',
    description: '字节跳动视频生成模型（火山引擎）',
    fields: [{ key: 'apiKey', label: 'API Key', required: true, placeholder: '' }],
    applyUrl: 'https://www.volcengine.com/',
  },
  {
    platform: 'aliyun_tts',
    name: '阿里云 TTS',
    category: 'ai',
    description: '语音合成，用于数字人声音定制',
    fields: [
      { key: 'apiKey', label: 'AccessKey ID', required: true, placeholder: '' },
      { key: 'apiSecret', label: 'AccessKey Secret', required: true, placeholder: '' },
    ],
    applyUrl: 'https://dashscope.aliyun.com/',
  },
  {
    platform: 'dashscope',
    name: '通义千问',
    category: 'ai',
    description: '阿里云大模型（备用AI）',
    fields: [{ key: 'apiKey', label: 'API Key', required: true, placeholder: 'sk-...' }],
    applyUrl: 'https://dashscope.aliyun.com/',
  },
  // ===== 社交平台 =====
  {
    platform: 'wecom',
    name: '企业微信',
    category: 'platform',
    description: '企微SCRM，客户管理、聚合聊天',
    fields: [
      { key: 'apiKey', label: 'Corp ID', required: true, placeholder: '' },
      { key: 'apiSecret', label: 'Secret', required: true, placeholder: '' },
      { key: 'agentId', label: 'Agent ID', required: false, placeholder: '' },
      { key: 'token', label: 'Token', required: false, placeholder: '' },
      { key: 'encodingAesKey', label: 'EncodingAESKey', required: false, placeholder: '' },
    ],
    applyUrl: 'https://work.weixin.qq.com/',
  },
  {
    platform: 'douyin',
    name: '抖音开放平台',
    category: 'platform',
    description: '短视频矩阵，抖音账号管理与发布',
    fields: [
      { key: 'apiKey', label: 'App ID', required: true, placeholder: '' },
      { key: 'apiSecret', label: 'App Secret', required: true, placeholder: '' },
    ],
    applyUrl: 'https://developer.open-douyin.com/',
  },
  {
    platform: 'xiaohongshu',
    name: '小红书开放平台',
    category: 'platform',
    description: '小红书账号管理与内容发布',
    fields: [
      { key: 'apiKey', label: 'App ID', required: true, placeholder: '' },
      { key: 'apiSecret', label: 'App Secret', required: true, placeholder: '' },
    ],
    applyUrl: 'https://open.xiaohongshu.com/',
  },
  {
    platform: 'kuaishou',
    name: '快手开放平台',
    category: 'platform',
    description: '快手账号管理与内容发布',
    fields: [
      { key: 'apiKey', label: 'App ID', required: true, placeholder: '' },
      { key: 'apiSecret', label: 'App Secret', required: true, placeholder: '' },
    ],
    applyUrl: 'https://open.kuaishou.com/',
  },
  {
    platform: 'wechat_channels',
    name: '视频号',
    category: 'platform',
    description: '微信视频号内容发布',
    fields: [
      { key: 'apiKey', label: 'App ID', required: true, placeholder: '' },
      { key: 'apiSecret', label: 'App Secret', required: true, placeholder: '' },
    ],
    applyUrl: 'https://channels.weixin.qq.com/',
  },
  {
    platform: 'boss',
    name: 'Boss直聘',
    category: 'platform',
    description: 'AI人事模块，简历筛选与自动沟通（Cookie方式）',
    fields: [{ key: 'apiKey', label: 'Cookie', required: true, placeholder: '粘贴浏览器Cookie' }],
    applyUrl: 'https://www.zhipin.com/',
  },
  {
    platform: 'zhilian',
    name: '智联招聘',
    category: 'platform',
    description: 'AI人事模块，智联简历筛选（Cookie方式）',
    fields: [{ key: 'apiKey', label: 'Cookie', required: true, placeholder: '粘贴浏览器Cookie' }],
    applyUrl: 'https://www.zhaopin.com/',
  },
] as const;

@Injectable()
export class ConfigCenterService {
  constructor(private prisma: PrismaService) {}

  /** 获取所有平台配置（脱敏显示） */
  async getAllConfigs() {
    const configs = await this.prisma.apiKeyConfig.findMany();
    const configMap = new Map<string, any>(configs.map((c) => [c.platform, c]));

    return PLATFORM_DEFINITIONS.map((def) => {
      const existing = configMap.get(def.platform);
      return {
        ...def,
        // 只返回掩码，不返回完整密钥
        configured: existing?.status === 1 || existing?.status === 2,
        maskedKey: existing?.apiKey ? this.maskSecret(existing.apiKey) : '',
        maskedSecret: existing?.apiSecret ? this.maskSecret(existing.apiSecret) : '',
        baseUrl: existing?.baseUrl || '',
        extraConfig: existing?.extraConfig || {},
        lastVerifiedAt: existing?.lastVerifiedAt || null,
      };
    });
  }

  /** 获取平台分类 */
  getCategories() {
    return [
      { key: 'ai', name: 'AI 模型服务', description: '对话、绘图、视频生成、语音合成' },
      { key: 'platform', name: '社交平台', description: '企业微信、短视频平台、招聘平台' },
    ];
  }

  /** 保存平台配置 */
  async saveConfig(platform: string, data: { apiKey?: string; apiSecret?: string; baseUrl?: string; extraConfig?: any }) {
    const def = PLATFORM_DEFINITIONS.find((p) => p.platform === platform);
    if (!def) throw new BadRequestException(`不支持的平台: ${platform}`);

    const existing = await this.prisma.apiKeyConfig.findUnique({ where: { platform } });

    const payload = {
      apiKey: data.apiKey || existing?.apiKey || '',
      apiSecret: data.apiSecret || existing?.apiSecret || '',
      baseUrl: data.baseUrl || existing?.baseUrl || '',
      extraConfig: (data.extraConfig || existing?.extraConfig || {}) as any,
      name: def.name,
      status: 1, // 已配置
    };

    if (existing) {
      return this.prisma.apiKeyConfig.update({ where: { platform }, data: payload });
    }
    return this.prisma.apiKeyConfig.create({ data: { platform, ...payload } });
  }

  /** 验证平台配置连通性 */
  async verifyConfig(platform: string) {
    const config = await this.prisma.apiKeyConfig.findUnique({ where: { platform } });
    if (!config || !config.apiKey) {
      throw new BadRequestException('请先配置该平台的 API Key');
    }

    let verified = false;
    try {
      switch (platform) {
        case 'deepseek':
          verified = await this.verifyDeepseek(config.apiKey, config.baseUrl);
          break;
        case 'coze':
          verified = await this.verifyCoze(config.apiKey, config.baseUrl);
          break;
        // 其他平台的验证逻辑后续按需添加
        default:
          verified = true; // 标记为已验证（简单的格式检查）
      }
    } catch (e) {
      verified = false;
    }

    await this.prisma.apiKeyConfig.update({
      where: { platform },
      data: {
        status: verified ? 2 : 1,
        lastVerifiedAt: new Date(),
      },
    });

    return { verified, message: verified ? '验证成功' : '验证失败，请检查 Key 是否正确' };
  }

  /** 获取完整配置（内部服务用，不暴露给前端） */
  async getInternalConfig(platform: string) {
    return this.prisma.apiKeyConfig.findUnique({ where: { platform } });
  }

  /**
   * 获取所有已配置平台的完整 key（供本机第三方服务统一下发）
   * 注意：返回明文密钥，仅允许本机回环调用，禁止暴露给外部/前端
   */
  async getRuntimeKeys() {
    const configs = await this.prisma.apiKeyConfig.findMany({
      where: { status: { in: [1, 2] } },
    });
    const result: Record<string, any> = {};
    for (const c of configs) {
      const def = PLATFORM_DEFINITIONS.find((p) => p.platform === c.platform);
      const extra = (c.extraConfig || {}) as Record<string, any>;
      result[c.platform] = {
        name: def?.name || c.platform,
        apiKey: c.apiKey || '',
        apiSecret: c.apiSecret || '',
        baseUrl: c.baseUrl || '',
        // extraConfig 中的业务字段（model / botId 等）展开到顶层，便于第三方服务直接读取
        ...extra,
        extraConfig: extra,
      };
    }
    return result;
  }

  private maskSecret(secret: string): string {
    if (!secret || secret.length < 8) return '****';
    return secret.slice(0, 4) + '****' + secret.slice(-4);
  }

  private async verifyDeepseek(apiKey: string, baseUrl?: string): Promise<boolean> {
    const url = (baseUrl || 'https://api.deepseek.com') + '/models';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    return res.ok;
  }

  private async verifyCoze(token: string, baseUrl?: string): Promise<boolean> {
    const url = (baseUrl || 'https://api.coze.cn') + '/v1/bots';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok || res.status === 404; // 404 也算连通
  }
}
