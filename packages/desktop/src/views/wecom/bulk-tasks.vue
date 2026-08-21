<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="table-toolbar">
        <span style="font-weight: 600">精准群发任务</span>
        <el-button type="primary" :icon="Plus" @click="dialogVisible = true">创建群发</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="name" label="任务名称" min-width="180" />
        <el-table-column label="目标" width="120">
          <template #default="{ row }">
            {{ row.targetType === 'all' ? '全部客户' : row.targetType === 'label' ? '按标签' : '自选' }}
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
        <el-table-column label="进度" width="160">
          <template #default="{ row }">
            <el-progress :percentage="row.total ? Math.round(row.sent / row.total * 100) : 0" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.type || 'info'" size="small">{{ statusMap[row.status]?.label || row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="创建群发任务" width="560px">
      <el-form label-width="90px">
        <el-form-item label="任务名称" required>
          <el-input v-model="form.name" placeholder="如：新品上架通知" />
        </el-form-item>
        <el-form-item label="发送对象">
          <el-select v-model="form.targetType" style="width: 100%">
            <el-option label="全部客户" value="all" />
            <el-option label="按标签选择" value="label" />
            <el-option label="自定义选择" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="消息内容" required>
          <el-input v-model="form.content" type="textarea" :rows="5" placeholder="群发的消息内容" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { getWecomBulkTasks, createWecomBulkTask } from '@/api';

const list = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const form = reactive({ name: '', targetType: 'all', contentType: 'text', content: '' });

const statusMap: Record<string, { type: string; label: string }> = {
  pending: { type: 'info', label: '待发送' },
  running: { type: 'warning', label: '发送中' },
  completed: { type: 'success', label: '已完成' },
  failed: { type: 'danger', label: '失败' },
  cancelled: { type: 'info', label: '已取消' },
};

const loadData = async () => {
  loading.value = true;
  try {
    const res: any = await getWecomBulkTasks({ page: 1, pageSize: 20 });
    list.value = res.list || [];
  } finally {
    loading.value = false;
  }
};

const handleCreate = async () => {
  if (!form.name || !form.content) return ElMessage.warning('请填写任务名和内容');
  await createWecomBulkTask({ ...form });
  ElMessage.success('群发任务已创建');
  dialogVisible.value = false;
  form.name = '';
  form.content = '';
  await loadData();
};

onMounted(loadData);
</script>
