import { Injectable, NestInterceptor, ExecutionContext, CallHandler, StreamableFile } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // 文件流（视频下载/播放等）直接透传，不包 JSON 结构
        if (data instanceof StreamableFile) {
          return data;
        }
        return {
          code: 0,
          message: 'success',
          data: data ?? {},
        };
      }),
    );
  }
}
