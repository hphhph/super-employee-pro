import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DeepSeek LLM 客户端
 * Key 优先取环境变量 DEEPSEEK_API_KEY，否则回退读取 video-generator 的 config.toml
 */
@Injectable()
export class DeepSeekClient {
  private readonly logger = new Logger(DeepSeekClient.name);
  private apiKey = '';
  /** video-generator 项目根目录（默认相对当前服务目录解析，可用环境变量覆盖） */
  private readonly vgRoot =
    process.env.VIDEO_GENERATOR_DIR ||
    join(process.cwd(), '..', '..', 'services', 'video-generator');

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || this.readKeyFromConfig();
    if (!this.apiKey) {
      this.logger.warn('未找到 DeepSeek API Key（环境变量 DEEPSEEK_API_KEY 或 video-generator/config.toml）');
    }
  }

  private readKeyFromConfig(): string {
    try {
      const configPath = join(this.vgRoot, 'config.toml');
      if (existsSync(configPath)) {
        const text = readFileSync(configPath, 'utf8');
        const m = text.match(/deepseek_api_key\s*=\s*"([^"]+)"/);
        if (m?.[1]) return m[1];
      }
    } catch (e) {
      this.logger.warn(`读取 config.toml 失败: ${(e as Error).message}`);
    }
    return '';
  }

  /** 调 DeepSeek chat 补全 */
  async chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], opts?: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<string> {
    if (!this.apiKey) throw new Error('未配置 DeepSeek API Key');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 60000);

    let res: Response;
    try {
      res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
          messages,
          temperature: opts?.temperature ?? 0.9,
          max_tokens: opts?.maxTokens ?? 1600,
          stream: false,
        }),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error(`DeepSeek 请求超时（${(opts?.timeoutMs ?? 60000) / 1000}s）`);
      throw new Error(`DeepSeek 请求失败: ${e?.message || e}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`DeepSeek API ${res.status}: ${text.slice(0, 300)}`);
      throw new Error(`DeepSeek 调用失败 (${res.status})`);
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('DeepSeek 返回内容为空');
    return String(content).trim();
  }
}
