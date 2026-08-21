import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';

const execFileAsync = promisify(execFile);

export interface DigitalHumanAvatar {
  id: number;
  name: string;
  type: 'image' | 'video';
  fileUrl: string;
  remark?: string | null;
  createdAt: Date;
}

/**
 * 数字人口播：本地合成
 * 链路：edge-tts 配音 → ffmpeg（形象图 KenBurns / 形象视频循环 + 配音 + 字幕烧录）→ 成片
 * 不依赖第三方数字人 API，形象素材由用户上传（真人形象图 / 口播视频）。
 */
@Injectable()
export class DigitalHumanService implements OnModuleInit {
  private readonly logger = new Logger(DigitalHumanService.name);
  private readonly storageRoot = join(process.cwd(), 'storage', 'digital-human');
  private readonly avatarDir = join(this.storageRoot, 'avatars');
  private readonly taskDir = join(this.storageRoot, 'tasks');

  private venvPython = '';
  private ffmpeg = '';
  private fontPath = '';
  private songsDir = '';

  private processing = new Set<number>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    mkdirSync(this.avatarDir, { recursive: true });
    mkdirSync(this.taskDir, { recursive: true });

    const vgDir = process.env.VIDEO_GENERATOR_DIR || join(process.cwd(), '..', '..', 'services', 'video-generator');
    this.venvPython = join(vgDir, '.venv', 'bin', 'python');
    this.fontPath = join(vgDir, 'resource', 'fonts', 'STHeitiMedium.ttc');
    this.songsDir = join(vgDir, 'resource', 'songs');

    try {
      const { stdout } = await execFileAsync(this.venvPython, [
        '-c',
        'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())',
      ]);
      this.ffmpeg = stdout.trim();
      this.logger.log(`数字人合成引擎就绪: ${this.ffmpeg}`);
    } catch (e) {
      this.logger.error(`找不到 ffmpeg（video-generator venv 不可用）: ${(e as Error).message}`);
    }

    // 启动时把遗留的 processing 任务标记为失败（进程重启导致中断）
    await this.prisma.digitalHumanTask
      .updateMany({ where: { status: 'processing' }, data: { status: 'failed', error: '任务因服务重启中断，请重新生成' } })
      .catch(() => undefined);
  }

  // ===================== 形象管理 =====================

  async saveAvatar(file: any, name: string): Promise<DigitalHumanAvatar> {
    // 兼容两种上传形态：multer 内存存储（buffer）或磁盘存储（path）
    if (!file || (!file.path && !file.buffer)) throw new BadRequestException('上传文件失败');
    const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || 'jpg';
    const isVideo = /^(mp4|mov|m4v|webm)$/.test(ext);
    if (!isVideo && !/^(jpg|jpeg|png|webp)$/.test(ext)) {
      if (file.path) rmSync(file.path, { force: true });
      throw new BadRequestException('仅支持图片(jpg/png/webp)或视频(mp4/mov)');
    }
    const fileName = `${Date.now()}.${ext}`;
    const dest = join(this.avatarDir, fileName);
    try {
      if (file.buffer) {
        writeFileSync(dest, file.buffer);
      } else {
        const { rename } = await import('fs/promises');
        await rename(file.path, dest);
      }
    } catch {
      if (file.buffer) throw new BadRequestException('保存文件失败');
      const { copyFile } = await import('fs/promises');
      await copyFile(file.path, dest);
      rmSync(file.path, { force: true });
    }
    const avatar = await this.prisma.digitalHumanAvatar.create({
      data: {
        name: (name || file.originalname || '未命名形象').slice(0, 100),
        type: isVideo ? 'video' : 'image',
        fileUrl: `/digital-human/files/avatars/${fileName}`,
      },
    });
    return avatar as any;
  }

  async listAvatars() {
    return this.prisma.digitalHumanAvatar.findMany({ orderBy: { id: 'desc' } });
  }

  async deleteAvatar(id: number) {
    const avatar = await this.prisma.digitalHumanAvatar.findUnique({ where: { id } });
    if (!avatar) return { ok: true };
    const tasks = await this.prisma.digitalHumanTask.findMany({ where: { avatarId: id } });
    for (const t of tasks) {
      try {
        rmSync(join(this.taskDir, String(t.id)), { recursive: true, force: true });
      } catch {
        /* 清理失败不阻断删除 */
      }
      await this.prisma.digitalHumanTask.delete({ where: { id: t.id } }).catch(() => undefined);
    }
    if (avatar.fileUrl) {
      const f = avatar.fileUrl.split('/').pop();
      if (f) {
        try {
          rmSync(join(this.avatarDir, f), { force: true });
        } catch {
          /* 清理失败不阻断删除 */
        }
      }
    }
    await this.prisma.digitalHumanAvatar.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  }

  // ===================== 任务管理 =====================

  async createTask(body: Record<string, any>) {
    const avatar = await this.prisma.digitalHumanAvatar.findUnique({ where: { id: Number(body.avatarId) } });
    if (!avatar) throw new BadRequestException('请先选择数字人形象');
    if (!body.script?.trim()) throw new BadRequestException('请输入口播文案');
    if (!this.ffmpeg) throw new BadRequestException('数字人合成引擎未就绪（video-generator 未启动）');

    const task = await this.prisma.digitalHumanTask.create({
      data: {
        title: (body.title || body.script.slice(0, 30)).slice(0, 200),
        avatarId: avatar.id,
        script: body.script,
        voiceName: body.voiceName || 'zh-CN-XiaoxiaoNeural-Female',
        aspect: ['9:16', '16:9', '1:1'].includes(body.aspect || '') ? body.aspect! : '9:16',
        subtitleEnabled: body.subtitleEnabled !== false,
        bgmEnabled: !!body.bgmEnabled,
      },
    });

    // 后台异步执行
    setImmediate(() => void this.processTask(task.id));
    return task;
  }

  async listTasks() {
    return this.prisma.digitalHumanTask.findMany({
      orderBy: { id: 'desc' },
      include: { avatar: { select: { id: true, name: true, type: true, fileUrl: true } } },
    });
  }

  async getTask(id: number) {
    const task = await this.prisma.digitalHumanTask.findUnique({
      where: { id },
      include: { avatar: { select: { id: true, name: true, type: true, fileUrl: true } } },
    });
    if (!task) throw new NotFoundException('任务不存在');
    return task;
  }

  async deleteTask(id: number) {
    try {
      rmSync(join(this.taskDir, String(id)), { recursive: true, force: true });
    } catch (e) {
      this.logger.warn(`清理任务目录失败 task=${id}: ${(e as Error).message}`);
    }
    await this.prisma.digitalHumanTask.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  }

  // ===================== 文件 =====================

  resolveFile(type: 'avatars' | 'tasks', name: string): string {
    // 防目录穿越
    const safe = name.replace(/\.\.(\/|\\)/g, '');
    const base = type === 'avatars' ? this.avatarDir : this.taskDir;
    const p = join(base, safe);
    if (!p.startsWith(base) || !existsSync(p) || !statSync(p).isFile()) {
      throw new NotFoundException('文件不存在');
    }
    return p;
  }

  /** 口播成片：taskDir/{id}/final.mp4 */
  resolveTaskVideo(id: number): string {
    const p = join(this.taskDir, String(id), 'final.mp4');
    if (!p.startsWith(this.taskDir) || !existsSync(p) || !statSync(p).isFile()) {
      throw new NotFoundException('成片不存在');
    }
    return p;
  }

  // ===================== 合成核心 =====================

  private async processTask(taskId: number) {
    if (this.processing.has(taskId)) return;
    this.processing.add(taskId);
    try {
      const task = await this.prisma.digitalHumanTask.findUnique({ where: { id: taskId } });
      if (!task) return;
      const avatar = await this.prisma.digitalHumanAvatar.findUnique({ where: { id: task.avatarId } });
      if (!avatar) throw new Error('数字人形象已被删除');

      const outDir = join(this.taskDir, String(taskId));
      mkdirSync(outDir, { recursive: true });
      const audioPath = join(outDir, 'audio.mp3');
      const finalPath = join(outDir, 'final.mp4');

      await this.update(taskId, { status: 'processing', progress: 10 });

      // 1) TTS 配音
      const voice = (task.voiceName || '').replace(/-(Female|Male)$/i, '');
      const { stderr: ttsErr } = await execFileAsync(this.venvPython, [
        '-m', 'edge_tts',
        '--voice', voice,
        '--text', task.script,
        '--write-media', audioPath,
      ], { timeout: 120000 }).catch((e) => {
        this.logger.error(`TTS 失败: ${e?.stderr || e.message}`);
        throw new Error(`配音生成失败（${voice}），请检查网络或换音色`);
      });
      if (!existsSync(audioPath)) throw new Error('配音生成失败：未产出音频');
      await this.update(taskId, { progress: 35 });

      // 2) 获取音频时长
      const duration = await this.audioDuration(audioPath);
      if (duration <= 0) throw new Error('配音音频异常');

      // 3) ffmpeg 合成（形象 + 配音 + 字幕 + 可选BGM）
      const aspect = (task.aspect || '9:16') as '9:16' | '16:9' | '1:1';
      const { w, h, fontSize } = { '9:16': { w: 1080, h: 1920, fontSize: 52 }, '16:9': { w: 1920, h: 1080, fontSize: 68 }, '1:1': { w: 1080, h: 1080, fontSize: 52 } }[aspect];

      const avatarFile = join(this.avatarDir, (avatar.fileUrl || '').split('/').pop() || '');
      const cmd = await this.buildFfmpegCommand({
        taskId,
        avatarFile,
        avatarType: avatar.type as 'image' | 'video',
        audioPath,
        duration,
        w, h, fontSize,
        subtitleEnabled: task.subtitleEnabled,
        subtitleTexts: task.subtitleEnabled ? this.splitSubtitle(task.script, duration) : [],
        bgmEnabled: task.bgmEnabled && existsSync(this.songsDir) && readdirSync(this.songsDir).some((f) => f.endsWith('.mp3')),
        output: finalPath,
      });

      await this.update(taskId, { progress: 60 });
      this.logger.log(`数字人合成中 task=${taskId} 时长=${duration.toFixed(1)}s`);
      const { stderr: encErr } = await execFileAsync(this.ffmpeg, cmd, { timeout: 600000 }).catch((e) => {
        const msg = `${e?.stderr || e.message}`;
        this.logger.error(`ffmpeg 合成失败: ${msg.slice(-500)}`);
        throw new Error(`视频合成失败: ${msg.split('\n').filter(Boolean).pop()?.slice(0, 120) || '未知错误'}`);
      });
      if (!existsSync(finalPath)) throw new Error('视频合成失败：未产出成片');

      // 4) 清理中间文件（保留 audio 供调试；清理失败不影响任务状态）
      try {
        for (const f of ['base.mp4']) rmSync(join(outDir, f), { force: true });
        rmSync(join(outDir, 'seg'), { recursive: true, force: true });
      } catch (e) {
        this.logger.warn(`清理中间文件失败 task=${taskId}: ${(e as Error).message}`);
      }

      await this.update(taskId, {
        status: 'completed',
        progress: 100,
        duration: Math.round(duration),
        videoUrl: `/digital-human/tasks/${taskId}/video`,
      });
      this.logger.log(`数字人成片完成 task=${taskId}`);
    } catch (e) {
      const msg = (e as Error).message || '未知错误';
      this.logger.error(`数字人任务失败 task=${taskId}: ${msg}`);
      await this.update(taskId, { status: 'failed', error: msg }).catch(() => undefined);
    } finally {
      this.processing.delete(taskId);
    }
  }

  private async update(id: number, data: any) {
    await this.prisma.digitalHumanTask.update({ where: { id }, data }).catch(() => undefined);
  }

  /** 解析音频时长（秒）：ffmpeg -i 无输出文件时非零退出，需从 reject 的 stderr 提取 Duration */
  private async audioDuration(path: string): Promise<number> {
    try {
      await execFileAsync(this.ffmpeg, ['-i', path], { timeout: 30000 });
    } catch (e: any) {
      const m = (e?.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    }
    return 0;
  }

  /** 把文案按标点切分成字幕段，按字数比例分配时间 */
  private splitSubtitle(script: string, duration: number): { text: string; start: number; end: number }[] {
    const raw = script.replace(/\s+/g, ' ').trim();
    if (!raw) return [];
    // 按标点切句，控制每句 <= 20 字
    const sentences: string[] = [];
    let buf = '';
    for (const ch of raw) {
      buf += ch;
      if ('。！？；!?;'.includes(ch) || buf.length >= 20) {
        sentences.push(buf.trim());
        buf = '';
      }
    }
    if (buf.trim()) sentences.push(buf.trim());
    if (sentences.length === 0) sentences.push(raw);

    const totalChars = sentences.reduce((s, x) => s + x.length, 0);
    const segments: { text: string; start: number; end: number }[] = [];
    let cursor = 0;
    for (const s of sentences) {
      const segDur = (s.length / totalChars) * duration;
      // 每行最多 14 个字（竖屏 1080 宽），自动换行
      const lines: string[] = [];
      for (let i = 0; i < s.length; i += 14) lines.push(s.slice(i, i + 14));
      segments.push({ text: lines.join('\n'), start: cursor, end: Math.min(cursor + segDur, duration) });
      cursor += segDur;
    }
    return segments;
  }

  private async buildFfmpegCommand(opts: {
    taskId: number;
    avatarFile: string;
    avatarType: 'image' | 'video';
    audioPath: string;
    duration: number;
    w: number;
    h: number;
    fontSize: number;
    subtitleEnabled: boolean;
    subtitleTexts: { text: string; start: number; end: number }[];
    bgmEnabled: boolean;
    output: string;
  }): Promise<string[]> {
    const { taskId, avatarFile, avatarType, audioPath, duration, w, h, fontSize, subtitleEnabled, subtitleTexts, bgmEnabled, output } = opts;
    const durSec = duration.toFixed(2);
    const fps = 25;
    const audioSec = `between(t,0,${durSec})`;

    // 画面链
    let vf = '';
    if (avatarType === 'image') {
      vf = `[0:v]scale=${Math.round(w * 1.15)}:${Math.round(h * 1.15)}:force_original_aspect_ratio=increase,crop=${Math.round(w * 1.15)}:${Math.round(h * 1.15)},zoompan=z='min(zoom+0.0010,1.15)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=${fps},setsar=1`;
    } else {
      vf = `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
    }

    // 字幕 drawtext 链（临时文件写入任务私有目录，合成后清理）
    if (subtitleEnabled && subtitleTexts.length) {
      const segDir = join(this.taskDir, String(opts.taskId), 'seg');
      mkdirSync(segDir, { recursive: true });
      const filters: string[] = [];
      subtitleTexts.forEach((seg, i) => {
        const tf = join(segDir, `${i}.txt`);
        writeFileSync(tf, seg.text, 'utf8');
        const esc = (s: string) => s.replace(/'/g, "\\'");
        filters.push(
          `drawtext=fontfile=${this.fontPath}:textfile=${esc(tf)}:fontsize=${fontSize}:fontcolor=white:borderw=4:bordercolor=black@0.85:x=(w-text_w)/2:y=h-${Math.round(h * 0.14)}:line_spacing=10:enable='between(t,${seg.start.toFixed(2)},${Math.max(seg.end - 0.05, seg.start + 0.3).toFixed(2)})'`,
        );
      });
      vf = `${vf},${filters.join(',')}`;
    }

    // 音频链
    let inputs = '';
    let mapAudio = '';
    let audioArgs: string[] = [];
    if (bgmEnabled) {
      const bgm = readdirSync(this.songsDir).find((f) => f.endsWith('.mp3'))!;
      inputs = `-stream_loop -1 -i ${join(this.songsDir, bgm)} `;
      vf = `${vf}[v]`;
      audioArgs = [
        '-filter_complex',
        `${vf};[1:a]volume=1.0[voice];[2:a]volume=0.18,afade=t=in:st=0:d=1,afade=t=out:st=${durSec}:d=1[bgm];[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]`,
        '-map', '[v]',
        '-map', '[a]',
      ];
    } else {
      audioArgs = ['-map', '1:a'];
    }

    return [
      '-y',
      ...(avatarType === 'image'
        ? ['-loop', '1', '-framerate', String(fps), '-t', durSec, '-i', avatarFile]
        : ['-stream_loop', '-1', '-i', avatarFile]),
      '-i', audioPath,
      ...(inputs ? inputs.split(' ').filter(Boolean) : []),
      ...audioArgs,
      '-c:v', 'h264_videotoolbox',
      '-b:v', '5M',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-t', durSec,
      '-shortest',
      output,
    ];
  }
}
