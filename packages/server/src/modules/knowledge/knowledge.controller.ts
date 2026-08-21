import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('企业智库')
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeController {
  constructor(private knowledgeService: KnowledgeService) {}

  // 知识库
  @Get('bases')
  @ApiOperation({ summary: '知识库列表' })
  findBases(@Query() params: any) {
    return this.knowledgeService.findBases(params);
  }

  @Post('bases')
  @ApiOperation({ summary: '创建知识库' })
  createBase(@Body() data: any) {
    return this.knowledgeService.createBase(data);
  }

  @Put('bases/:id')
  @ApiOperation({ summary: '更新知识库' })
  updateBase(@Param('id') id: number, @Body() data: any) {
    return this.knowledgeService.updateBase(id, data);
  }

  @Delete('bases/:id')
  @ApiOperation({ summary: '删除知识库' })
  deleteBase(@Param('id') id: number) {
    return this.knowledgeService.deleteBase(id);
  }

  // 知识文档
  @Get('bases/:baseId/documents')
  @ApiOperation({ summary: '知识库文档列表' })
  findDocuments(@Param('baseId') baseId: number, @Query() params: any) {
    return this.knowledgeService.findDocuments(baseId, params);
  }

  @Post('documents')
  @ApiOperation({ summary: '添加知识文档' })
  createDocument(@Body() data: any) {
    return this.knowledgeService.createDocument(data);
  }

  @Delete('documents/:id')
  @ApiOperation({ summary: '删除知识文档' })
  deleteDocument(@Param('id') id: number) {
    return this.knowledgeService.deleteDocument(id);
  }

  // 智能体
  @Get('agents')
  @ApiOperation({ summary: '智能体列表' })
  findAgents(@Query() params: any) {
    return this.knowledgeService.findAgents(params);
  }

  @Post('agents')
  @ApiOperation({ summary: '创建智能体' })
  createAgent(@Body() data: any) {
    return this.knowledgeService.createAgent(data);
  }

  @Put('agents/:id')
  @ApiOperation({ summary: '更新智能体' })
  updateAgent(@Param('id') id: number, @Body() data: any) {
    return this.knowledgeService.updateAgent(id, data);
  }

  @Delete('agents/:id')
  @ApiOperation({ summary: '删除智能体' })
  deleteAgent(@Param('id') id: number) {
    return this.knowledgeService.deleteAgent(id);
  }

  // 知识分类
  @Get('categories')
  @ApiOperation({ summary: '知识分类树' })
  findCategories() {
    return this.knowledgeService.findCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: '创建知识分类' })
  createCategory(@Body() data: any) {
    return this.knowledgeService.createCategory(data);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '删除知识分类' })
  deleteCategory(@Param('id') id: number) {
    return this.knowledgeService.deleteCategory(id);
  }
}
