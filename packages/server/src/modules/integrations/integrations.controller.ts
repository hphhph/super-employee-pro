import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('第三方服务整合')
@Controller('integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: '已整合的第三方服务列表' })
  list() {
    return this.integrationsService.list();
  }

  @Get('status')
  @ApiOperation({ summary: '第三方服务运行状态' })
  status() {
    return this.integrationsService.status();
  }
}
