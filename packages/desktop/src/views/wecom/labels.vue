<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="table-toolbar">
        <span style="font-weight: 600">标签管理</span>
        <el-button type="primary" :icon="Plus" @click="openDialog()">新建标签</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="标签名" min-width="200">
          <template #default="{ row }">
            <el-tag :color="row.color" style="color: #fff; border: none">{{ row.name }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fanCount" label="客户数" width="120" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑标签' : '新建标签'" width="420px">
      <el-form label-width="80px">
        <el-form-item label="标签名" required>
          <el-input v-model="form.name" placeholder="如：意向客户" maxlength="20" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="form.color" />
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
import { getWecomLabels, createWecomLabel, updateWecomLabel, deleteWecomLabel } from '@/api';
import dayjs from 'dayjs';

const list = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editing = ref<any>(null);
const form = reactive({ name: '', color: '#409eff' });

const loadData = async () => {
  loading.value = true;
  try {
    list.value = ((await getWecomLabels()) as any[]) || [];
  } finally {
    loading.value = false;
  }
};

const openDialog = (row?: any) => {
  editing.value = row || null;
  form.name = row?.name || '';
  form.color = row?.color || '#409eff';
  dialogVisible.value = true;
};

const handleSave = async () => {
  if (!form.name.trim()) return ElMessage.warning('请输入标签名');
  if (editing.value) {
    await updateWecomLabel(editing.value.id, { ...form });
  } else {
    await createWecomLabel({ ...form });
  }
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  await loadData();
};

const handleDelete = async (row: any) => {
  await ElMessageBox.confirm(`确定删除标签「${row.name}」吗？`, '提示', { type: 'warning' });
  await deleteWecomLabel(row.id);
  ElMessage.success('已删除');
  await loadData();
};

const formatTime = (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm');

onMounted(loadData);
</script>
