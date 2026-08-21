<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="table-toolbar">
        <span style="font-weight: 600">智能体知识库</span>
        <el-button type="primary" :icon="Plus" @click="openDialog()">创建知识库</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="name" label="知识库名称" min-width="200" />
        <el-table-column prop="description" label="描述" min-width="240" show-overflow-tooltip />
        <el-table-column prop="documentCount" label="文档数" width="100" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ typeMap[row.type] || row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDocs(row)">文档管理</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="创建知识库" width="520px">
      <el-form label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：产品知识库" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="通用知识" value="general" />
            <el-option label="销售话术" value="sales" />
            <el-option label="产品资料" value="product" />
            <el-option label="常见问题" value="faq" />
          </el-select>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { getKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase } from '@/api';

const list = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const form = reactive({ name: '', description: '', type: 'general' });

const typeMap: Record<string, string> = {
  general: '通用知识', sales: '销售话术', product: '产品资料', faq: '常见问题',
};

const loadData = async () => {
  loading.value = true;
  try {
    const res: any = await getKnowledgeBases({ page: 1, pageSize: 50 });
    list.value = res.list || [];
  } finally {
    loading.value = false;
  }
};

const openDialog = () => { dialogVisible.value = true; };

const handleCreate = async () => {
  if (!form.name) return ElMessage.warning('请输入名称');
  await createKnowledgeBase({ ...form });
  ElMessage.success('创建成功');
  dialogVisible.value = false;
  form.name = '';
  form.description = '';
  await loadData();
};

const handleDelete = async (row: any) => {
  await ElMessageBox.confirm(`确定删除知识库「${row.name}」及其所有文档吗？`, '提示', { type: 'warning' });
  await deleteKnowledgeBase(row.id);
  ElMessage.success('已删除');
  await loadData();
};

const openDocs = (row: any) => {
  ElMessage.info(`知识库「${row.name}」文档管理（开发中）`);
};

onMounted(loadData);
</script>
