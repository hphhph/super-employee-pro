import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'change-this-to-a-random-string' || secret === 'super-employee-jwt-secret') {
      throw new Error(
        'JWT_SECRET 未正确配置！请在 .env 中设置一个随机的 JWT_SECRET（可用 openssl rand -hex 32 生成），当前使用的是默认值，存在安全隐患。',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
    this.logger.log('JWT 策略已加载（使用自定义密钥）');
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { department: true },
    });
    if (!user || user.status !== 1) {
      return null;
    }
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      role: user.role,
      departmentId: user.departmentId,
      department: user.department,
    };
  }
}
