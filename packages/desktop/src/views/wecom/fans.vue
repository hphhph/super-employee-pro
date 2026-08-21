<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="table-toolbar">
        <el-input v-model="keyword" placeholder="搜索客户名称/备注" style="width: 240px" clearable @keyup.enter="loadData">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div>
          <el-button :icon="Refresh" @click="loadData">刷新</el-button>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="客户" width="260">
          <template #default="{ row }">
            <div class="fan-cell">
              <el-avatar :size="36" :src="row.avatar">{{ row.name?.[0] || '?' }}</el-avatar>
              <div>
                <div class="fan-name">{{ row.name || '未知' }}</div>
                <div class="fan-remark">{{ row.remark || row.corpName || '-' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 1 ? 'warning' : 'primary'" size="small">
              {{ row.type === 1 ? '企业' : '微信' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="tag in (row.labels || [])" :key="tag" size="small" style="margin-right: 4px">
              {{ tag }}
            </el-tag>
            <span v-if="!row.labels?.length" class="text-muted">无</span>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="120" />
        <el-table-column label="最近聊天" width="170">
          <template #default="{ row }">
            {{ row.lastChatAt ? formatTime(row.lastChatAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="添加时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary">详情</el-button>
            <el-button size="small" link type="danger">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { getWecomFans } from '@/api';
import dayjs from 'dayjs';

const list = ref<any[]>([]);
const loading = ref(false);
const keyword = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const loadData = async () => {
  loading.value = true;
  try {
    const res: any = await getWecomFans({ page: page.value, pageSize: pageSize.value, keyword: keyword.value });
    list.value = res.list || [];
    total.value = res.total || 0;
  } finally {
    loading.value = false;
  }
};

const formatTime = (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm');

onMounted(loadData);
</script>

<style scoped>
.fan-cell { display: flex; align-items: center; gap: 10px; }
.fan-name { font-size: 14px; color: #303133; }
.fan-remark { font-size: 12px; color: #909399; }
.text-muted { color: #c0c4cc; font-size: 12px; }
</style>
