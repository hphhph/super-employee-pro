import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(private prisma: PrismaService) {}

  // ===== 知识库 =====
  async findBases(params: { page?: number; pageSize?: number; keyword?: string }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 20;
    const keyword = params.keyword;
    const where = keyword ? { name: { contains: keyword } } : {};
    const [total, list] = await Promise.all([
      this.prisma.knowledgeBase.count({ where }),
      this.prisma.knowledgeBase.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async createBase(data: { name: string; description?: string; type?: string }) {
    return this.prisma.knowledgeBase.create({ data });
  }

  async updateBase(id: number, data: any) {
    return this.prisma.knowledgeBase.update({ where: { id }, data });
  }

  async deleteBase(id: number) {
    await this.prisma.knowledgeBase.delete({ where: { id } });
    return { success: true };
  }

  // ===== 知识文档 =====
  async findDocuments(baseId: number, params: { page?: number; pageSize?: number }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 20;
    const [total, list] = await Promise.all([
      this.prisma.knowledgeDocument.count({ where: { knowledgeBaseId: baseId } }),
      this.prisma.knowledgeDocument.findMany({
        where: { knowledgeBaseId: baseId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async createDocument(data: { knowledgeBaseId: number; title: string; content: string; type?: string; url?: string }) {
    const doc = await this.prisma.knowledgeDocument.create({ data });
    await this.prisma.knowledgeBase.update({
      where: { id: data.knowledgeBaseId },
      data: { documentCount: { increment: 1 } },
    });
    return doc;
  }

  async deleteDocument(id: number) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('文档不存在');
    await this.prisma.knowledgeDocument.delete({ where: { id } });
    await this.prisma.knowledgeBase.update({
      where: { id: doc.knowledgeBaseId },
      data: { documentCount: { decrement: 1 } },
    });
    return { success: true };
  }

  // ===== 智能体 =====
  async findAgents(params: { page?: number; pageSize?: number; keyword?: string }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 20;
    const keyword = params.keyword;
    const where = keyword ? { name: { contains: keyword } } : {};
    const [total, list] = await Promise.all([
      this.prisma.aiAgent.count({ where }),
      this.prisma.aiAgent.findMany({
        where,
        include: { knowledgeBases: { include: { knowledgeBase: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async createAgent(data: any) {
    const { knowledgeBaseIds, ...agentData } = data;
    const agent = await this.prisma.aiAgent.create({ data: agentData });
    if (knowledgeBaseIds?.length) {
      await this.prisma.agentKnowledgeBase.createMany({
        data: knowledgeBaseIds.map((kbId: number) => ({ agentId: agent.id, knowledgeBaseId: kbId })),
      });
    }
    return agent;
  }

  async updateAgent(id: number, data: any) {
    const { knowledgeBaseIds, ...agentData } = data;
    if (knowledgeBaseIds) {
      await this.prisma.agentKnowledgeBase.deleteMany({ where: { agentId: id } });
      if (knowledgeBaseIds.length) {
        await this.prisma.agentKnowledgeBase.createMany({
          data: knowledgeBaseIds.map((kbId: number) => ({ agentId: id, knowledgeBaseId: kbId })),
        });
      }
    }
    return this.prisma.aiAgent.update({ where: { id }, data: agentData });
  }

  async deleteAgent(id: number) {
    await this.prisma.aiAgent.delete({ where: { id } });
    return { success: true };
  }

  // ===== 知识分类 =====
  async findCategories() {
    const categories = await this.prisma.knowledgeCategory.findMany({ orderBy: { sort: 'asc' } });
    const map = new Map<number, any>();
    const roots: any[] = [];
    categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
    categories.forEach((c) => {
      const node = map.get(c.id);
      if (c.parentId && map.has(c.parentId)) map.get(c.parentId).children.push(node);
      else roots.push(node);
    });
    return roots;
  }

  async createCategory(data: { name: string; parentId?: number; sort?: number }) {
    return this.prisma.knowledgeCategory.create({ data });
  }

  async deleteCategory(id: number) {
    await this.prisma.knowledgeCategory.delete({ where: { id } });
    return { success: true };
  }
}
