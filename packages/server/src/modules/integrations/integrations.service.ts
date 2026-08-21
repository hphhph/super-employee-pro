import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';

export interface IntegrationInfo {
  key: string;
  name: string;
  desc: string;
  url: string;
  port: number;
  category: '采集' | '解析' | '混剪' | 'API';
}

/**
 * 已整合的第三方开源服务清单
 * 地址即 iframe 嵌入地址（服务需通过 third-party/start-third-party.sh 启动）
 */
export const INTEGRATIONS: IntegrationInfo[] = [
  {
    key: 'media-crawler',
    name: '智能获客',
    desc: '小红书/抖音/B站等 7 平台数据采集',
    url: 'http://localhost:5174',
    port: 5174,
    category: '采集',
  },
  {
    key: 'media-crawler-api',
    name: '采集后端 API',
    desc: 'MediaCrawler FastAPI 服务（供 WebUI 代理，不单独展示）',
    url: 'http://127.0.0.1:8082',
    port: 8082,
    category: 'API',
  },
  {
    key: 'video-extractor',
    name: '一键追爆',
    desc: '视频链接 → 下载 → 文案/字幕提取',
    url: 'http://127.0.0.1:7860',
    port: 7860,
    category: '解析',
  },
  {
    key: 'money-printer-plus',
    name: '智能混剪',
    desc: '文案 → 配音 → 混剪出片 → 多平台发布',
    url: 'http://127.0.0.1:8501',
    port: 8501,
    category: '混剪',
  },
];

@Injectable()
export class IntegrationsService {
  private logger = new Logger(IntegrationsService.name);

  /** 服务清单（不含端口等内部信息；隐藏仅供内部使用的 API 入口） */
  list() {
    return INTEGRATIONS.filter((it) => it.key !== 'media-crawler-api').map(
      ({ key, name, desc, url, category }) => ({
        key,
        name,
        desc,
        url,
        category,
      }),
    );
  }

  /** 各服务运行状态（TCP 端口探测，兼容 IPv4/IPv6 监听） */
  async status() {
    const results = await Promise.all(
      INTEGRATIONS.map(async (it) => ({
        key: it.key,
        name: it.name,
        url: it.url,
        online: await this.checkPort(it.port),
      })),
    );
    return results;
  }

  /** 同时探测 127.0.0.1 与 ::1（vite 等开发服务器默认只监听 IPv6 ::1） */
  private checkPort(port: number, timeout = 1200): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      let pending = 2;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const tryHost = (host: string) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.once('connect', () => {
          socket.destroy();
          finish(true);
        });
        socket.once('timeout', () => {
          socket.destroy();
          if (--pending <= 0) finish(false);
        });
        socket.once('error', () => {
          socket.destroy();
          if (--pending <= 0) finish(false);
        });
        socket.connect(port, host);
      };
      tryHost('127.0.0.1');
      tryHost('::1');
    });
  }
}
