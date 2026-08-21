import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  /** 获取部门树 */
  async findTree() {
    const departments = await this.prisma.department.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      include: { users: { select: { id: true, username: true, nickname: true } } },
    });

    const map = new Map<number, any>();
    const roots: any[] = [];

    departments.forEach((d) => map.set(d.id, { ...d, children: [] }));
    departments.forEach((d) => {
      const node = map.get(d.id);
      if (d.parentId && map.has(d.parentId)) {
        map.get(d.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async create(data: { name: string; parentId?: number; sort?: number; leader?: string; phone?: string }) {
    return this.prisma.department.create({ data });
  }

  async update(id: number, data: Partial<{ name: string; parentId: number; sort: number; leader: string; phone: string; status: number }>) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('部门不存在');
    if (data.parentId === id) throw new NotFoundException('上级部门不能是自己');
    return this.prisma.department.update({ where: { id }, data });
  }

  async remove(id: number) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('部门不存在');

    const childCount = await this.prisma.department.count({ where: { parentId: id } });
    if (childCount > 0) throw new NotFoundException('请先删除子部门');

    const userCount = await this.prisma.user.count({ where: { departmentId: id } });
    if (userCount > 0) throw new NotFoundException('该部门下还有员工，请先转移');

    await this.prisma.department.delete({ where: { id } });
    return { success: true };
  }
}
