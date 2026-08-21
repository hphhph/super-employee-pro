<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="table-toolbar">
        <span style="font-weight: 600">部门管理</span>
        <el-button type="primary" :icon="Plus" @click="openDialog()">新增部门</el-button>
      </div>

      <el-table :data="tree" v-loading="loading" row-key="id" default-expand-all>
        <el-table-column prop="name" label="部门名称" min-width="240" />
        <el-table-column prop="leader" label="负责人" width="120" />
        <el-table-column prop="phone" label="联系电话" width="150" />
        <el-table-column label="员工数" width="100">
          <template #default="{ row }">{{ row.users?.length || 0 }}</template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" link type="primary" @click="openDialog(null, row.id)">添加子部门</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑部门' : '新增部门'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="部门名称" required>
          <el-input v-model="form.name" placeholder="如：技术部" />
        </el-form-item>
        <el-form-item label="上级部门">
          <el-tree-select
            v-model="form.parentId"
            :data="tree"
            :props="{ label: 'name', value: 'id' }"
            check-strictly
            clearable
            placeholder="留空为顶级部门"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.leader" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { getDepartmentTree, createDepartment, updateDepartment, deleteDepartment } from '@/api';

const tree = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editing = ref<any>(null);
const form = reactive<any>({ name: '', parentId: null, leader: '', phone: '', sort: 0 });

const loadData = async () => {
  loading.value = true;
  try {
    tree.value = ((await getDepartmentTree()) as any[]) || [];
  } finally {
    loading.value = false;
  }
};

const openDialog = (row?: any, parentId?: number) => {
  editing.value = row || null;
  Object.assign(form, {
    name: row?.name || '',
    parentId: parentId || row?.parentId || null,
    leader: row?.leader || '',
    phone: row?.phone || '',
    sort: row?.sort || 0,
  });
  dialogVisible.value = true;
};

const handleSave = async () => {
  if (!form.name) return ElMessage.warning('请输入部门名称');
  if (editing.value) {
    await updateDepartment(editing.value.id, { ...form });
  } else {
    await createDepartment({ ...form });
  }
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  await loadData();
};

const handleDelete = async (row: any) => {
  await ElMessageBox.confirm(`确定删除部门「${row.name}」吗？`, '提示', { type: 'warning' });
  await deleteDepartment(row.id);
  ElMessage.success('已删除');
  await loadData();
};

onMounted(loadData);
</script>
