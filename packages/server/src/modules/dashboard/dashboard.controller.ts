import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('工作台')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: '数据总览' })
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('trend')
  @ApiOperation({ summary: '最近7天趋势' })
  getTrend() {
    return this.dashboardService.getTrend();
  }
}
