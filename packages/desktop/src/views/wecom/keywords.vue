<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="table-toolbar">
        <el-input v-model="keyword" placeholder="搜索关键词" style="width: 240px" clearable @keyup.enter="loadData">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" :icon="Plus" @click="openDialog()">新增关键词</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="keyword" label="关键词" width="180" />
        <el-table-column label="匹配方式" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.matchType === 'exact' ? 'danger' : row.matchType === 'contains' ? 'warning' : 'info'">
              {{ row.matchType === 'exact' ? '完全匹配' : row.matchType === 'contains' ? '包含匹配' : '模糊匹配' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="replyContent" label="回复内容" min-width="300" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.status" :active-value="1" :inactive-value="0" @change="handleToggle(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="page"
          :page-size="20"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑关键词' : '新增关键词'" width="560px">
      <el-form label-width="90px">
        <el-form-item label="关键词" required>
          <el-input v-model="form.keyword" placeholder="触发回复的关键词，如：价格" />
        </el-form-item>
        <el-form-item label="匹配方式">
          <el-radio-group v-model="form.matchType">
            <el-radio value="exact">完全匹配</el-radio>
            <el-radio value="contains">包含匹配</el-radio>
            <el-radio value="fuzzy">模糊匹配</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="回复类型">
          <el-select v-model="form.replyType">
            <el-option label="文本" value="text" />
            <el-option label="图片" value="image" />
            <el-option label="链接" value="link" />
          </el-select>
        </el-form-item>
        <el-form-item label="回复内容" required>
          <el-input v-model="form.replyContent" type="textarea" :rows="4" placeholder="客户发送关键词后自动回复的内容" />
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
import { getWecomKeywords, createWecomKeyword, updateWecomKeyword, deleteWecomKeyword } from '@/api';

const list = ref<any[]>([]);
const loading = ref(false);
const keyword = ref('');
const page = ref(1);
const total = ref(0);
const dialogVisible = ref(false);
const editing = ref<any>(null);
const form = reactive({
  keyword: '', matchType: 'exact', replyType: 'text', replyContent: '', priority: 0,
});

const loadData = async () => {
  loading.value = true;
  try {
    const res: any = await getWecomKeywords({ page: page.value, pageSize: 20, keyword: keyword.value });
    list.value = res.list || [];
    total.value = res.total || 0;
  } finally {
    loading.value = false;
  }
};

const openDialog = (row?: any) => {
  editing.value = row || null;
  Object.assign(form, {
    keyword: row?.keyword || '',
    matchType: row?.matchType || 'exact',
    replyType: row?.replyType || 'text',
    replyContent: row?.replyContent || '',
    priority: row?.priority || 0,
  });
  dialogVisible.value = true;
};

const handleSave = async () => {
  if (!form.keyword || !form.replyContent) return ElMessage.warning('请填写关键词和回复内容');
  if (editing.value) {
    await updateWecomKeyword(editing.value.id, { ...form });
  } else {
    await createWecomKeyword({ ...form });
  }
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  await loadData();
};

const handleToggle = async (row: any) => {
  await updateWecomKeyword(row.id, { status: row.status });
};

const handleDelete = async (row: any) => {
  await ElMessageBox.confirm(`确定删除关键词「${row.keyword}」吗？`, '提示', { type: 'warning' });
  await deleteWecomKeyword(row.id);
  ElMessage.success('已删除');
  await loadData();
};

onMounted(loadData);
</script>
