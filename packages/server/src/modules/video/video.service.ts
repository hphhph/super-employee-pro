import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AI 短视频生成服务（代理 MoneyPrinterTurbo FastAPI）
 * 文档: http://localhost:8080/docs
 */
@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly baseUrl = (process.env.VIDEO_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

  constructor(private prisma: PrismaService) {}

  /** 生成视频脚本 */
  async generateScript(body: Record<string, any>) {
    return this.proxy('/api/v1/scripts', {
      method: 'POST',
      body: JSON.stringify({
        video_subject: body.videoSubject,
        video_language: body.videoLanguage || '',
        paragraph_number: body.paragraphNumber || 1,
        video_script_prompt: body.videoScriptPrompt || '',
        custom_system_prompt: body.customSystemPrompt || '',
      }),
    });
  }

  /** 根据脚本生成素材搜索关键词 */
  async generateTerms(body: Record<string, any>) {
    return this.proxy('/api/v1/terms', {
      method: 'POST',
      body: JSON.stringify({
        video_subject: body.videoSubject,
        video_script: body.videoScript || '',
        amount: body.amount || 5,
        match_materials_to_script: !!body.matchMaterialsToScript,
      }),
    });
  }

  /** 创建视频生成任务（透传 MoneyPrinterTurbo 的 snake_case 参数） */
  async createTask(userId: number, params: Record<string, any>) {
    const task = await this.proxy('/api/v1/videos', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    // 记录算力消耗
    await this.prisma.computeLog.create({
      data: {
        userId,
        type: 'video',
        cost: parseInt(process.env.COMPUTE_COST_VIDEO || '10', 10),
        detail: `视频任务 ${task?.task_id || ''}「${params.video_subject || ''}」`,
      },
    }).catch((e) => this.logger.warn(`记录算力消耗失败: ${e.message}`));

    return task;
  }

  /** 任务列表 */
  async getTasks(page = 1, pageSize = 10) {
    const result = await this.proxy(`/api/v1/tasks?page=${page}&page_size=${pageSize}`);
    if (result?.tasks) {
      result.tasks = result.tasks.map((t) => this.rewriteTaskUrls(t));
    }
    return result ?? { tasks: [], total: 0, page, page_size: pageSize };
  }

  /** 任务详情（含生成结果） */
  async getTask(taskId: string) {
    return this.rewriteTaskUrls(await this.proxy(`/api/v1/tasks/${encodeURIComponent(taskId)}`));
  }

  /** 删除任务 */
  async deleteTask(taskId: string) {
    return this.proxy(`/api/v1/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
  }

  /** 获取本地 BGM 列表 */
  async getMusics() {
    return this.proxy('/api/v1/musics');
  }

  /** 拉取视频文件（下载 / 播放） */
  async fetchFile(taskId: string, file: string, range?: string): Promise<Response> {
    const path = `${encodeURIComponent(taskId)}/${encodeURIComponent(file)}`;
    const res = await fetch(`${this.baseUrl}/api/v1/download/${path}`, {
      headers: range ? { Range: range } : {},
    }).catch((e) => {
      this.logger.error('MoneyPrinterTurbo API unreachable', e);
      throw new BadGatewayException('视频生成服务不可用，请确认 video-api 已启动');
    });
    if (!res.ok && res.status !== 206) {
      throw new BadGatewayException(`视频文件获取失败 (${res.status})`);
    }
    return res;
  }

  /**
   * 把任务返回的相对产物路径（如 /tasks/{task_id}/final-1.mp4）
   * 改写为本服务的代理地址 /video/download/{task_id}/{file}，
   * 由前端带上 JWT 通过 axios 拉取。
   */
  private rewriteTaskUrls(task: any) {
    if (!task || typeof task !== 'object') return task;
    for (const key of ['videos', 'combined_videos']) {
      if (Array.isArray(task[key])) {
        task[key] = task[key].map((v: any) => {
          if (typeof v !== 'string') return v;
          const m = v.match(/^(?:https?:\/\/[^/]+)?\/?tasks\/(.+)$/);
          if (!m) return v;
          const [taskId, ...rest] = m[1].split('/');
          return `/video/download/${encodeURIComponent(taskId)}/${rest.map(encodeURIComponent).join('/')}`;
        });
      }
    }
    return task;
  }

  /** 统一代理请求 MoneyPrinterTurbo API */
  private async proxy(path: string, init: RequestInit = {}, timeoutMs = 120000): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string>),
        },
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        this.logger.error(`MoneyPrinterTurbo 请求超时: ${path}`);
        throw new BadGatewayException('视频生成服务响应超时，请稍后重试');
      }
      this.logger.error('MoneyPrinterTurbo API unreachable', e as any);
      throw new BadGatewayException('视频生成服务不可用，请确认 video-api 已启动（docker-compose up -d video-api）');
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!res.ok) {
      const message = json?.message || `视频服务错误 (${res.status})`;
      this.logger.error(`${path} -> ${res.status} ${message}`);
      throw new BadGatewayException(message);
    }
    return json?.data ?? json;
  }
}
