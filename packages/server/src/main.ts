import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      // 仅允许本机来源（前端 dev server / Electron 本地页面），避免跨域被第三方页面调用
      origin(origin, cb) {
        if (!origin) return cb(null, true); // 非浏览器请求（curl / 内部服务）放行
        try {
          const { hostname, protocol } = new URL(origin);
          const isLocal =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1' ||
            protocol === 'file:';
          cb(null, isLocal);
        } catch {
          cb(null, false);
        }
      },
      credentials: true,
    },
  });

  app.setGlobalPrefix('api');

  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 全局拦截器和异常过滤器
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger 文档（生产环境默认关闭，避免暴露接口结构；如需开启设 SWAGGER_ENABLED=true）
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd || process.env.SWAGGER_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle('AI超级员工系统 API')
      .setDescription('基于源码逆向分析的完整 API 文档')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
}
bootstrap();
