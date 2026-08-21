import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token 已过期，请重新登录');
      }
      if (info instanceof JsonWebTokenError) {
        throw new UnauthorizedException('无效的 Token');
      }
      throw new UnauthorizedException(info?.message || '未授权访问');
    }
    return user;
  }
}
