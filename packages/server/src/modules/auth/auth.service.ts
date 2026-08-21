import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

export interface LoginResult {
  token: string;
  user: any;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** 登录失败限流（内存版）：key = `${username}|${ip}` */
  private failMap = new Map<string, { count: number; lockedUntil: number }>();
  private readonly MAX_FAILS = 5;
  private readonly LOCK_MS = 15 * 60 * 1000; // 15 分钟

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string, ip?: string): Promise<LoginResult> {
    const failKey = `${username}|${ip || 'unknown'}`;
    const rec = this.failMap.get(failKey);
    if (rec && rec.lockedUntil > Date.now()) {
      const mins = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
      throw new UnauthorizedException(`登录尝试次数过多，已临时锁定，请 ${mins} 分钟后再试`);
    }

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { department: true },
    });

    if (!user) {
      this.recordFail(failKey);
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('账号已被禁用，请联系管理员');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.recordFail(failKey);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 登录成功，清除该 key 的失败记录
    this.failMap.delete(failKey);

    // 更新最后登录信息
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwtService.sign(payload);

    const { password: _, ...userInfo } = user;
    return { token, user: userInfo };
  }

  /** 记录一次登录失败，达到阈值则锁定 */
  private recordFail(key: string) {
    const rec = this.failMap.get(key) || { count: 0, lockedUntil: 0 };
    rec.count += 1;
    if (rec.count >= this.MAX_FAILS) {
      rec.lockedUntil = Date.now() + this.LOCK_MS;
      rec.count = 0;
      this.logger.warn(`登录失败次数过多已锁定: ${key}`);
    }
    this.failMap.set(key, rec);
    // 定期清理过期记录，防止 Map 无限增长
    if (this.failMap.size > 5000) {
      const now = Date.now();
      for (const [k, v] of this.failMap) {
        if (v.lockedUntil < now) this.failMap.delete(k);
      }
    }
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    const isOldValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldValid) throw new BadRequestException('原密码错误');

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNew },
    });

    return { success: true };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        computeLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    const { password, ...userInfo } = user;
    return userInfo;
  }
}
