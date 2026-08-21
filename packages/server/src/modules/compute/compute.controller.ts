import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComputeService } from './compute.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('算力管理')
@Controller('compute')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ComputeController {
  constructor(private computeService: ComputeService) {}

  @Get('quota')
  @ApiOperation({ summary: '获取我的算力配额' })
  getQuota(@CurrentUser('id') userId: number) {
    return this.computeService.getQuota(userId);
  }

  @Get('logs')
  @ApiOperation({ summary: '算力消耗记录' })
  getLogs(@CurrentUser('id') userId: number, @Query() params: any) {
    return this.computeService.getLogs(userId, params);
  }

  @Post('recharge/:userId')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '充值算力（管理员）' })
  recharge(@Param('userId') userId: number, @Body() data: { amount: number }) {
    return this.computeService.recharge(userId, data.amount);
  }
}
