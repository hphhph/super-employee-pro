import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('部门管理')
@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get('tree')
  @ApiOperation({ summary: '获取部门树' })
  findTree() {
    return this.departmentsService.findTree();
  }

  @Post()
  @ApiOperation({ summary: '创建部门' })
  create(@Body() data: any) {
    return this.departmentsService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新部门' })
  update(@Param('id') id: number, @Body() data: any) {
    return this.departmentsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除部门' })
  remove(@Param('id') id: number) {
    return this.departmentsService.remove(id);
  }
}
